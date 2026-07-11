/**
 * Billing — subscription management for portal owners (MC and SC only).
 * CGs and SC family members see a read-only view with no payment controls.
 */

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import SquareCard, { type SquareCardRef, type PaymentsConfig } from "@/components/SquareCard";
import { CreditCard, CheckCircle, AlertTriangle, BookOpen, Heart } from "lucide-react";

// Detect setup mode — user just finished MC wizard, card entry is required
function isSetupMode(): boolean {
  return window.location.hash.includes("setup=1") || new URLSearchParams(window.location.search).get("setup") === "1";
}

interface BillingStatus {
  subscriptionStatus: "trial" | "active" | "past_due" | "grace" | "read_only" | "canceled";
  subscriptionRenewsAt: string | null;
  gracePeriodEndsAt: string | null;
  trialStartedAt: string | null;
  hasPaymentMethod: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    trial:     { label: "Trial",       cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    active:    { label: "Active",      cls: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
    past_due:  { label: "Past Due",    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
    grace:     { label: "Grace Period",cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
    read_only: { label: "Read Only",   cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    canceled:  { label: "Canceled",    cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export default function Billing() {
  const qc = useQueryClient();
  const cardRef = useRef<SquareCardRef>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const setupMode = isSetupMode();

  const { data: billing, isLoading: billingLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: () => apiRequest("GET", "/api/billing/status").then(r => r.json()),
  });

  const { data: config, isLoading: configLoading } = useQuery<PaymentsConfig>({
    queryKey: ["/api/payments/config"],
    queryFn: () => apiRequest("GET", "/api/payments/config").then(r => r.json()),
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/billing/cancel").then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/billing/status"] });
      setConfirmCancel(false);
      setSuccessMsg(`Subscription canceled. Your portal stays fully active through ${formatDate(data.gracePeriodEndsAt)}.`);
    },
    onError: (e: any) => setErrorMsg(e.message ?? "Cancellation failed"),
  });

  async function handleSubscribe() {
    if (!cardRef.current || !config) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubscribing(true);
    try {
      const cardToken = config.mode === "simulate" ? "sim_token" : await cardRef.current.tokenize();
      const res = await apiRequest("POST", "/api/billing/subscribe", { cardToken });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Subscription failed");
      qc.invalidateQueries({ queryKey: ["/api/billing/status"] });
      if (setupMode) {
        // Setup flow — go straight to dashboard after card saved
        setTimeout(() => { window.location.href = "/"; }, 1800);
      }
      setSuccessMsg(`Your first month is free. First charge of $10 on ${formatDate(data.renewsAt)}.`);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubscribing(false);
    }
  }

  if (billingLoading || configLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading billing info…</div>;
  }

  const status = billing?.subscriptionStatus ?? "trial";
  const isOwner = true; // Server enforces this — non-owners get 403 on subscribe/cancel
  const isActive = status === "active";
  const needsPayment = ["trial", "grace", "past_due", "read_only", "canceled"].includes(status);

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        {setupMode ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-5 h-5 text-primary fill-primary/20" />
              <h1 className="text-2xl font-bold text-foreground">One last step</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Your portal is ready. Add a payment method to keep access after your free month — your card won't be charged until day 31.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground">Portal Billing</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your Care Net Portal subscription.
            </p>
          </>
        )}
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Subscription status</span>
          <StatusBadge status={status} />
        </div>

        {isActive && billing?.subscriptionRenewsAt && (
          <div className="text-sm text-muted-foreground">
            Next billing date: <span className="font-medium text-foreground">{formatDate(billing.subscriptionRenewsAt)}</span>
          </div>
        )}

        {(status === "grace" || status === "past_due") && billing?.gracePeriodEndsAt && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Your portal is in its 30-day grace period. Add a payment method before{" "}
              <strong>{formatDate(billing.gracePeriodEndsAt)}</strong> to stay fully active.
            </p>
          </div>
        )}

        {status === "read_only" && (
          <div className="flex items-start gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-border p-3">
            <BookOpen className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Your portal is in Read Only mode. All records are preserved. Subscribe to restore full access.
            </p>
          </div>
        )}

        {status === "trial" && (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 p-3">
            <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              You're in trial mode. Subscribe to keep your portal active and unlock all features.
            </p>
          </div>
        )}

        <div className="pt-1 border-t border-border text-xs text-muted-foreground">
          <strong>$10 / month</strong> · Cancel anytime · 30-day grace period on lapse · Your data is always yours
        </div>
      </div>

      {/* Success / error messages */}
      {successMsg && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700 p-3 text-sm text-green-800 dark:text-green-300">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Subscribe form */}
      {needsPayment && config && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {billing?.hasPaymentMethod ? "Update payment method" : "Add payment method"}
            </span>
          </div>
          <SquareCard ref={cardRef} config={config} />
          <button
            onClick={handleSubscribe}
            disabled={subscribing}
            className="w-full rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {subscribing ? "Processing…" : "Start free month — $10/month after"}
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Your card is encrypted by Square and never stored on our servers.
          </p>
        </div>
      )}

      {/* Cancel subscription */}
      {isActive && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Cancel subscription</p>
          <p className="text-xs text-muted-foreground">
            Canceling starts a 30-day grace period. Your portal stays fully active until then.
            After that it switches to Read Only — all your records are kept forever.
          </p>
          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              className="text-xs text-destructive underline underline-offset-2"
            >
              Cancel my subscription
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setCanceling(true); cancelMutation.mutate(); }}
                disabled={canceling}
                className="flex-1 rounded-lg border border-destructive text-destructive py-2 text-sm font-semibold hover:bg-destructive/5 disabled:opacity-50"
              >
                {canceling ? "Canceling…" : "Yes, cancel"}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold"
              >
                Never mind
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
