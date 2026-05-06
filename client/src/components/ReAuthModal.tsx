/**
 * Re-Authentication Modal
 * Shown before sensitive actions: changing medications, sending doctor notes.
 * Verifies current password via /api/auth/reauth.
 * 
 * Usage:
 *   const [showReAuth, setShowReAuth] = useState(false);
 *   <ReAuthModal
 *     open={showReAuth}
 *     onSuccess={() => { setShowReAuth(false); doSensitiveAction(); }}
 *     onCancel={() => setShowReAuth(false)}
 *   />
 *
 * In DEMO_MODE it renders nothing (demo users have no passwords).
 */

import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";

const DEMO_MODE = true; // kept true until real auth is active for all users

interface ReAuthModalProps {
  open: boolean;
  actionLabel?: string; // e.g. "add a medication" — shown in description
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReAuthModal({
  open,
  actionLabel = "continue",
  onSuccess,
  onCancel,
}: ReAuthModalProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // In demo mode, skip re-auth entirely
  if (DEMO_MODE) {
    if (open) {
      // Call success immediately in demo mode
      setTimeout(() => onSuccess(), 0);
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reauth", { password });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Incorrect password");
      }
      setPassword("");
      onSuccess();
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setPassword("");
      onCancel();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid="dialog-reauth">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4.5 h-4.5 text-primary" />
            </div>
            <DialogTitle className="text-base">Confirm your identity</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            To {actionLabel}, please re-enter your password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="reauth-password">Password</Label>
            <div className="relative">
              <Input
                id="reauth-password"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                autoFocus
                className="pr-10"
                data-testid="input-reauth-password"
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
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={loading}
              data-testid="button-reauth-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !password}
              data-testid="button-reauth-confirm"
            >
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Confirm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
