/**
 * McInviteBanner — thin persistent banner for SC users who have no MC yet.
 *
 * Show conditions (all must be true):
 *   - User is self_care role
 *   - Portal is active (billing complete)
 *   - No primary_family user exists in the portal
 *   - Account created within last 14 days
 *   - mcBannerSnoozedUntil is null or in the past
 *
 * Dismiss: X snoozes for 24 hours. Auto-retires when MC joins or 14-day window passes.
 * Invite: inline Sheet — email input + Send invite, same flow as ClientPortal MC invite.
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useApp } from "@/App";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, UserPlus, Mail, CheckCircle2, Shield } from "lucide-react";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export default function McInviteBanner() {
  const { activeUser, selectedClientId, mcBannerSnoozedUntil, setMcBannerSnoozedUntil } = useApp();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  // Fetch portal users to detect if an MC already exists
  const { data: portalUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/clients", selectedClientId, "users"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/users`).then(r => r.json()),
    enabled: !!selectedClientId && activeUser.role === "self_care",
  });

  // ── Visibility logic ─────────────────────────────────────────────────────
  if (activeUser.role !== "self_care") return null;

  const hasMc = portalUsers.some((u: any) => u.role === "primary_family");
  if (hasMc) return null;

  // 14-day window from onboarding completion (use createdAt fallback)
  const anchorDate = (activeUser as any).onboardingCompletedAt || null;
  if (anchorDate) {
    const elapsed = Date.now() - new Date(anchorDate).getTime();
    if (elapsed > FOURTEEN_DAYS_MS) return null;
  }

  // Snooze check
  if (mcBannerSnoozedUntil && new Date(mcBannerSnoozedUntil) > new Date()) return null;

  // ── Mutations ────────────────────────────────────────────────────────────
  const snoozeMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/users/me/snooze-mc-banner"),
    onSuccess: (res) => {
      res.json().then((data: any) => {
        if (data.mcBannerSnoozedUntil) setMcBannerSnoozedUntil(data.mcBannerSnoozedUntil);
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (inviteEmail: string) =>
      apiRequest("POST", "/api/invite/create", {
        inviteType: "self_care_to_mc",
        recipientEmail: inviteEmail,
        clientId: selectedClientId,
      }).then(r => r.json()),
    onSuccess: () => {
      setSent(true);
      setEmail("");
      toast({ title: "Invitation sent", description: "They'll receive an email to join your portal." });
      setTimeout(() => setSheetOpen(false), 2000);
    },
    onError: (e: any) => {
      toast({ title: "Could not send invite", description: e?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  return (
    <>
      {/* ── Thin banner ── */}
      <div className="w-full bg-teal-600 dark:bg-teal-700 px-4 py-2 flex items-center gap-3">
        <Shield size={14} className="text-white/80 shrink-0" />
        <p className="flex-1 text-sm text-white leading-snug">
          <span className="font-semibold">Add a Main Contact</span>
          <span className="text-white/85"> — someone to monitor your portal and support your care.</span>
        </p>
        <button
          onClick={() => setSheetOpen(true)}
          className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full bg-white text-teal-700 hover:bg-teal-50 transition-colors"
        >
          Invite
        </button>
        <button
          onClick={() => snoozeMutation.mutate()}
          className="shrink-0 text-white/70 hover:text-white transition-colors"
          aria-label="Dismiss for today"
        >
          <X size={15} />
        </button>
      </div>

      {/* ── Invite sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950/50 flex items-center justify-center shrink-0">
                <UserPlus size={15} className="text-teal-600 dark:text-teal-400" />
              </div>
              <SheetTitle className="text-base">Invite a Main Contact</SheetTitle>
            </div>
          </SheetHeader>

          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            A Main Contact can view your care record, communicate with your care team, and step in when you need backup — but you stay fully in control.
          </p>

          {sent ? (
            <div className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 py-2">
              <CheckCircle2 size={16} />
              <span>Invitation sent — waiting for them to accept.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Their email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && email.trim()) inviteMutation.mutate(email.trim()); }}
                    className="w-full h-10 pl-8 pr-3 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => { if (email.trim()) inviteMutation.mutate(email.trim()); }}
                  disabled={inviteMutation.isPending || !email.trim()}
                  className="h-10 px-5 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors disabled:opacity-50 shrink-0"
                >
                  {inviteMutation.isPending ? "Sending…" : "Send invite"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If they already have a Care Net Portal account, they will be connected immediately. If not, they will receive an email to create one.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
