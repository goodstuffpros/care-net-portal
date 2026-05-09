/**
 * VerifyEmail — /#/verify-email/:token
 * User lands here from their email. Calls POST /api/auth/verify-email,
 * auto-logs in, and redirects into the app.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// Detect in-app browsers (Messenger, Instagram, Facebook, etc.)
function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|MessengerForiOS|FB_IAB|FB4A|FBIOS|LinkedInApp|Twitter|Snapchat|TikTok|WebView/.test(ua)
    || (/iPhone|iPod|iPad/.test(ua) && !/(Safari)/.test(ua) && /(AppleWebKit)/.test(ua));
}

type Stage = "verifying" | "success" | "error" | "expired";

interface Props { token?: string; }

export default function VerifyEmailPage({ token }: Props) {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>("verifying");
  const inAppBrowser = isInAppBrowser();
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const [errorMsg, setErrorMsg] = useState("");
  const [userName, setUserName] = useState("");
  const [slowLoad, setSlowLoad] = useState(false);

  // After 8 seconds still verifying → show a reassuring message
  useEffect(() => {
    const t = setTimeout(() => setSlowLoad(true), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!token) { setStage("error"); setErrorMsg("Missing verification token."); return; }

    apiRequest("POST", "/api/auth/verify-email", { token })
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (body.message?.toLowerCase().includes("expired")) {
            setStage("expired");
          } else {
            setStage("error");
            setErrorMsg(body.message || "Verification failed. The link may have already been used.");
          }
          return;
        }
        setUserName(body.user?.name?.split(" ")[0] || "");
        // Invalidate auth cache so the app re-fetches the session
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        setStage("success");
        // Redirect to login after a moment — more reliable on mobile where the
        // email client opens links in a sandboxed in-app browser (no shared cookies)
        setTimeout(() => navigate("/login?verified=1"), 1800);
      })
      .catch(() => {
        setStage("error");
        setErrorMsg("Something went wrong. Please try again.");
      });
  }, [token]);

  // ── In-app browser intercept ─────────────────────────────────────────────
  if (inAppBrowser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-xs w-full bg-white dark:bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Open in your browser</h2>
          <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
            Email verification links need to open in Safari or Chrome — not inside Messenger or another app.
          </p>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-primary text-primary-foreground font-medium py-2.5 px-4 rounded-xl text-sm transition-opacity hover:opacity-90 mb-3"
          >
            Open in Browser
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(currentUrl)}
            className="text-xs text-primary underline underline-offset-2"
          >
            Copy link
          </button>
        </div>
      </div>
    );
  }

  // ── Verifying ──────────────────────────────────────────────────────────────
  if (stage === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-xs">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Verifying your email…</p>
          {slowLoad && (
            <p className="text-muted-foreground/60 text-xs leading-relaxed">
              Almost there — the server is waking up.<br />This can take up to 60 seconds on first use.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (stage === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {userName ? `You're verified, ${userName}!` : "Email verified!"}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Your account is ready. Taking you to sign in — open the app in your regular browser if this doesn't redirect automatically.
          </p>
          <div className="flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // ── Expired ────────────────────────────────────────────────────────────────
  if (stage === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/40 mb-6">
            <XCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Link expired</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Verification links expire after 24 hours. Sign in and we'll send you a fresh one.
          </p>
          <Button className="w-full" onClick={() => navigate("/login")}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-6">
          <XCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Verification failed</h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          {errorMsg || "This link is invalid or has already been used."}
        </p>
        <div className="space-y-2">
          <Button className="w-full" onClick={() => navigate("/login")}>
            Go to sign in
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/apply")}>
            Create a new account
          </Button>
        </div>
      </div>
    </div>
  );
}
