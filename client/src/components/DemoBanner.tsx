/**
 * DemoBanner — shown at the top of every page when the logged-in account
 * is the shared demo account (cnpdemo@carenetportal.com).
 *
 * Features:
 * - Warning that entries are visible to other demo users
 * - 30-minute idle timeout countdown — auto-logs out when it hits zero
 * - Reset Demo button (admin-only: goodstuffpros@gmail.com or becky@carenetportal.com)
 * - Idle timer resets on any user interaction
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { apiRequest, clearAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Eye, LogOut, RefreshCw, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const IDLE_MINUTES = 30;
const ADMIN_EMAILS = ["goodstuffpros@gmail.com", "becky@carenetportal.com"];
const DEMO_ADMIN_KEY = "cnp-demo-reset-2026";

interface DemoBannerProps {
  userEmail: string; // logged-in user's email
  onLogout: () => void;
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DemoBanner({ userEmail, onLogout }: DemoBannerProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [secondsLeft, setSecondsLeft] = useState(IDLE_MINUTES * 60);
  const [resetting, setResetting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const isAdmin = ADMIN_EMAILS.includes(userEmail);

  // Reset idle timer on any interaction
  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsLeft(IDLE_MINUTES * 60);
  }, []);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, IDLE_MINUTES * 60 - elapsed);
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(timerRef.current!);
        handleAutoLogout();
      }
    }, 1000);

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleAutoLogout() {
    clearAuthToken();
    try {
      await apiRequest("POST", "/api/auth/logout", {});
    } catch {}
    toast({
      title: "Demo session ended",
      description: "You were logged out after 30 minutes of inactivity.",
    });
    onLogout();
  }

  async function handleManualLogout() {
    clearAuthToken();
    try {
      await apiRequest("POST", "/api/auth/logout", {});
    } catch {}
    onLogout();
  }

  async function handleReset() {
    if (!isAdmin) return;
    setResetting(true);
    try {
      const res = await fetch("/api/admin/demo/seed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-key": DEMO_ADMIN_KEY,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "Demo reset", description: "Donnie Demo's portal has been restored to its original state." });
      // Log out and back to login so admin can re-enter with fresh data
      clearAuthToken();
      try { await apiRequest("POST", "/api/auth/logout", {}); } catch {}
      onLogout();
    } catch (e: any) {
      toast({ title: "Reset failed", description: e.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }

  const urgentCountdown = secondsLeft <= 120; // last 2 minutes — turn red

  return (
    <div className={cn(
      "w-full flex items-center gap-3 px-4 py-2 text-xs font-medium transition-colors",
      urgentCountdown
        ? "bg-red-600 text-white"
        : "bg-amber-500 text-amber-950"
    )}>
      <Eye className="w-3.5 h-3.5 flex-shrink-0" />

      <span className="flex-1 min-w-0 truncate">
        You're viewing a shared demo.{" "}
        <span className="opacity-75">Your entries are visible to others.</span>
        {" — "}
        <a
          href="/#/apply"
          className={cn(
            "underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity",
            urgentCountdown ? "text-white" : "text-amber-950"
          )}
        >
          Ready to try it for real? Apply for access.
        </a>
      </span>

      {/* Countdown */}
      <span className={cn(
        "flex-shrink-0 font-mono tabular-nums text-xs px-2 py-0.5 rounded-full",
        urgentCountdown ? "bg-white/20" : "bg-black/10"
      )}>
        {formatCountdown(secondsLeft)}
      </span>

      {/* Reset (admin only) */}
      {isAdmin && (
        <button
          onClick={handleReset}
          disabled={resetting}
          className={cn(
            "flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors",
            urgentCountdown
              ? "bg-white/20 hover:bg-white/30 text-white"
              : "bg-black/10 hover:bg-black/20 text-amber-950"
          )}
        >
          {resetting
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />}
          Reset Demo
        </button>
      )}

      {/* Log out */}
      <button
        onClick={handleManualLogout}
        className={cn(
          "flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors",
          urgentCountdown
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-black/10 hover:bg-black/20 text-amber-950"
        )}
      >
        <LogOut className="w-3.5 h-3.5" />
        Log out
      </button>
    </div>
  );
}
