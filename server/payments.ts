/**
 * Care Net Portal — Square Payments
 *
 * Model: ONE merchant (Good Stuff / David). All subscriptions bill to one Square account.
 * Flow: capture card (hosted field) → create Square Customer → save card on file → charge $10 now
 *       → store customer+card IDs → renew monthly via cron/webhook
 *
 * No Square Subscriptions API. No catalog plans. No plan variation IDs.
 * We manage the billing cycle ourselves — simpler, no Square catalog dependencies.
 *
 * Three auto-selected modes:
 *   simulate   — no SQUARE_ACCESS_TOKEN → all operations faked, no network calls
 *   sandbox    — SQUARE_ENV=sandbox + token set → real Square sandbox, fake cards, no real money
 *   production — SQUARE_ENV=production + token set → real money
 *
 * SDK: square v42+ — SquareClient / SquareEnvironment
 */

import { SquareClient, SquareEnvironment } from "square";
import { randomUUID } from "crypto";

// ── Env config ───────────────────────────────────────────────────────────────

const SQUARE_ENV   = process.env.SQUARE_ENV || "sandbox";
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
const APP_ID       = process.env.SQUARE_APP_ID || "";
const LOCATION_ID  = process.env.SQUARE_LOCATION_ID || "";

const MONTHLY_PRICE_CENTS = 1000; // $10.00

export type PaymentMode = "simulate" | "sandbox" | "production";

export function paymentMode(): PaymentMode {
  if (!ACCESS_TOKEN) return "simulate";
  return SQUARE_ENV === "production" ? "production" : "sandbox";
}

export function paymentsConfig() {
  return {
    mode: paymentMode(),
    appId: APP_ID,
    locationId: LOCATION_ID,
    env: SQUARE_ENV,
  };
}

// ── Square client ─────────────────────────────────────────────────────────────

function squareClient(): SquareClient {
  return new SquareClient({
    token: ACCESS_TOKEN,
    environment: SQUARE_ENV === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  });
}

// ── Main export: createSubscription ──────────────────────────────────────────
// 1. Create Square Customer
// 2. Save card on file (Cards API)
// 3. Charge $10 now (Payments API)
// 4. Return IDs + next renewal date (30 days)

export interface SubscriptionResult {
  mode: PaymentMode;
  squareCustomerId: string;
  squareCardId: string;
  squareSubscriptionId: string; // payment ID used as subscription reference
  currentPeriodEnd: string;     // ISO date of next renewal
}

export async function createSubscription(
  cardToken: string,
  email: string,
  name: string,
  portalId: number
): Promise<SubscriptionResult> {
  const mode = paymentMode();

  // ── Simulate mode ─────────────────────────────────────────────────────────
  if (mode === "simulate") {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return {
      mode: "simulate",
      squareCustomerId: `sim_cust_${portalId}`,
      squareCardId: `sim_card_${Date.now()}`,
      squareSubscriptionId: `sim_pay_${Date.now()}`,
      currentPeriodEnd: next.toISOString(),
    };
  }

  // ── Real Square (sandbox or production) ───────────────────────────────────
  const sq = squareClient();

  // 1. Create customer
  const custResp = await sq.customers.create({
    emailAddress: email || undefined,
    givenName: name || "Portal Owner",
    referenceId: `cnp_portal_${portalId}`,
    idempotencyKey: randomUUID(),
  });

  const customerId = (custResp as any)?.customer?.id;
  if (!customerId) {
    const err = JSON.stringify((custResp as any)?.errors ?? custResp);
    throw new Error(`Square customer creation failed: ${err}`);
  }

  // 2. Save card on file
  const cardResp = await sq.cards.create({
    idempotencyKey: randomUUID(),
    sourceId: cardToken,
    card: { customerId },
  });

  const cardId = (cardResp as any)?.card?.id;
  if (!cardId) {
    const err = JSON.stringify((cardResp as any)?.errors ?? cardResp);
    throw new Error(`Square card save failed: ${err}`);
  }

  // 3. Charge $10 now
  const payResp = await sq.payments.create({
    idempotencyKey: randomUUID(),
    sourceId: cardId,
    customerId,
    amountMoney: {
      amount: BigInt(MONTHLY_PRICE_CENTS),
      currency: "USD",
    },
    locationId: LOCATION_ID,
    note: `Care Net Portal — monthly subscription (portal ${portalId})`,
    autocomplete: true,
  });

  const payment = (payResp as any)?.payment;
  if (!payment?.id) {
    const err = JSON.stringify((payResp as any)?.errors ?? payResp);
    throw new Error(`Square charge failed: ${err}`);
  }

  // 4. Next renewal = 30 days from now
  const next = new Date();
  next.setDate(next.getDate() + 30);

  return {
    mode,
    squareCustomerId: customerId,
    squareCardId: cardId,
    squareSubscriptionId: payment.id, // payment ID as the subscription reference
    currentPeriodEnd: next.toISOString(),
  };
}

// ── cancelSubscription ────────────────────────────────────────────────────────
// We manage billing ourselves — cancellation just prevents future renewals.
// No Square API call needed; the DB column update in routes.ts handles it.

export async function cancelSubscription(_squareSubscriptionId: string): Promise<void> {
  // Nothing to do in Square — we simply stop charging at renewal time.
  return;
}

// ── chargeRenewal ─────────────────────────────────────────────────────────────
// Called by a cron job when subscription_renews_at is due.

export async function chargeRenewal(
  squareCustomerId: string,
  squareCardId: string,
  portalId: number
): Promise<{ paymentId: string; nextPeriodEnd: string }> {
  if (paymentMode() === "simulate") {
    const next = new Date();
    next.setDate(next.getDate() + 30);
    return { paymentId: `sim_renew_${Date.now()}`, nextPeriodEnd: next.toISOString() };
  }

  const sq = squareClient();
  const payResp = await sq.payments.create({
    idempotencyKey: randomUUID(),
    sourceId: squareCardId,
    customerId: squareCustomerId,
    amountMoney: {
      amount: BigInt(MONTHLY_PRICE_CENTS),
      currency: "USD",
    },
    locationId: LOCATION_ID,
    note: `Care Net Portal — monthly renewal (portal ${portalId})`,
    autocomplete: true,
  });

  const payment = (payResp as any)?.payment;
  if (!payment?.id) {
    const err = JSON.stringify((payResp as any)?.errors ?? payResp);
    throw new Error(`Square renewal charge failed: ${err}`);
  }

  const next = new Date();
  next.setDate(next.getDate() + 30);
  return { paymentId: payment.id, nextPeriodEnd: next.toISOString() };
}
