/**
 * Login page — /login
 * Email + password. Shows "Apply for Beta" link.
 * In DEMO_MODE the form is not shown — a notice explains the demo state.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient, setAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Heart, Mail, CheckCircle2 } from "lucide-react";

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps = {}) {
  const [, navigate] = useLocation();
  const { toast, dismiss } = useToast();

  // Read invite token + verified flag from URL hash query string: /#/login?invite=TOKEN&verified=1
  const hashQuery = window.location.hash.split("?")[1] || "";
  const hashParams = new URLSearchParams(hashQuery);
  const inviteTokenFromUrl = hashParams.get("invite") || sessionStorage.getItem("pending_invite_token") || null;
  const justVerified = hashParams.get("verified") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim() || !password) return;
    setLoginError(null);
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email: email.trim(), password });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.needsVerification) {
          setNeedsVerification(true);
          return;
        }
        throw new Error(body.message || "Login failed");
      }
      // Store token FIRST — must happen before any post-login API calls (invite accept, etc.)
      if (body.token) {
        setAuthToken(body.token);
        try { sessionStorage.setItem("cn_auth_token", body.token); } catch {}
      }
      // Accept pending invite if token present
      if (inviteTokenFromUrl) {
        // Small delay to let the browser fully commit the session cookie before
        // firing the accept request — critical on Android Chrome
        await new Promise(resolve => setTimeout(resolve, 400));
        try {
          const acceptRes = await apiRequest("POST", `/api/invite/${inviteTokenFromUrl}/accept`, {});
          const acceptData = await acceptRes.json();
          if (acceptData.success) {
            sessionStorage.removeItem("pending_invite_token");
            toast({ title: "Connected!", description: "Your portals are now linked. Taking you in..." });
            // Delay so DB write is committed before RealAuthGate reads /api/auth/me
            await new Promise(resolve => setTimeout(resolve, 1500));
            window.location.href = "/#/";
            return;
          } else {
            // Keep token in sessionStorage on failure so user can retry
            console.warn("[invite accept]", acceptData.message);
          }
        } catch (err) {
          console.error("[invite accept] failed:", err);
        }
      }
      // Dismiss any lingering error toasts (e.g. from a failed attempt just before this one)
      dismiss();
      // Trigger RealAuthGate via callback — no window.location navigation needed.
      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        window.location.href = "/#/";
      }
    } catch (err: any) {
      const rawMsg: string = err.message || "";
      const friendlyMsg = rawMsg.includes("Invalid email or password")
        ? "Incorrect email or password. Try again or use Forgot password."
        : rawMsg.replace(/^\d+: /, "").replace(/^\{.*\}$/, "Login failed — please try again.");
      setLoginError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    try {
      await apiRequest("POST", "/api/auth/resend-verification", { email: email.trim() });
      setResendSent(true);
      toast({ title: "Email sent", description: "Check your inbox for a new verification link." });
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setResendLoading(false);
    }
  }

  // ── Needs verification screen ───────────────────────────────────────────────
  if (needsVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Check your email</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-1">
            Your account isn't verified yet. We sent a link to
          </p>
          <p className="font-medium text-foreground mb-4">{email}</p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Click the link to verify your account and get started. Be sure to check your spam folder if you don't see it in your inbox.
          </p>
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={handleResend}
              disabled={resendLoading || resendSent}
              data-testid="button-resend"
            >
              {resendLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> :
               resendSent ? "Email resent ✓" : "Resend verification email"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setNeedsVerification(false)}
              data-testid="button-back-login"
            >
              Back to sign in
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-8">
            The link expires in 24 hours. Check your spam folder if you don't see it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Care Net Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          {/* Verified banner */}
          {justVerified && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Email verified! Sign in below to get started.
              </p>
            </div>
          )}
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5" data-testid="form-login">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setLoginError(null); }}
                disabled={loading}
                className={loginError ? "border-red-500 focus-visible:ring-red-500" : ""}
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs text-primary hover:underline"
                  data-testid="link-forgot-password"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setLoginError(null); }}
                  disabled={loading}
                  className={`pr-10 ${loginError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Inline error message */}
              {loginError && (
                <p className="text-xs text-red-500 mt-1" data-testid="text-login-error">
                  {loginError}
                </p>
              )}
            </div>

            <Button
              type="button"
              onClick={handleSubmit as any}
              className="w-full"
              disabled={loading || !email.trim() || !password}
              data-testid="button-submit-login"
            >
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</> : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Don't have access?{" "}
              <button
                onClick={() => navigate("/apply")}
                className="text-primary hover:underline font-medium"
                data-testid="link-apply"
              >
                Apply for beta
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Care Net Portal is currently in private beta.
        </p>
      </div>
    </div>
  );
}
