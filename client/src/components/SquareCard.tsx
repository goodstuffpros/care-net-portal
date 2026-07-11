/**
 * SquareCard — hosted card field using Square Web Payments SDK.
 * Card data never touches our server. Square tokenizes it in the browser.
 * Parent calls ref.current.tokenize() to get a one-time token to send to /api/billing/subscribe.
 */

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

interface PaymentsConfig {
  mode: "simulate" | "sandbox" | "production";
  appId: string;
  locationId: string;
}

interface SquareCardRef {
  tokenize: () => Promise<string>;
}

interface Props {
  config: PaymentsConfig;
}

declare global {
  interface Window {
    Square?: any;
  }
}

const SANDBOX_SDK = "https://sandbox.web.squarecdn.com/v1/square.js";
const PROD_SDK    = "https://web.squarecdn.com/v1/square.js";

const SquareCard = forwardRef<SquareCardRef, Props>(({ config }, ref) => {
  const cardRef    = useRef<any>(null);
  const paymentsRef = useRef<any>(null);
  const [ready, setReady]   = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const mountedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    async tokenize(): Promise<string> {
      if (!cardRef.current) throw new Error("Card field not ready");
      const result = await cardRef.current.tokenize();
      if (result.status === "OK") return result.token;
      const msg = result.errors?.map((e: any) => e.message).join(", ") ?? "Card tokenization failed";
      throw new Error(msg);
    },
  }));

  useEffect(() => {
    if (config.mode === "simulate") { setReady(true); return; }
    if (mountedRef.current) return;
    mountedRef.current = true;

    const sdkUrl = config.mode === "production" ? PROD_SDK : SANDBOX_SDK;

    // Load Square SDK script if not already loaded
    const loadSdk = (): Promise<void> => {
      if (window.Square) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = sdkUrl;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Square SDK"));
        document.head.appendChild(script);
      });
    };

    loadSdk()
      .then(async () => {
        if (!window.Square) throw new Error("Square SDK not available");
        const payments = window.Square.payments(config.appId, config.locationId);
        paymentsRef.current = payments;
        const card = await payments.card();
        await card.attach("#square-card-container");
        cardRef.current = card;
        setReady(true);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to initialize payment field");
      });

    return () => {
      if (cardRef.current) {
        cardRef.current.destroy().catch(() => {});
        cardRef.current = null;
      }
    };
  }, [config.appId, config.locationId, config.mode]);

  if (config.mode === "simulate") {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-center text-sm text-muted-foreground">
        Simulated mode — no card required. Click Subscribe to activate.
      </div>
    );
  }

  return (
    <div>
      {config.mode === "sandbox" && (
        <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300">
          Practice mode — use test card <span className="font-mono font-semibold">4111 1111 1111 1111</span>, any future date, any CVV.
        </div>
      )}
      <div
        id="square-card-container"
        className="rounded-lg border border-border bg-background p-3 min-h-[80px]"
      />
      {!ready && !error && (
        <p className="mt-2 text-xs text-muted-foreground">Loading secure card field…</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
});

SquareCard.displayName = "SquareCard";
export default SquareCard;
export type { SquareCardRef, PaymentsConfig };
