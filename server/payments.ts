/**
 * Care Net Portal — Square Subscription Payments
 *
 * Model: ONE merchant (Good Stuff / David). All subscriptions bill to one Square account.
 * Flow: capture card (hosted field) → create Square Customer → save card on file → create Subscription
 *
 * Three auto-selected modes:
 *   simulate   — no SQUARE_ACCESS_TOKEN set → all operations faked, no network calls
 *   sandbox    — SQUARE_ENV=sandbox + token set → real Square sandbox, fake cards, no real money
 *   production — SQUARE_ENV=production + token set → real money
 *
 * SDK: square (v42+) — exports SquareClient and SquareEnvironment (not Client/Environment)
 */

import { SquareClient, SquareEnvironment } from "square";

// ── Env config ───────────────────────────────────────────────────────────────

const SQUARE_ENV   = process.env.SQUARE_ENV || "sandbox";
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
const APP_ID       = process.env.SQUARE_APP_ID || "";
const LOCATION_ID  = process.env.SQUARE_LOCATION_ID || "";

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

// ── Plan ID (catalog item) ────────────────────────────────────────────────────

const PLAN_NAME        = "Care Net Portal — Monthly";
const PLAN_PRICE_CENTS = 1000; // $10.00

let _cachedPlanId: string | null = null;

async function getOrCreatePlanId(): Promise<string> {
  if (paymentMode() === "simulate") return "sim_plan_monthly";
  if (_cachedPlanId) return _cachedPlanId;

  const sq = squareClient();

  // Search for existing plan
  const searchResp = await sq.catalog.search({
    query: {
      exactQuery: {
        attributeName: "name",
        attributeValue: PLAN_NAME,
      },
    },
  });

  const existing = (searchResp as any)?.objects?.find(
    (o: any) => o.type === "SUBSCRIPTION_PLAN"
  );
  if (existing?.id) {
    _cachedPlanId = existing.id;
    return _cachedPlanId!;
  }

  // Create the plan
  const idempKey = `cnp-monthly-plan-v1`;
  const createResp = await sq.catalog.upsert({
    idempotencyKey: idempKey,
    object: {
      type: "SUBSCRIPTION_PLAN",
      id: "#monthly",
      subscriptionPlanData: {
        name: PLAN_NAME,
        phases: [
          {
            cadence: "MONTHLY",
            recurringPriceMoney: {
              amount: BigInt(PLAN_PRICE_CENTS),
              currency: "USD",
            },
          },
        ],
      },
    },
  });

  const planId = (createResp as any)?.catalogObject?.id;
  if (!planId) throw new Error("Failed to create subscription plan in Square catalog");
  _cachedPlanId = planId;
  return _cachedPlanId!;
}

// ── Main export: createSubscription ──────────────────────────────────────────

export interface SubscriptionResult {
  mode: PaymentMode;
  squareCustomerId: string;
  squareCardId: string;
  squareSubscriptionId: string;
  currentPeriodEnd: string; // ISO date of next renewal
}

export async function createSubscription(
  cardToken: string,
  email: string,
  name: string,
  portalId: number
): Promise<SubscriptionResult> {
  const mode = paymentMode();

  // ── Simulate mode — no real calls ────────────────────────────────────────
  if (mode === "simulate") {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    return {
      mode: "simulate",
      squareCustomerId: `sim_cust_${portalId}`,
      squareCardId: `sim_card_${Date.now()}`,
      squareSubscriptionId: `sim_sub_${Date.now()}`,
      currentPeriodEnd: now.toISOString(),
    };
  }

  // ── Real Square (sandbox or production) ──────────────────────────────────
  const sq = squareClient();

  // 1. Create customer
  const custResp = await sq.customers.create({
    emailAddress: email,
    givenName: name || "Portal Owner",
    referenceId: `cnp_portal_${portalId}`,
    idempotencyKey: `cnp-cust-${portalId}-${Date.now()}`,
  });

  const customerId = (custResp as any)?.customer?.id;
  if (!customerId) throw new Error("Square customer creation failed");

  // 2. Save card on file
  const cardResp = await sq.cards.create({
    idempotencyKey: `cnp-card-${portalId}-${Date.now()}`,
    sourceId: cardToken,
    card: {
      customerId,
    },
  });

  const cardId = (cardResp as any)?.card?.id;
  if (!cardId) throw new Error("Square card save failed");

  // 3. Get or create the subscription plan
  const planId = await getOrCreatePlanId();

  // 4. Create subscription
  const subResp = await sq.subscriptions.create({
    idempotencyKey: `cnp-sub-${portalId}-${Date.now()}`,
    locationId: LOCATION_ID,
    planVariationId: planId,
    customerId,
    cardId,
    startDate: new Date().toISOString().split("T")[0],
  });

  const sub = (subResp as any)?.subscription;
  if (!sub?.id) throw new Error("Square subscription creation failed");

  // Calculate next billing date (30 days out as fallback)
  let periodEnd: string;
  if (sub.chargedThroughDate) {
    periodEnd = new Date(sub.chargedThroughDate).toISOString();
  } else {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    periodEnd = next.toISOString();
  }

  return {
    mode,
    squareCustomerId: customerId,
    squareCardId: cardId,
    squareSubscriptionId: sub.id,
    currentPeriodEnd: periodEnd,
  };
}

// ── cancelSubscription ────────────────────────────────────────────────────────

export async function cancelSubscription(squareSubscriptionId: string): Promise<void> {
  if (paymentMode() === "simulate") return;
  const sq = squareClient();
  await sq.subscriptions.cancel({ subscriptionId: squareSubscriptionId });
}

// ── getSubscriptionStatus ─────────────────────────────────────────────────────

export async function getSquareSubscriptionStatus(
  squareSubscriptionId: string
): Promise<"ACTIVE" | "CANCELED" | "PAUSED" | "PENDING" | "UNKNOWN"> {
  if (paymentMode() === "simulate") return "ACTIVE";
  const sq = squareClient();
  const resp = await sq.subscriptions.get({ subscriptionId: squareSubscriptionId });
  const status = (resp as any)?.subscription?.status;
  return status ?? "UNKNOWN";
}
