/**
 * Email verification page — /verify-email?token=...
 * Called when user clicks link in verification email.
 * Auto-submits on mount.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Loader2, Heart, CheckCircle2, AlertCircle } from "lucide-react";

function getTokenFromHash(): string | null {
  // Try query string first (email links use ?page=verify-email&token=...)
  const qParams = new URLSearchParams(window.location.search);
  const fromQuery = qParams.get("token");
  if (fromQuery) return fromQuery;
  // Fallback: hash-based routing (#/verify-email?token=...)
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return null;
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  return params.get("token");
}

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const token = getTokenFromHash();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token found in the link.");
      return;
    }
    apiRequest("POST", "/api/auth/verify-email", { token })
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Verification failed");
        }
        setStatus("success");
        // Auto-redirect to app after 2s
        setTimeout(() => {
          window.location.hash = "/";
          window.location.reload();
        }, 2500);
      })
      .catch(err => {
        setStatus("error");
        setErrorMsg(err.message);
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Verifying your email…</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Email verified</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Your account is now active. Taking you to Care Net Portal…
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Redirecting…
          </div>
        </div>
      </div>
    );
  }

  // Error
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Verification failed</h2>
        <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
        <div className="flex flex-col gap-3 items-center">
          <Button onClick={() => navigate("/login")}>Go to sign in</Button>
          <button
            onClick={() => navigate("/apply")}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Apply for beta access
          </button>
        </div>
      </div>
    </div>
  );
}
