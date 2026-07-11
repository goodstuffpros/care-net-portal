/**
 * Care Net Portal — Subscription Renewal Cron
 *
 * Runs daily at 11:00 AM UTC (6:00 AM CDT).
 *
 * Two jobs:
 *   1. renewalJob  — charge portals whose subscription_renews_at is today or past
 *   2. expiryJob   — flip portals whose grace_period_ends_at is past to read_only
 */

import cron from "node-cron";
import { db } from "./db";
import { clients, users } from "../shared/schema";
import { eq, lte, and, isNotNull, ne } from "drizzle-orm";
import { chargeRenewal } from "./payments";
import { sendEmail } from "./auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function getOwnerEmail(clientId: number): Promise<string | null> {
  try {
    // primary contact for this portal
    const client = db.select().from(clients).where(eq(clients.id, clientId)).get();
    if (!client?.primaryContactId) return null;
    const user = db.select().from(users).where(eq(users.id, client.primaryContactId)).get();
    return user?.email ?? null;
  } catch {
    return null;
  }
}

// ── Job 1: Charge renewals due today or past ─────────────────────────────────

async function renewalJob() {
  const todayStr = today();
  console.log(`[renewalCron] Running renewal job — date: ${todayStr}`);

  let due: typeof clients.$inferSelect[] = [];
  try {
    due = db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.subscriptionStatus, "active"),
          ne(clients.founderTier, "beta"),  // beta portals are free for life
          isNotNull(clients.squareCardId),
          isNotNull(clients.squareCustomerId),
          lte(clients.subscriptionRenewsAt, todayStr)
        )
      )
      .all();
  } catch (e: any) {
    console.error("[renewalCron] Failed to query due portals:", e.message);
    return;
  }

  console.log(`[renewalCron] ${due.length} portal(s) due for renewal`);

  for (const portal of due) {
    try {
      const result = await chargeRenewal(
        portal.squareCustomerId!,
        portal.squareCardId!,
        portal.id
      );

      // Success — advance renewal date
      db.update(clients)
        .set({ subscriptionRenewsAt: result.nextPeriodEnd })
        .where(eq(clients.id, portal.id))
        .run();

      console.log(`[renewalCron] Portal ${portal.id} renewed OK — next: ${result.nextPeriodEnd}`);
    } catch (e: any) {
      console.error(`[renewalCron] Charge failed for portal ${portal.id}:`, e.message);

      // Failure — start grace period
      const graceEnd = daysFromNow(30);
      db.update(clients)
        .set({
          subscriptionStatus: "past_due",
          gracePeriodEndsAt: graceEnd,
        })
        .where(eq(clients.id, portal.id))
        .run();

      // Email the portal owner
      const ownerEmail = await getOwnerEmail(portal.id);
      if (ownerEmail) {
        await sendEmail({
          to: ownerEmail,
          subject: "Action needed — Care Net Portal payment failed",
          html: `
            <p>Hi,</p>
            <p>We weren't able to process your monthly payment for <strong>Care Net Portal</strong>.</p>
            <p>Your portal will stay fully active for the next <strong>30 days</strong> while you update your payment method. After that, it will switch to read-only mode — all your records will be kept.</p>
            <p><a href="https://care-net-portal-production.up.railway.app/#/billing">Update your payment method</a></p>
            <p>If you have any questions, reply to this email and we'll help you right away.</p>
            <p>— Care Net Portal</p>
          `,
        }).catch(err => console.error(`[renewalCron] Email failed for portal ${portal.id}:`, err));
      }
    }
  }
}

// ── Job 2: Expire grace periods ───────────────────────────────────────────────

async function expiryJob() {
  const todayStr = today();
  console.log(`[renewalCron] Running expiry check — date: ${todayStr}`);

  let expired: typeof clients.$inferSelect[] = [];
  try {
    expired = db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.subscriptionStatus, "past_due"),
          isNotNull(clients.gracePeriodEndsAt),
          lte(clients.gracePeriodEndsAt, todayStr)
        )
      )
      .all();
  } catch (e: any) {
    console.error("[renewalCron] Failed to query expired portals:", e.message);
    return;
  }

  console.log(`[renewalCron] ${expired.length} portal(s) past grace period`);

  for (const portal of expired) {
    db.update(clients)
      .set({ subscriptionStatus: "read_only" })
      .where(eq(clients.id, portal.id))
      .run();

    console.log(`[renewalCron] Portal ${portal.id} → read_only`);
  }
}

// ── Start the cron ────────────────────────────────────────────────────────────

export function startRenewalCron() {
  if (process.env.NODE_ENV !== "production") {
    console.log("[renewalCron] Skipping cron in non-production environment");
    return;
  }

  // 11:00 AM UTC = 6:00 AM CDT
  cron.schedule("0 11 * * *", async () => {
    await renewalJob();
    await expiryJob();
  });

  console.log("[renewalCron] Scheduled — daily at 11:00 UTC (6:00 AM CDT)");
}
