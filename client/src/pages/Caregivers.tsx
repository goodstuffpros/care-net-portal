import { useApp, isCaregiverRole } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { UserPlus, Shield, Clock, Users, CalendarClock, CheckCircle2, AlertCircle, Link2, Mail, Copy, Check, Search, UserCheck, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LessonLauncher } from "@/components/LessonLauncher";

const ROLE_LABELS: Record<string, string> = {
  caregiver: "Primary Caregiver",
  multi_caregiver: "Care Team Member",
  temp_caregiver: "Temporary Caregiver",
  primary_family: "Main Contact",
  secondary_family: "Secondary Family Member",
  facilitator: "Primary Facilitator",
};

const ROLE_COLORS: Record<string, string> = {
  caregiver: "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  multi_caregiver: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  temp_caregiver: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  caregiver: "Full access. Primary point of care.",
  multi_caregiver: "Full access. Part of regular care rotation.",
  temp_caregiver: "Temporary access for a defined period. All care tools available.",
};

export default function CaregiversPage() {
  const { activeUser, selectedClientId, appMode } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteTab, setInviteTab] = useState<"new" | "existing">("existing");
  const [findEmail, setFindEmail] = useState("");
  const [foundUser, setFoundUser] = useState<{ userId: number; name: string; avatarInitials: string; role: string } | null>(null);
  const [findStatus, setFindStatus] = useState<"idle" | "searching" | "not_found" | "not_caregiver" | "found" | "sent">("idle");
  const canManage = activeUser.role === "caregiver" || activeUser.role === "facilitator";
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";

  // Invite type: CG invites MC, MC invites CG or family
  const inviteType = (activeUser.role === "primary_family" || activeUser.role === "secondary_family")
    ? "mc_to_caregiver"
    : "caregiver_to_mc";
  const inviteLabel = inviteType === "caregiver_to_mc" ? "Family Contact (MC)" : "Caregiver";

  const createInviteMutation = useMutation({
    mutationFn: (email?: string) => apiRequest("POST", "/api/invite/create", {
      inviteType,
      invitedEmail: email || undefined,
    }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.token) {
        const link = `${window.location.origin}/#/invite/${data.token}`;
        setInviteLink(link);
      }
      if (inviteEmail) {
        toast({ title: "Invite sent!", description: `An email with the invite link was sent to ${inviteEmail}.` });
        setInviteEmail("");
      }
    },
    onError: () => toast({ title: "Could not create invite", description: "Please try again.", variant: "destructive" }),
  });

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with your contact to get started." });
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function handleFindOnCNP() {
    if (!findEmail.trim()) return;
    setFindStatus("searching");
    setFoundUser(null);
    try {
      // CG looks for family, MC looks for caregiver
      const lookingFor = isFamily ? "caregiver" : "family";
      const res = await apiRequest("GET", `/api/users/lookup-by-email?email=${encodeURIComponent(findEmail.trim())}&lookingFor=${lookingFor}`);
      const data = await res.json();
      if (data.found) {
        setFoundUser(data);
        setFindStatus("found");
      } else if (data.wrongRole) {
        setFindStatus("not_caregiver");
      } else {
        setFindStatus("not_found");
      }
    } catch {
      setFindStatus("not_found");
    }
  }

  const directConnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/invite/direct-connect", {
      targetEmail: findEmail.trim(),
      targetUserId: foundUser!.userId,
      inviteType: inviteType, // 'caregiver_to_mc' for CG, 'mc_to_caregiver' for family
    }).then(r => r.json()),
    onSuccess: () => {
      setFindStatus("sent");
      toast({ title: "Connection request sent!", description: `${foundUser?.name} will receive an email to accept your connection.` });
    },
    onError: () => toast({ title: "Could not send request", description: "Please try again.", variant: "destructive" }),
  });

  function handleOpenInvite() {
    setInviteLink("");
    setInviteEmail("");
    setCopied(false);
    setFindEmail("");
    setFoundUser(null);
    setFindStatus("idle");
    setInviteTab("existing"); // both CG and MC default to "already on CNP"
    setInviteOpen(true);
    // Don't pre-generate on open — link is generated when user switches to "New to CNP" tab
  }

  const [form, setForm] = useState({
    name: "", email: "", phone: "", role: "multi_caregiver",
    tempAccessStart: "", tempAccessEnd: "", tempAccessReason: "vacation",
  });

  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users").then(r => r.json()),
  });

  const caregivers = allUsers.filter(u =>
    u.clientId === selectedClientId &&
    ["caregiver","multi_caregiver","temp_caregiver"].includes(u.role)
  );

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/users", {
      ...form,
      clientId: selectedClientId,
      avatarInitials: form.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
      notificationPrefs: '{"all":true}',
      isActive: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddOpen(false);
      setForm({ name: "", email: "", phone: "", role: "multi_caregiver", tempAccessStart: "", tempAccessEnd: "", tempAccessReason: "vacation" });
      toast({ title: "Caregiver added", description: `${form.name} now has access to this client's portal.` });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/users/${id}`, { isActive: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Access removed" });
    },
  });

  const isTemp = form.role === "temp_caregiver";

  function isTempExpired(user: User) {
    if (!user.tempAccessEnd) return false;
    return new Date(user.tempAccessEnd) < new Date();
  }

  function isTempActive(user: User) {
    if (user.role !== "temp_caregiver") return false;
    return !isTempExpired(user);
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6 w-full overflow-x-hidden">
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center flex-shrink-0">
            <Users size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("caregivers.title")}</h1>
            <p className="text-xs text-muted-foreground truncate">Primary · Relief · Temp</p>
          </div>
          <LessonLauncher pageKey="caregivers" />
        </div>
        {(canManage || isFamily) && (
          <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            {!isFamily && (
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 flex-1" data-testid="add-caregiver-btn">
                <UserPlus size={15} /> Add Caregiver
              </Button>
            </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Caregiver Profile</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jane Smith" data-testid="caregiver-name-input" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="555-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Caregiver Type</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger data-testid="caregiver-role-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multi_caregiver">
                        <div>
                          <div className="font-medium">Permanent Caregiver</div>
                          <div className="text-xs text-muted-foreground">Full access, part of regular rotation</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="temp_caregiver">
                        <div>
                          <div className="font-medium">Temporary Caregiver</div>
                          <div className="text-xs text-muted-foreground">Time-limited access (vacation, illness cover)</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isTemp && (
                  <>
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                      Temporary caregivers get full access to all care tools for the duration specified below. Access is automatically removed after the end date.
                    </div>
                    <div className="space-y-1.5">
                      <Label>Reason for Temporary Cover</Label>
                      <Select value={form.tempAccessReason} onValueChange={v => setForm(f => ({ ...f, tempAccessReason: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vacation">Primary caregiver on vacation</SelectItem>
                          <SelectItem value="illness">Primary caregiver ill</SelectItem>
                          <SelectItem value="other">Other reason</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Access Start</Label>
                        <Input type="date" value={form.tempAccessStart} onChange={e => setForm(f => ({ ...f, tempAccessStart: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Access End</Label>
                        <Input type="date" value={form.tempAccessEnd} onChange={e => setForm(f => ({ ...f, tempAccessEnd: e.target.value }))} />
                      </div>
                    </div>
                  </>
                )}

                <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.name || !form.email || (isTemp && !form.tempAccessEnd) || addMutation.isPending} data-testid="save-caregiver-btn">
                  {addMutation.isPending ? "Adding..." : "Add to Care Team"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Invite button — always show for family, conditionally for CG */}
          <Button size="sm" variant={isFamily ? "default" : "outline"} className="gap-2 flex-1" onClick={handleOpenInvite} data-testid="invite-connection-btn">
            <Link2 size={15} /> {isFamily ? "Invite a Caregiver" : "Invite"}
          </Button>
          </div>
        )}
      </div>

      {/* Invite Sheet */}
      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-10">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Link2 size={16} className="text-primary" />
              Invite a {inviteLabel}
            </SheetTitle>
          </SheetHeader>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-5">
            <button
              type="button"
              onClick={() => { setInviteTab("existing"); }}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
                inviteTab === "existing"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="invite-tab-existing"
            >
              Already on CNP
            </button>
            <button
              type="button"
              onClick={() => { setInviteTab("new"); if (!inviteLink) createInviteMutation.mutate(undefined); }}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
                inviteTab === "new"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="invite-tab-new"
            >
              New to CNP
            </button>
          </div>

          {/* Tab: Already on CNP — find by email + direct connect */}
          {inviteTab === "existing" && (
            <div className="space-y-4">
              {findStatus !== "sent" ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Enter the email address {isFamily ? "your caregiver" : "the family contact"} uses for their Care Net Portal account. We'll find them and send a connection request directly.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{isFamily ? "Caregiver's" : "Family contact's"} CNP email</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        value={findEmail}
                        onChange={e => { setFindEmail(e.target.value); setFindStatus("idle"); setFoundUser(null); }}
                        onKeyDown={e => e.key === "Enter" && handleFindOnCNP()}
                        className="flex-1"
                        data-testid="find-cnp-email-input"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0 gap-1.5"
                        onClick={handleFindOnCNP}
                        disabled={!findEmail.trim() || findStatus === "searching"}
                        data-testid="find-cnp-btn"
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
                        <div className="text-xs text-muted-foreground">{isFamily ? "Care Net Portal caregiver" : "Care Net Portal family contact"}</div>
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5 flex-shrink-0"
                        onClick={() => directConnectMutation.mutate()}
                        disabled={directConnectMutation.isPending}
                        data-testid="send-direct-connect-btn"
                      >
                        {directConnectMutation.isPending
                          ? "Sending…"
                          : <><Send size={13} /> Connect</>}
                      </Button>
                    </div>
                  )}

                  {findStatus === "not_found" && (
                    <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
                      No CNP account found for that email. They may not be on Care Net Portal yet — use the <button type="button" className="text-primary underline" onClick={() => setInviteTab("new")}>New to CNP</button> tab to send them an invite link.
                    </div>
                  )}

                  {findStatus === "not_caregiver" && (
                    <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
                      That email is registered but not as {isFamily ? "a caregiver" : "a family contact"} account.
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
                  <Button variant="outline" size="sm" onClick={() => setInviteOpen(false)}>Done</Button>
                </div>
              )}
            </div>
          )}

          {/* Tab: New to CNP — shareable link + email */}
          {inviteTab === "new" && (
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
                    onClick={handleCopyLink}
                    disabled={!inviteLink || createInviteMutation.isPending}
                    data-testid="copy-invite-link-btn"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Link expires in 7 days. Anyone with it can join as a {inviteLabel}.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or send by email</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Email row */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email address</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="flex-1"
                    data-testid="invite-email-input"
                  />
                  <Button
                    size="sm"
                    className="flex-shrink-0 gap-1.5"
                    onClick={() => createInviteMutation.mutate(inviteEmail)}
                    disabled={!inviteEmail || createInviteMutation.isPending}
                    data-testid="send-invite-email-btn"
                  >
                    <Mail size={14} /> Send
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {[
          { role: "caregiver", label: "Primary Caregiver" },
          { role: "multi_caregiver", label: "Rotation Caregiver" },
          { role: "temp_caregiver", label: "Temporary" },
        ].map(({ role, label }) => (
          <div key={role} className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border", ROLE_COLORS[role])}>
            <div className="w-1.5 h-1.5 rounded-full bg-current" />
            {label}
          </div>
        ))}
      </div>

      {/* Caregiver List */}
      {isLoading ? (
        <div className="space-y-3">{Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : caregivers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">No caregivers yet</p>
          {canManage && <p className="text-sm mt-1">Add a caregiver profile to expand the care team.</p>}
          {isFamily && (
            <div className="mt-5 space-y-3">
              <p className="text-sm max-w-xs mx-auto">
                Once a caregiver joins Care Net Portal, they'll appear here. Use the button below to send them an invite link.
              </p>
              <Button
                onClick={handleOpenInvite}
                className="gap-2"
                data-testid="empty-state-invite-caregiver-btn"
              >
                <Link2 size={15} /> Invite a Caregiver
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {caregivers.map(user => {
            const expired = isTempExpired(user);
            const tempActive = isTempActive(user);
            return (
              <Card key={user.id} className={cn("border-border", !user.isActive && "opacity-50")} data-testid={`caregiver-card-${user.id}`}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {user.avatarInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{user.name}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", ROLE_COLORS[user.role] || ROLE_COLORS.multi_caregiver)}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                        {!user.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">Inactive</span>}
                        {expired && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900 flex items-center gap-1"><AlertCircle size={10} /> Expired</span>}
                        {tempActive && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 flex items-center gap-1"><Clock size={10} /> Active</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {user.email && <span>{user.email}</span>}
                        {user.phone && <span>{user.phone}</span>}
                      </div>
                      {user.role === "temp_caregiver" && (user.tempAccessStart || user.tempAccessEnd) && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarClock size={12} />
                          <span>
                            {user.tempAccessStart ? new Date(user.tempAccessStart).toLocaleDateString([], { month: "short", day: "numeric" }) : "?"} →{" "}
                            {user.tempAccessEnd ? new Date(user.tempAccessEnd).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "?"}
                            {user.tempAccessReason && <span className="ml-1 text-muted-foreground/70">({user.tempAccessReason})</span>}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[user.role] || ""}</div>
                    </div>
                    {canManage && user.isActive && user.role !== "caregiver" && (
                      <button
                        onClick={() => deactivateMutation.mutate(user.id)}
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors flex-shrink-0"
                        data-testid={`deactivate-caregiver-${user.id}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground mb-1 flex items-center gap-2"><Shield size={14} /> Access Levels</p>
        <ul className="space-y-1 mt-2">
          <li><strong className="text-foreground">Primary Caregiver</strong> — Full access to all tools. Can add/remove other team members.</li>
          <li><strong className="text-foreground">Rotation Caregiver</strong> — Full access to all care tools. Multiple permanent caregivers can be added for 24/7 coverage.</li>
          <li><strong className="text-foreground">Temporary Caregiver</strong> — Full access for a defined period. Used when the primary caregiver is on vacation or ill. Access expires automatically on the end date.</li>
        </ul>
      </div>
    </div>
  );
}
