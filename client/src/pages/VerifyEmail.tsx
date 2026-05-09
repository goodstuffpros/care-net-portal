/**
 * VerifyEmail — /#/verify-email/:token
 * User lands here from their email. Calls POST /api/auth/verify-email,
 * auto-logs in, and redirects into the app.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Stage = "verifying" | "success" | "error" | "expired";

interface Props { token?: string; }

export default function VerifyEmailPage({ token }: Props) {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>("verifying");
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
