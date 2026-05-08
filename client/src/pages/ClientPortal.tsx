import { useApp, isCaregiverRole } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, User, CareFlag } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { User as UserIcon, Heart, AlertTriangle, Users, Bell, Edit2, Save, X, Shield, Eye, UserCheck, Flag, CheckCircle2, Star, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import ModuleIntro from "@/components/ModuleIntro";
import FamilyInviteSheet from "@/components/FamilyInviteSheet";

const ROLE_LABELS: Record<string, string> = {
  caregiver: "Caregiver",
  primary_family: "Main Contact",
  secondary_family: "Family Member",
};

const ROLE_COLORS: Record<string, string> = {
  caregiver: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  primary_family: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  secondary_family: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function ClientPortalPage() {
  const { activeUser, selectedClientId } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  // ── Invite Family Member sheet (MC only) ──────────────────────────────────────
  const [familyInviteOpen, setFamilyInviteOpen] = useState(false);

  const [editingClient, setEditingClient] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [excuseFlagId, setExcuseFlagId] = useState<number | null>(null);
  const [excuseNote, setExcuseNote] = useState("");

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients", selectedClientId],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}`).then(r => r.json()),
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users").then(r => r.json()),
  });

  const familyMembers = allUsers.filter(u => u.clientId === selectedClientId);
  const caregiver = allUsers.find(u => u.clientId === selectedClientId && (u.role === "caregiver" || u.role === "multi_caregiver"));

  // Rating score query
  const { data: ratingData } = useQuery<{ score: number }>({
    queryKey: ["/api/rating", selectedClientId, caregiver?.id],
    queryFn: () => caregiver
      ? apiRequest("GET", `/api/clients/${selectedClientId}/caregivers/${caregiver.id}/rating`).then(r => r.json())
      : Promise.resolve({ score: 100 }),
    enabled: !!caregiver,
  });

  // Care flags query
  const { data: careFlags = [], isLoading: flagsLoading } = useQuery<CareFlag[]>({
    queryKey: ["/api/clients", selectedClientId, "flags"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/flags`).then(r => r.json()),
  });

  const excuseFlagMutation = useMutation({
    mutationFn: ({ flagId, note }: { flagId: number; note: string }) =>
      apiRequest("POST", `/api/flags/${flagId}/excuse`, { excuseNote: note, excusedByUserId: activeUser.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "flags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rating", selectedClientId, caregiver?.id] });
      setExcuseFlagId(null);
      setExcuseNote("");
      toast({ title: "Flag excused", description: "The flag has been excused and will not affect the rating." });
    },
    onError: () => toast({ title: "Error", description: "Could not excuse flag.", variant: "destructive" }),
  });

  const score = ratingData?.score ?? 100;
  const scoreColor = score >= 90 ? "text-emerald-600 dark:text-emerald-400" : score >= 75 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const scoreBg = score >= 90 ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900" : score >= 75 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900" : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900";
  const scoreLabel = score >= 90 ? t("portal.ratingExcellent") : score >= 75 ? t("portal.ratingGood") : t("portal.ratingAttention");

  // Hearts out of 5 (public badge)
  const hearts = Math.round((score / 100) * 5 * 10) / 10;

  const activeFlags = careFlags.filter(f => !f.isExcused);
  const yellowFlags = activeFlags.filter(f => f.flagType === "yellow");
  const redFlags = activeFlags.filter(f => f.flagType === "red");
  const excusedFlags = careFlags.filter(f => f.isExcused);

  const isPrimaryFC = activeUser.role === "primary_family";
  const canManageFlags = isPrimaryFC;

  const updateClientMutation = useMutation({
    mutationFn: (data: Partial<Client>) => apiRequest("PATCH", `/api/clients/${selectedClientId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId] });
      setEditingClient(false);
      toast({ title: "Profile updated" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) => apiRequest("PATCH", `/api/users/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
  });

  const canEdit = activeUser.role === "caregiver";

  if (clientLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  const allergies: string[] = client?.allergies ? JSON.parse(client.allergies) : [];

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 w-full overflow-x-hidden">
      <ModuleIntro moduleKey="client-portal" />
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0">
          <UserIcon size={20} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("portal.title")}</h1>
          <p className="text-xs text-muted-foreground truncate">Profile · Family access · Contacts</p>
        </div>
      </div>

      {/* Client Info Card */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <UserIcon size={16} /> Client Information
            </CardTitle>
            {canEdit && !editingClient && (
              <Button variant="ghost" size="sm" onClick={() => { setEditingClient(true); setEditForm(client || {}); }} className="gap-1.5 h-8" data-testid="edit-client-btn">
                <Edit2 size={13} /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!editingClient ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Full Name</div>
                <div className="text-sm font-medium">{client?.name}</div>
              </div>
              {client?.dateOfBirth && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Date of Birth</div>
                  <div className="text-sm">{new Date(client.dateOfBirth).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</div>
                </div>
              )}
              {client?.primaryCondition && (
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Primary Condition</div>
                  <div className="text-sm">{client.primaryCondition}</div>
                </div>
              )}
              {allergies.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle size={11} className="text-red-500" /> Allergies & Contraindications
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allergies.map(a => (
                      <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900 font-medium">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {client?.notes && (
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Care Notes</div>
                  <div className="text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg">{client.notes}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={editForm.dateOfBirth || ""} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Primary Condition</Label>
                <Input value={editForm.primaryCondition || ""} onChange={e => setEditForm(f => ({ ...f, primaryCondition: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Care Notes</Label>
                <Textarea value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => updateClientMutation.mutate(editForm)} disabled={updateClientMutation.isPending} className="gap-1.5" data-testid="save-client-btn">
                  <Save size={13} /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingClient(false)}>
                  <X size={13} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family Participants */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 justify-between" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <span className="flex items-center gap-2"><Users size={16} /> Care Team & Family</span>
            {isPrimaryFC && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 gap-1.5 text-xs text-primary hover:text-primary"
                onClick={() => setFamilyInviteOpen(true)}
                data-testid="invite-family-btn"
              >
                <UserPlus size={13} /> Invite Family
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : (
            <div className="space-y-3">
              {caregiver && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/50">
                  <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-700 dark:text-teal-400 text-sm font-bold flex-shrink-0">
                    {caregiver.avatarInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{caregiver.name}</div>
                    <div className="text-xs text-muted-foreground">{caregiver.email}</div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", ROLE_COLORS.caregiver)}>
                    {ROLE_LABELS.caregiver}
                  </span>
                </div>
              )}
              {familyMembers.map(member => (
                <div key={member.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {member.avatarInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{member.name}</span>
                      {member.id === client?.primaryContactId && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900">Main Contact</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{member.email}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <NotifToggle label="All updates" userId={member.id} field="all" prefs={member.notificationPrefs} onToggle={(prefs) => updateUserMutation.mutate({ id: member.id, data: { notificationPrefs: prefs } })} />
                      <NotifToggle label="Medications" userId={member.id} field="medications" prefs={member.notificationPrefs} onToggle={(prefs) => updateUserMutation.mutate({ id: member.id, data: { notificationPrefs: prefs } })} />
                      <NotifToggle label="Urgent alerts" userId={member.id} field="alerts" prefs={member.notificationPrefs} onToggle={(prefs) => updateUserMutation.mutate({ id: member.id, data: { notificationPrefs: prefs } })} />
                    </div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full flex-shrink-0", ROLE_COLORS[member.role])}>
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CAREGIVER RATING SCORE ──────────────────────────────────────────── */}
      {caregiver && (
        <Card className={cn("border", scoreBg)} data-testid="rating-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <Star size={16} className={scoreColor} /> {t("portal.caregiverRating")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Score display */}
            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className={cn("text-4xl font-bold", scoreColor)} data-testid="rating-score">
                  {score}%
                </div>
                <div className={cn("text-xs font-medium mt-0.5", scoreColor)}>{scoreLabel}</div>
              </div>
              <div className="flex-1 space-y-2">
                {/* Progress bar */}
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-amber-500" : "bg-red-500")}
                    style={{ width: `${Math.max(0, score)}%` }}
                  />
                </div>
                {/* Hearts preview */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{hearts}</span> / 5
                  <span className="ml-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={i < Math.floor(hearts) ? "text-rose-500" : "text-muted-foreground/30"}>♥</span>
                    ))}
                  </span>
                  <span className="ml-1 text-muted-foreground">{t("portal.publicBadge")}</span>
                </div>
              </div>
            </div>

            {/* Flag summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-background border border-border text-center">
                <div className="text-lg font-bold text-amber-500">{yellowFlags.length}</div>
                <div className="text-xs text-muted-foreground">{t("portal.yellowFlags")}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-background border border-border text-center">
                <div className="text-lg font-bold text-red-500">{redFlags.length}</div>
                <div className="text-xs text-muted-foreground">{t("portal.redFlags")}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-background border border-border text-center">
                <div className="text-lg font-bold text-emerald-500">{excusedFlags.length}</div>
                <div className="text-xs text-muted-foreground">{t("portal.excused")}</div>
              </div>
            </div>

            {/* Formula explanation */}
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
{t("portal.ratingFormula")}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── FLAG RECONCILIATION ─────────────────────────────────────────────── */}
      {(canManageFlags || isCaregiverRole(activeUser.role)) && (
        <Card className="border-border" data-testid="flags-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <Flag size={16} className="text-amber-500" /> {t("portal.careFlags")}
              {activeFlags.length > 0 && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  {activeFlags.length} active
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {flagsLoading ? (
              <div className="space-y-2">{Array(3).fill(0).map((_, i) => <div key={i} className="h-14 bg-muted/40 rounded-xl animate-pulse" />)}</div>
            ) : careFlags.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
                <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t("portal.noFlags")}</div>
                  <div className="text-xs text-muted-foreground">All care tasks are on track for this period.</div>
                </div>
              </div>
            ) : (
              <>
                {/* Red flags first */}
                {redFlags.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Red Flags</div>
                    {redFlags.map(flag => (
                      <div key={flag.id} className="p-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 space-y-1.5" data-testid={`flag-card-${flag.id}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-base flex-shrink-0">🚩</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-red-700 dark:text-red-400 capitalize">{flag.category} — Red Flag</div>
                            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{flag.reason}</div>
                            <div className="text-xs text-muted-foreground mt-1">{new Date(flag.triggeredAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                          </div>
                          {canManageFlags && (
                            <button
                              onClick={() => { setExcuseFlagId(flag.id); setExcuseNote(""); }}
                              className="text-xs text-red-600 hover:text-red-800 border border-red-300 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0"
                              data-testid={`excuse-flag-${flag.id}`}
                            >
                              Excuse
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Yellow flags */}
                {yellowFlags.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Yellow Flags</div>
                    {yellowFlags.map(flag => (
                      <div key={flag.id} className="p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 space-y-1.5" data-testid={`flag-card-${flag.id}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-base flex-shrink-0">🟡</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-amber-700 dark:text-amber-400 capitalize">{flag.category}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{flag.reason}</div>
                            <div className="text-xs text-muted-foreground mt-1">{new Date(flag.triggeredAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                          </div>
                          {canManageFlags && (
                            <button
                              onClick={() => { setExcuseFlagId(flag.id); setExcuseNote(""); }}
                              className="text-xs text-amber-600 hover:text-amber-800 border border-amber-300 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors flex-shrink-0"
                              data-testid={`excuse-flag-${flag.id}`}
                            >
                              Excuse
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Excused flags */}
                {excusedFlags.length > 0 && (
                  <details className="group">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1.5 py-1">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      {excusedFlags.length} excused flag{excusedFlags.length !== 1 ? "s" : ""} (not counted)
                    </summary>
                    <div className="mt-2 space-y-2">
                      {excusedFlags.map(flag => (
                        <div key={flag.id} className="p-3 rounded-xl border border-border bg-muted/20 opacity-70">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium capitalize">{flag.category} — excused</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{flag.excuseNote}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}

            {!canManageFlags && isCaregiverRole(activeUser.role) && (
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
{t("portal.flagsReviewedBy")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Excuse Flag Dialog */}
      {excuseFlagId !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                <Flag size={16} className="text-amber-600" />
              </div>
              <div>
                <div className="font-semibold">{t("portal.excuseFlag")}</div>
                <div className="text-xs text-muted-foreground">This flag will be removed from the rating calculation.</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("portal.excuseNote")} <span className="text-red-500">*</span></Label>
              <Textarea
                value={excuseNote}
                onChange={e => setExcuseNote(e.target.value)}
                placeholder="e.g. Appointment was rescheduled by the doctor's office."
                rows={3}
                data-testid="excuse-note-input"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setExcuseFlagId(null); setExcuseNote(""); }}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={!excuseNote.trim() || excuseFlagMutation.isPending}
                onClick={() => excuseFlagMutation.mutate({ flagId: excuseFlagId, note: excuseNote })}
                data-testid="confirm-excuse-btn"
              >
                {excuseFlagMutation.isPending ? "Saving..." : t("portal.excuseConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Family Member Sheet (MC only) — shared component */}
      <FamilyInviteSheet open={familyInviteOpen} onOpenChange={setFamilyInviteOpen} />

      {/* Access Level Info */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <Shield size={16} /> Access Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { role: "caregiver", icon: Shield, desc: "Full access: log activities, manage schedule, all communications, media, archive. Can open and close chat threads." },
              { role: "primary_family", icon: UserCheck, desc: "Full read access: all updates, schedule, care log, messages, media, archive summaries. Can send messages and manage accountability settings." },
              { role: "secondary_family", icon: Eye, desc: "Limited access: receives updates per notification preferences. Can view shared content and send messages." },
            ].map(({ role, icon: Icon, desc }) => (
              <div key={role} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", ROLE_COLORS[role])}>
                  <Icon size={14} />
                </div>
                <div>
                  <div className="text-sm font-medium">{ROLE_LABELS[role]}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NotifToggle({ label, userId, field, prefs, onToggle }: {
  label: string; userId: number; field: string; prefs: string | null;
  onToggle: (newPrefs: string) => void;
}) {
  const parsed = prefs ? JSON.parse(prefs) : {};
  const checked = parsed[field] === true;

  const handleChange = () => {
    const newPrefs = { ...parsed, [field]: !checked };
    onToggle(JSON.stringify(newPrefs));
  };

  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <Switch checked={checked} onCheckedChange={handleChange} className="scale-75" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </label>
  );
}
