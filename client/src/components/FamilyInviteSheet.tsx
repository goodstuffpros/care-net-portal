/**
 * FamilyInviteSheet — reusable bottom sheet for MC to invite secondary family members.
 *
 * Two tabs:
 *   "New to CNP"      — generates mc_to_family invite link (copy + email send)
 *   "Already on CNP"  — find existing CNP user by email + direct connect
 *
 * Owns all its own state. Parent only controls open/close.
 * Used by: ClientPortal.tsx (Care Team & Family card), FamilyProfile.tsx (Care Circle section)
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { UserPlus, Copy, Check, Mail, Search, Send, UserCheck } from "lucide-react";

type FindStatus = "idle" | "searching" | "invalid_email" | "not_found" | "not_family" | "found" | "sent";
type FoundUser = { userId: number; name: string; avatarInitials: string; role: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FamilyInviteSheet({ open, onOpenChange }: Props) {
  const { toast } = useToast();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"new" | "existing">("new");

  // ── New-to-CNP state ───────────────────────────────────────────────────────
  const [inviteLink, setInviteLink]   = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [copied, setCopied]           = useState(false);

  // ── Already-on-CNP state ───────────────────────────────────────────────────
  const [findEmail, setFindEmail]     = useState("");
  const [foundUser, setFoundUser]     = useState<FoundUser | null>(null);
  const [findStatus, setFindStatus]   = useState<FindStatus>("idle");

  // ── Reset everything on open ───────────────────────────────────────────────
  function handleOpen(nextOpen: boolean) {
    if (nextOpen) {
      setTab("new");
      setInviteLink("");
      setInviteEmail("");
      setCopied(false);
      setFindEmail("");
      setFoundUser(null);
      setFindStatus("idle");
      // Pre-generate the link right away so it's ready to copy
      createInviteMutation.mutate(undefined);
    }
    onOpenChange(nextOpen);
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createInviteMutation = useMutation({
    mutationFn: (email?: string) =>
      apiRequest("POST", "/api/invite/create", {
        inviteType: "mc_to_family",
        ...(email ? { invitedEmail: email } : {}),
      }).then(r => r.json()),
    onSuccess: (data, email) => {
      if (data.inviteUrl) setInviteLink(data.inviteUrl);
      if (email) {
        toast({ title: "Invite sent!", description: `An invitation was emailed to ${email}.` });
        setInviteEmail("");
      }
    },
    onError: () => toast({ title: "Could not generate invite", variant: "destructive" }),
  });

  const directConnectMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/invite/direct-connect", {
        targetEmail: findEmail.trim(),
        targetUserId: foundUser!.userId,
        inviteType: "mc_to_family",
      }).then(r => r.json()),
    onSuccess: () => {
      setFindStatus("sent");
      toast({
        title: "Connection request sent!",
        description: `${foundUser?.name} will receive an email to accept your connection.`,
      });
    },
    onError: () =>
      toast({ title: "Could not send request", description: "Please try again.", variant: "destructive" }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleCopy() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with your family member to get started." });
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function handleFind() {
    if (!findEmail.trim()) return;
    // Basic email sanity check before hitting the API
    const emailVal = findEmail.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal) && !emailVal.includes("..");
    if (!emailOk) {
      setFindStatus("invalid_email");
      setFoundUser(null);
      return;
    }
    setFindStatus("searching");
    setFoundUser(null);
    try {
      const res = await apiRequest(
        "GET",
        `/api/users/lookup-by-email?email=${encodeURIComponent(findEmail.trim())}&lookingFor=family`,
      );
      const data = await res.json();
      if (data.found) {
        setFoundUser(data);
        setFindStatus("found");
      } else if (data.wrongRole) {
        setFindStatus("not_family");
      } else {
        setFindStatus("not_found");
      }
    } catch {
      setFindStatus("not_found");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-10">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <UserPlus size={16} className="text-primary" />
            Invite a Family Member
          </SheetTitle>
        </SheetHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-5">
          <button
            type="button"
            onClick={() => setTab("existing")}
            className={cn(
              "flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
              tab === "existing"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            data-testid="family-invite-tab-existing"
          >
            Already on CNP
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("new");
              if (!inviteLink) createInviteMutation.mutate(undefined);
            }}
            className={cn(
              "flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
              tab === "new"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            data-testid="family-invite-tab-new"
          >
            New to CNP
          </button>
        </div>

        {/* ── Already on CNP ── */}
        {tab === "existing" && (
          <div className="space-y-4">
            {findStatus !== "sent" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Enter the email address your family member uses for their Care Net Portal account. We'll find them and send a connection request directly.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Family member's CNP email</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={findEmail}
                      onChange={e => {
                        setFindEmail(e.target.value);
                        setFindStatus("idle");
                        setFoundUser(null);
                      }}
                      onKeyDown={e => e.key === "Enter" && handleFind()}
                      className="flex-1"
                      data-testid="family-find-email-input"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 gap-1.5"
                      onClick={handleFind}
                      disabled={!findEmail.trim() || findStatus === "searching"}
                      data-testid="family-find-cnp-btn"
                    >
                      <Search size={14} />
                      {findStatus === "searching" ? "Searching…" : "Find"}
                    </Button>
                  </div>
                </div>

                {findStatus === "found" && foundUser && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                      {foundUser.avatarInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{foundUser.name}</div>
                      <div className="text-xs text-muted-foreground">Care Net Portal family member</div>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 flex-shrink-0"
                      onClick={() => directConnectMutation.mutate()}
                      disabled={directConnectMutation.isPending}
                      data-testid="family-send-connect-btn"
                    >
                      {directConnectMutation.isPending
                        ? "Sending…"
                        : <><Send size={13} /> Connect</>}
                    </Button>
                  </div>
                )}

                {findStatus === "invalid_email" && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-400">
                    That doesn't look like a valid email address — double-check for typos (extra dots, missing @, etc.) and try again.
                  </div>
                )}

                {findStatus === "not_found" && (
                  <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
                    No CNP account found for that email. They may not be on Care Net Portal yet —{" "}
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => setTab("new")}
                    >
                      use the New to CNP tab
                    </button>{" "}
                    to send them an invite link.
                  </div>
                )}

                {findStatus === "not_family" && (
                  <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
                    That email is registered but not as a family member account.
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto">
                  <UserCheck size={22} className="text-green-600 dark:text-green-400" />
                </div>
                <p className="font-semibold text-sm">Request sent to {foundUser?.name}</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  They'll receive an email with a one-tap accept button. Once they accept, you'll both be connected on Care Net Portal.
                </p>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
              </div>
            )}
          </div>
        )}

        {/* ── New to CNP ── */}
        {tab === "new" && (
          <div className="space-y-4">
            {/* Copy link row */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Share this link</Label>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground truncate font-mono">
                  {createInviteMutation.isPending ? "Generating link…" : inviteLink || "—"}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 gap-1.5"
                  onClick={handleCopy}
                  disabled={!inviteLink || createInviteMutation.isPending}
                  data-testid="family-copy-link-btn"
                >
                  {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">or email it directly</span>
              </div>
            </div>

            {/* Email send row */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Family member's email</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e =>
                    e.key === "Enter" &&
                    inviteEmail.trim() &&
                    createInviteMutation.mutate(inviteEmail.trim())
                  }
                  className="flex-1"
                  data-testid="family-invite-email-input"
                />
                <Button
                  size="sm"
                  className="flex-shrink-0 gap-1.5"
                  onClick={() => createInviteMutation.mutate(inviteEmail.trim())}
                  disabled={!inviteEmail.trim() || createInviteMutation.isPending}
                  data-testid="family-send-email-btn"
                >
                  <Mail size={13} />
                  {createInviteMutation.isPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              When they click the link, they'll be taken to a sign-up page pre-set for their role. After setting up their profile they'll have access to the Family Care Portal.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
