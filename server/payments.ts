/**
 * Care Net Portal — Square Subscription Payments
 *
 * Model: ONE merchant (Good Stuff / David). All subscriptions bill to one Square account.
 * Flow: capture card (hosted field) → create Square Customer → save card on file → create Subscription
 * No marketplace, no per-operator tokens, no deposits, no per-item checkout.
 *
 * Three auto-selected modes (set by env vars):
 *   simulate  — no SQUARE_ACCESS_TOKEN set → all operations are faked, no network calls
 *   sandbox   — SQUARE_ENV=sandbox + token set → real Square sandbox, fake cards, no real money
 *   production — SQUARE_ENV=production + token set → real money
 */

import { Client, Environment } from "square";

// ── Env config ──────────────────────────────────────────────────────────────

const SQUARE_ENV       = process.env.SQUARE_ENV || "sandbox";
const ACCESS_TOKEN     = process.env.SQUARE_ACCESS_TOKEN || "";
const APP_ID           = process.env.SQUARE_APP_ID || "";
const LOCATION_ID      = process.env.SQUARE_LOCATION_ID || "";

export type PaymentMode = "simulate" | "sandbox" | "production";

export function paymentMode(): PaymentMode {
  if (!ACCESS_TOKEN) return "simulate";
  return SQUARE_ENV === "production" ? "production" : "sandbox";
}

export function paymentsConfig() {
  return {
    mode: paymentMode(),
    appId: APP_ID,       // safe to expose — public key only
    locationId: LOCATION_ID,
    env: SQUARE_ENV,
  };
}

// ── Square client (lazy — only constructed when token is present) ────────────

function squareClient(): Client {
  return new Client({
    accessToken: ACCESS_TOKEN,
    environment: SQUARE_ENV === "production" ? Environment.Production : Environment.Sandbox,
  });
}

// ── Plan ID cache ─────────────────────────────────────────────────────────────
// We create the subscription plan once in Square's Catalog and cache its ID.
// In simulate mode we use a placeholder.

const PLAN_NAME = "Care Net Portal — Monthly";
const PLAN_PRICE_CENTS = 1000; // $10.00

let _cachedPlanId: string | null = null;

async function getOrCreatePlanId(): Promise<string> {
  if (paymentMode() === "simulate") return "sim_plan_monthly";
  if (_cachedPlanId) return _cachedPlanId;

  const sq = squareClient();

  // Search for existing plan first
  const listRes = await sq.catalog.list({ types: "SUBSCRIPTION_PLAN" });
  const objects = (listRes as any).result?.objects ?? [];
  const existing = objects.find((o: any) =>
    o.type === "SUBSCRIPTION_PLAN" &&
    o.subscriptionPlanData?.name === PLAN_NAME
  );
  if (existing) {
    _cachedPlanId = existing.id;
    return _cachedPlanId!;
  }

  // Create a new subscription plan
  const upsertRes = await sq.catalog.upsert({
    idempotencyKey: `cnp-plan-create-${PLAN_NAME.replace(/\s+/g, "-").toLowerCase()}`,
    object: {
      type: "SUBSCRIPTION_PLAN",
      id: "#monthly_plan",
      subscriptionPlanData: {
        name: PLAN_NAME,
        phases: [{
          cadence: "MONTHLY",
          recurringPriceMoney: {
            amount: BigInt(PLAN_PRICE_CENTS),
            currency: "USD",
          },
        }],
      },
    },
  });

  const planId = (upsertRes as any).result?.catalogObject?.id;
  if (!planId) throw new Error("Failed to create Square subscription plan");
  _cachedPlanId = planId;
  return _cachedPlanId!;
}

// ── Core subscription operations ─────────────────────────────────────────────

export interface CreateSubscriptionResult {
  mode: PaymentMode;
  squareCustomerId: string;
  squareCardId: string;
  squareSubscriptionId: string;
  subscriptionStatus: "ACTIVE" | "PENDING";
  currentPeriodEnd: string; // ISO date
}

/**
 * Create a Square Customer, save their card on file, and start a subscription.
 * cardToken: one-time token from the Square Web Payments SDK (browser-side tokenization).
 * portalId: CNP client.id — used as reference_id so we can reconcile webhooks.
 */
export async function createSubscription(
  cardToken: string,
  email: string,
  name: string,
  portalId: number
): Promise<CreateSubscriptionResult> {
  // ── Simulate mode ────────────────────────────────────────────────────────
  if (paymentMode() === "simulate") {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return {
      mode: "simulate",
      squareCustomerId: `sim_cust_${portalId}`,
      squareCardId: `sim_card_${portalId}`,
      squareSubscriptionId: `sim_sub_${portalId}`,
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: nextMonth.toISOString().substring(0, 10),
    };
  }

  const sq = squareClient();
  const idBase = `cnp-${portalId}-${Date.now()}`;

  // 1. Create or find Square Customer
  const custRes = await sq.customers.create({
    idempotencyKey: `${idBase}-customer`,
    emailAddress: email,
    displayName: name,
    referenceId: `cnp_portal_${portalId}`,
  });
  const customerId = (custRes as any).result?.customer?.id;
  if (!customerId) throw new Error("Failed to create Square customer");

  // 2. Save card on file
  const cardRes = await sq.cards.create({
    idempotencyKey: `${idBase}-card`,
    sourceId: cardToken,
    card: {
      customerId,
    },
  });
  const cardId = (cardRes as any).result?.card?.id;
  if (!cardId) throw new Error("Failed to save card on file");

  // 3. Get or create the subscription plan
  const planId = await getOrCreatePlanId();

  // 4. Create subscription
  const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
  const subRes = await sq.subscriptions.create({
    idempotencyKey: `${idBase}-subscription`,
    locationId: LOCATION_ID,
    planVariationId: planId,
    customerId,
    cardId,
    startDate: today,
  });
  const sub = (subRes as any).result?.subscription;
  if (!sub) throw new Error("Failed to create Square subscription");

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return {
    mode: paymentMode(),
    squareCustomerId: customerId,
    squareCardId: cardId,
    squareSubscriptionId: sub.id,
    subscriptionStatus: sub.status === "ACTIVE" ? "ACTIVE" : "PENDING",
    currentPeriodEnd: sub.chargedThroughDate ?? nextMonth.toISOString().substring(0, 10),
  };
}

/**
 * Cancel a subscription immediately.
 */
export async function cancelSubscription(squareSubscriptionId: string): Promise<void> {
  if (paymentMode() === "simulate") return;
  const sq = squareClient();
  await sq.subscriptions.cancel({ subscriptionId: squareSubscriptionId });
}

/**
 * Fetch current subscription status from Square.
 */
export async function getSubscriptionStatus(squareSubscriptionId: string): Promise<{
  status: string;
  chargedThroughDate: string | null;
}> {
  if (paymentMode() === "simulate") {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return { status: "ACTIVE", chargedThroughDate: nextMonth.toISOString().substring(0, 10) };
  }
  const sq = squareClient();
  const res = await sq.subscriptions.retrieve({ subscriptionId: squareSubscriptionId });
  const sub = (res as any).result?.subscription;
  return {
    status: sub?.status ?? "UNKNOWN",
    chargedThroughDate: sub?.chargedThroughDate ?? null,
  };
}
