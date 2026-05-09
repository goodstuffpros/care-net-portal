/**
 * Complete Signup page — /complete-signup?token=...
 * Used when admin approves an applicant and sends invite link.
 * User sets their password and gets a verify email sent.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Heart, AlertCircle } from "lucide-react";

function getTokenFromHash(): string | null {
  // Try query string first (email links use ?page=complete-signup&token=...)
  const qParams = new URLSearchParams(window.location.search);
  const fromQuery = qParams.get("token");
  if (fromQuery) return fromQuery;
  // Fallback: hash-based routing (#/complete-signup?token=...)
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return null;
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  return params.get("token");
}

export default function CompleteSignupPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const token = getTokenFromHash();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const passwordsMatch = password === confirm;
  const passwordStrong = password.length >= 8;
  const valid = passwordStrong && passwordsMatch && password.length > 0;

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!valid || !token) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/complete-signup", { token, password });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create account");
      }
      setDone(true);
      // Redirect to app after a moment — RealAuthGate will detect the session
      // and show the onboarding wizard automatically
      setTimeout(() => {
        window.location.href = "/";
      }, 1800);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Invalid invite link</h2>
          <p className="text-sm text-muted-foreground mb-6">
            This link appears to be missing or invalid. Please check the email you received and try again.
          </p>
          <Button variant="outline" onClick={() => navigate("/login")}>Back to sign in</Button>
        </div>
      </div>
    );
  }

  // After submission
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">You're in!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Your account is ready. Taking you to Care Net Portal now…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Welcome to Care Net Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set a password to complete your account setup.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5" data-testid="form-complete-signup">

            <div className="space-y-1.5">
              <Label htmlFor="cs-password">Create a password</Label>
              <div className="relative">
                <Input
                  id="cs-password"
                  type={showPw ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
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
              {password.length > 0 && !passwordStrong && (
                <p className="text-xs text-destructive">Must be at least 8 characters</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cs-confirm">Confirm password</Label>
              <div className="relative">
                <Input
                  id="cs-confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirm.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">Passwords don't match</p>
              )}
            </div>

            <Button
              type="button"
              onClick={handleSubmit as any}
              className="w-full"
              disabled={loading}
              data-testid="button-create-account"
            >
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</> : "Create account"}
            </Button>
          </form>
          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              By creating an account you agree to our{" "}
              <a href="#/terms" className="text-primary hover:underline">Terms of Service</a>
              {", "}
              <a href="#/privacy" className="text-primary hover:underline">Privacy Policy</a>
              {" and "}
              <a href="#/beta-agreement" className="text-primary hover:underline">Beta User Agreement</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
