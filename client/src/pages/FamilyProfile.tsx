/**
 * FamilyProfile — personal profile page for Main Contact and Secondary Family members.
 *
 * Accessible from the profile pill/dropdown on mobile and the sidebar user menu.
 * Lets family members manage:
 *  - Their own name, phone, email display
 *  - Relationship to the client
 *  - Notification preferences (in-app + email)
 *  - Emergency contact designation
 *  - Time zone / language preference
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useApp } from "@/App";
import { useLang } from "@/lib/useLang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  User, Phone, Mail, Heart, Bell, BellOff, Shield,
  Pencil, Check, X, ChevronRight, Users, Home,
  Clock, Globe, Star, Info, UserPlus, ChevronDown, Plus, ArrowRight
} from "lucide-react";
import FamilyInviteSheet from "@/components/FamilyInviteSheet";
import { THEME_CONFIG } from "@/lib/portalThemes";
import type { User as UserType } from "@shared/schema";

// ── Timezone options ─────────────────────────────────────────────────────────
const TIMEZONES = [
  { label: "Eastern Time (ET)",   value: "America/New_York" },
  { label: "Central Time (CT)",   value: "America/Chicago" },
  { label: "Mountain Time (MT)",  value: "America/Denver" },
  { label: "Pacific Time (PT)",   value: "America/Los_Angeles" },
  { label: "Alaska Time (AKT)",   value: "America/Anchorage" },
  { label: "Hawaii Time (HT)",    value: "Pacific/Honolulu" },
];

// ── Relationship options ──────────────────────────────────────────────────────
const RELATIONSHIP_OPTIONS = [
  "Myself", "Spouse / Partner", "Adult Child", "Parent", "Sibling",
  "Grandchild", "Niece / Nephew", "Close Friend", "Other Family Member", "Guardian",
];

// ── Notification preference rows ─────────────────────────────────────────────
const NOTIF_OPTIONS = [
  { key: "schedule_changes", label: "Schedule changes", desc: "When shifts are added, modified, or removed" },
  { key: "care_log_entries", label: "New care log entries", desc: "When the caregiver posts a care log update" },
  { key: "messages", label: "New messages", desc: "When a message is sent to you" },
  { key: "vitals", label: "Vital sign alerts", desc: "When vitals are logged or flagged" },
  { key: "medications", label: "Medication updates", desc: "When medication info is changed" },
  { key: "media", label: "New photos & videos", desc: "When media is shared in the portal" },
];

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ── Editable field ────────────────────────────────────────────────────────────
function EditableField({
  label, value, onSave, type = "text", icon: Icon,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  type?: string;
  icon: React.ElementType;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleSave() {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={15} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <Input
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            />
            <button onClick={handleSave} className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors" aria-label="Save">
              <Check size={14} />
            </button>
            <button onClick={handleCancel} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors" aria-label="Cancel">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-foreground truncate">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
            <button onClick={() => { setDraft(value); setEditing(true); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0" aria-label={`Edit ${label}`}>
              <Pencil size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FamilyProfile() {
  const { activeUser, isRealSession, hasMultiplePortals, returnToCareHome, switchPortal, isTemporarilyElevated } = useApp();
  const { toast } = useToast();

  // ── Fetch user data ──────────────────────────────────────────────────────────
  const { data: userData } = useQuery<UserType>({
    queryKey: ["/api/users", activeUser.id],
    queryFn: () => apiRequest("GET", `/api/users/${activeUser.id}`).then(r => r.json()),
    enabled: isRealSession,
  });

  // ── Portals query (MC only) ────────────────────────────────────────
  interface PortalEntry { clientId: number; clientName: string; colorTheme: string; isPrimary: boolean; role: string; }
  const { data: portals = [] } = useQuery<PortalEntry[]>({
    queryKey: ["/api/me/portals"],
    queryFn: () => apiRequest("GET", "/api/me/portals").then(r => r.json()),
    enabled: isRealSession && activeUser.role === "primary_family",
  });

  const user = isRealSession ? userData : activeUser;

  // Parse notification prefs
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    try {
      const raw = (user as any)?.notificationPrefs;
      if (!raw) return { all: true, ...Object.fromEntries(NOTIF_OPTIONS.map(o => [o.key, true])) };
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed.all) return Object.fromEntries(NOTIF_OPTIONS.map(o => [o.key, true]));
      return parsed;
    } catch {
      return Object.fromEntries(NOTIF_OPTIONS.map(o => [o.key, true]));
    }
  });

  // Local editable state for demo mode
  const [localName, setLocalName] = useState(activeUser.name);
  const [localPhone, setLocalPhone] = useState((activeUser as any).phone ?? "");
  const isSelfCare = activeUser.role === "self_care";
  const [relationship, setRelationship] = useState(isSelfCare ? "Myself" : "Adult Child");
  const [primaryContact, setPrimaryContact] = useState(activeUser.role === "primary_family");

  // ── Update mutation ──────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (patch: Partial<UserType>) =>
      apiRequest("PATCH", `/api/users/${activeUser.id}`, patch).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", activeUser.id] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: () => toast({ title: "Could not save", description: "Please try again.", variant: "destructive" }),
  });

  // Notif prefs mutation
  const notifMutation = useMutation({
    mutationFn: (prefs: Record<string, boolean>) =>
      apiRequest("PATCH", `/api/users/${activeUser.id}`, { notificationPrefs: JSON.stringify(prefs) }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users", activeUser.id] }),
  });

  function handleNotifToggle(key: string, val: boolean) {
    const next = { ...notifPrefs, [key]: val, all: false };
    setNotifPrefs(next);
    if (isRealSession) notifMutation.mutate(next);
  }

  function handleSaveField(field: string, value: string) {
    if (field === "name") setLocalName(value);
    if (field === "phone") setLocalPhone(value);
    if (isRealSession) updateMutation.mutate({ [field]: value } as any);
    else toast({ title: "Demo mode", description: "Changes are local only in demo mode." });
  }

  const isMC = activeUser.role === "primary_family";
  const isFamilyPrimary = isMC || isTemporarilyElevated;
  const [inviteOpen, setInviteOpen] = useState(false);

  // ── Delegation UI state (MC only) ─────────────────────────────────────────
  interface DelegateEntry { userId: number; name: string; email: string; elevatedUntil: string | null; }
  const { data: delegates = [], refetch: refetchDelegates } = useQuery<DelegateEntry[]>({
    queryKey: ["/api/me/delegates"],
    queryFn: () => apiRequest("GET", "/api/me/delegates").then(r => r.json()),
    enabled: isRealSession && isMC,
  });
  const [delegateExpiry, setDelegateExpiry] = useState<Record<number, string>>({});
  const delegateMutation = useMutation({
    mutationFn: ({ userId, until }: { userId: number; until: string }) =>
      apiRequest("POST", "/api/me/delegate", { userId, elevatedUntil: until }).then(r => r.json()),
    onSuccess: () => { refetchDelegates(); toast({ title: "Access granted", description: "Temporary access has been set." }); },
    onError: () => toast({ title: "Could not save", description: "Please try again.", variant: "destructive" }),
  });
  const revokeMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest("DELETE", `/api/me/delegate/${userId}`).then(r => r.json()),
    onSuccess: () => { refetchDelegates(); toast({ title: "Access revoked", description: "Temporary access has been removed." }); },
    onError: () => toast({ title: "Could not revoke", description: "Please try again.", variant: "destructive" }),
  });

  // ── Language & Timezone ───────────────────────────────────────────────────
  const { lang, setLang } = useLang();
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      const raw = (user as any)?.notificationPrefs;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
      return parsed.timezone ?? "America/Chicago";
    } catch { return "America/Chicago"; }
  });

  function handleTimezoneChange(tz: string) {
    setTimezone(tz);
    if (isRealSession) {
      try {
        const raw = (userData as any)?.notificationPrefs;
        const existing = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
        updateMutation.mutate({ notificationPrefs: JSON.stringify({ ...existing, timezone: tz }) } as any);
      } catch {
        updateMutation.mutate({ notificationPrefs: JSON.stringify({ timezone: tz }) } as any);
      }
    }
  }
  const displayName = isRealSession ? (userData?.name ?? activeUser.name) : localName;
  const displayPhone = isRealSession ? ((userData as any)?.phone ?? "") : localPhone;
  const displayEmail = isRealSession ? (activeUser as any).email ?? "" : "demo@carenet.app";
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 pb-24">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary text-lg font-bold shrink-0"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          {initials}
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            {displayName}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn(
              "text-[11px] font-medium px-2 py-0.5 rounded-full",
              isMC
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-muted text-muted-foreground border border-border"
            )}>
              {isMC ? "Main Contact" : "Family Member"}
            </span>
            {isMC && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <Star size={11} className="fill-amber-500" /> Primary
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Contact Info ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Contact Information</h2>
        </div>
        <div className="px-5">
          <EditableField label="Full Name" value={displayName} onSave={v => handleSaveField("name", v)} icon={User} />
          <EditableField label="Phone Number" value={displayPhone} onSave={v => handleSaveField("phone", v)} type="tel" icon={Phone} />
          <div className="flex items-start gap-3 py-3.5 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Mail size={15} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Email</p>
              <p className="text-sm text-foreground truncate">{displayEmail}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">To change email, contact support</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Relationship to Client ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Care Relationship</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Relationship to Care Recipient</p>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIP_OPTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => setRelationship(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    relationship === r
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Primary contact toggle — visible to MC only */}
          {isMC && (
            <div className="flex items-start justify-between gap-4 pt-2 border-t border-border">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield size={14} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Primary Decision Maker</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Designated as the main contact for care decisions and caregiver communication.
                  </p>
                </div>
              </div>
              <Toggle checked={primaryContact} onChange={setPrimaryContact} />
            </div>
          )}
        </div>
      </div>

      {/* ── Notification Preferences ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Notification Preferences</h2>
          <button
            onClick={() => {
              const allOn = NOTIF_OPTIONS.every(o => notifPrefs[o.key]);
              const next = Object.fromEntries(NOTIF_OPTIONS.map(o => [o.key, !allOn]));
              setNotifPrefs(next);
              if (isRealSession) notifMutation.mutate(next);
            }}
            className="text-[11px] text-primary hover:underline"
          >
            {NOTIF_OPTIONS.every(o => notifPrefs[o.key]) ? "Turn off all" : "Turn on all"}
          </button>
        </div>
        <div className="px-5 divide-y divide-border">
          {NOTIF_OPTIONS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3.5">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  {notifPrefs[key] ? <Bell size={13} className="text-primary" /> : <BellOff size={13} className="text-muted-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
              <Toggle checked={!!notifPrefs[key]} onChange={v => handleNotifToggle(key, v)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Family Circle ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Your Care Circle</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Everyone connected to this care portal — caregivers and family members — can see updates. You control who has access by managing invitations through the portal.
          </p>

          {/* Invite button — MC only, prominent CTA */}
          {isMC && (
            <button
              onClick={() => setInviteOpen(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-sm text-primary font-medium"
              data-testid="profile-invite-family-btn"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <UserPlus size={14} className="text-primary" />
                </div>
                Invite a family member
              </div>
              <ChevronRight size={14} className="text-primary/60" />
            </button>
          )}

          <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-sm text-foreground font-medium" data-testid="view-care-circle-btn">
            <div className="flex items-center gap-2.5">
              <Users size={15} className="text-primary" />
              View care circle members
            </div>
            <ChevronRight size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Invite sheet */}
      <FamilyInviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />

      {/* ── Account Settings ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Account</h2>
        </div>
        <div className="px-5 divide-y divide-border">

          {/* Language */}
          <div className="flex items-center gap-3 py-3.5">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Globe size={14} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Language</p>
            </div>
            <div className="relative">
              <select
                value={lang}
                onChange={e => setLang(e.target.value as "en" | "es")}
                className="appearance-none bg-muted/50 border border-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="account-lang-select"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Time Zone */}
          <div className="flex items-center gap-3 py-3.5">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Clock size={14} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Time Zone</p>
            </div>
            <div className="relative">
              <select
                value={timezone}
                onChange={e => handleTimezoneChange(e.target.value)}
                className="appearance-none bg-muted/50 border border-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="account-timezone-select"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Portal Access — read-only */}
          <div className="flex items-center gap-3 py-3.5">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Home size={14} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Portal Access</p>
              <p className="text-xs text-muted-foreground">Family Care Portal</p>
            </div>
          </div>

        </div>
      </div>

      {/* ── People I Care For (MC only) ── */}
      {activeUser.role === "primary_family" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">People I Care For</p>
              {portals.length > 0 && (
                <span className="text-xs text-muted-foreground">{portals.length} portal{portals.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Each person you coordinate care for gets their own private portal. You manage them all from one login.
            </p>
          </div>
          <div className="px-5 divide-y divide-border">
            {portals.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">Loading portals…</div>
            ) : (
              portals.map(portal => {
                const theme = THEME_CONFIG[portal.colorTheme] || THEME_CONFIG.teal;
                const initials = portal.clientName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <div key={portal.clientId} className="flex items-center gap-3 py-3.5">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0", theme.accent)}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{portal.clientName}</p>
                        {portal.isPrimary && <Star size={11} className={cn("shrink-0", theme.text)} />}
                      </div>
                      <p className={cn("text-xs font-medium", theme.text)}>{theme.label}</p>
                    </div>
                    {hasMultiplePortals && (
                      <button
                        onClick={() => switchPortal(portal.clientId, portal.colorTheme)}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        Enter <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {/* Add another */}
          <div className="px-5 py-4 border-t border-border">
            <button
              onClick={returnToCareHome}
              className="flex items-start gap-3 w-full text-left group"
              data-testid="profile-add-another-portal"
            >
              <div className="w-8 h-8 rounded-lg border-2 border-dashed border-border group-hover:border-primary flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors">
                <Plus size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">Add another loved one</p>
                <p className="text-xs text-muted-foreground mt-0.5">Caring for a parent, spouse, or sibling? Each person gets their own portal.</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Delegate Access (MC only) ── */}
      {isMC && isRealSession && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-teal-600 shrink-0" />
              <p className="text-sm font-semibold text-foreground">Temporary Access Delegation</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Grant a secondary family member temporary Main Contact access. They can manage schedules, care logs, and communications while you’re away. Access expires automatically. Maximum 90 days.
            </p>
          </div>
          <div className="px-5 divide-y divide-border">
            {delegates.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">No secondary family members connected to this portal yet.</div>
            ) : (
              delegates.map(d => {
                const isActive = d.elevatedUntil && new Date(d.elevatedUntil) > new Date();
                const expiryDisplay = d.elevatedUntil
                  ? new Date(d.elevatedUntil).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                  : null;
                const initials = d.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
                // Max date = today + 90 days
                const maxDate = new Date();
                maxDate.setDate(maxDate.getDate() + 90);
                const maxDateStr = maxDate.toISOString().split("T")[0];
                const todayStr = new Date().toISOString().split("T")[0];
                return (
                  <div key={d.userId} className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950/50 flex items-center justify-center text-teal-700 dark:text-teal-300 text-xs font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.email}</p>
                      </div>
                      {isActive && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0">
                          Active
                        </span>
                      )}
                    </div>

                    {isActive ? (
                      <div className="mt-3 pl-12">
                        <p className="text-xs text-muted-foreground mb-2">Access expires <span className="font-medium text-foreground">{expiryDisplay}</span></p>
                        <button
                          onClick={() => revokeMutation.mutate(d.userId)}
                          disabled={revokeMutation.isPending}
                          className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 transition-colors"
                          data-testid={`revoke-delegate-${d.userId}`}
                        >
                          <X size={12} /> Revoke access
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 pl-12">
                        <label className="text-xs text-muted-foreground block mb-1.5">Set expiry date (up to 90 days)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            min={todayStr}
                            max={maxDateStr}
                            value={delegateExpiry[d.userId] ?? ""}
                            onChange={e => setDelegateExpiry(prev => ({ ...prev, [d.userId]: e.target.value }))}
                            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                            data-testid={`delegate-date-${d.userId}`}
                          />
                          <button
                            onClick={() => {
                              const until = delegateExpiry[d.userId];
                              if (!until) { toast({ title: "Pick a date first", variant: "destructive" }); return; }
                              delegateMutation.mutate({ userId: d.userId, until });
                            }}
                            disabled={delegateMutation.isPending || !delegateExpiry[d.userId]}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors disabled:opacity-50"
                            data-testid={`grant-delegate-${d.userId}`}
                          >
                            Grant access
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Info note ── */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
        <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your profile information is only visible to others in your care circle — caregivers and family members connected to this portal. It is never shared publicly.
        </p>
      </div>

    </div>
  );
}
