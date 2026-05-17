import { useApp, isCaregiverRole } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, User, CareFlag, CareDirectoryEntry } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { User as UserIcon, Heart, AlertTriangle, Users, Bell, Edit2, Save, X, Shield, Eye, UserCheck, Flag, CheckCircle2, Star, UserPlus, Mail, ArrowUpCircle, UserX, ArrowRightCircle, ChevronRight, AlertCircle, BookOpen, Phone, MapPin, Trash2, Plus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonLauncher } from "@/components/LessonLauncher";
import FamilyInviteSheet from "@/components/FamilyInviteSheet";
import ClientListEditor from "@/components/ClientListEditor";

// ── Care Directory constants ────────────────────────────────────────────────
const DIR_TITLES = [
  // Medical / Clinical
  "Primary Care Doctor (GP)",
  "Specialist",
  "Eye Doctor",
  "Dentist",
  "Physical Therapist",
  "Occupational Therapist",
  "Speech Therapist",
  "Pharmacist",
  "Home Health Agency",
  "Hospice / Palliative Care",
  // Personal / Lifestyle
  "Hair Stylist / Barber",
  "Nail Technician",
  "Massage Therapist",
  "Veterinarian",
  // Home & Practical
  "Handyman",
  "Mechanic",
  "Lawn Care",
  // Spiritual / Community
  "Clergy / Pastor",
  "Church / Place of Worship",
  // Social / Relationships
  "Best Friend",
  "Neighbor",
  // Other
  "Other",
] as const;

const SPECIALTIES = [
  "Allergy & Immunology",
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "Geriatrics",
  "Hematology / Oncology",
  "Infectious Disease",
  "Nephrology (Kidney)",
  "Neurology",
  "Ophthalmology (Eye)",
  "Orthopedics",
  "Otolaryngology (ENT)",
  "Palliative Care",
  "Physiatry (Rehab Medicine)",
  "Psychiatry",
  "Pulmonology (Lung)",
  "Rheumatology",
  "Sleep Medicine",
  "Urology",
  "Vascular Surgery",
  "Wound Care",
  "Other",
] as const;

// ── Primary Condition constants (shared with SampleClientModal) ──────────────
const CONDITIONS = [
  "Dementia / Alzheimer's",
  "Parkinson's disease",
  "Stroke recovery",
  "ALS (Lou Gehrig's disease)",
  "Multiple sclerosis",
  "Hip or knee replacement recovery",
  "Heart failure / cardiac care",
  "COPD / respiratory care",
  "Cancer care",
  "Diabetes management",
  "General elderly care",
  "Post-surgical recovery",
  "Traumatic brain injury",
  "Spinal cord injury",
  "Developmental disability",
  "Other",
] as const;

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
  const { activeUser, selectedClientId, isPracticeClient, isShowcaseMode } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  // ── Invite Family Member sheet (MC only) ──────────────────────────────────────
  const [familyInviteOpen, setFamilyInviteOpen] = useState(false);

  // ── Care Directory state ─────────────────────────────────────────────────
  const [directoryDetailEntry, setDirectoryDetailEntry] = useState<CareDirectoryEntry | null>(null);
  const [directoryAddOpen, setDirectoryAddOpen] = useState(false);
  const [directoryEditEntry, setDirectoryEditEntry] = useState<CareDirectoryEntry | null>(null);
  // titleSelect = the dropdown value; specialty = sub-field when Specialist is chosen
  // title (stored/sent) is derived: "Specialist – Neurology" or just titleSelect for others
  const [dirForm, setDirForm] = useState({ titleSelect: "", specialty: "", specialtyOther: "", titleOther: "", name: "", phone: "", email: "", address: "", notes: "" });
  const [dirDeleteConfirm, setDirDeleteConfirm] = useState<number | null>(null);

  // ── In-page tab state ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'overview' | 'medical' | 'care' | 'directory'>('overview');

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

  const familyMembers = allUsers.filter(u => u.clientId === selectedClientId && u.role !== "caregiver" && u.role !== "multi_caregiver" && u.role !== "temp_caregiver");
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

  // ── Care Directory queries & mutations ─────────────────────────────────
  const { data: directoryEntries = [], isLoading: directoryLoading } = useQuery<CareDirectoryEntry[]>({
    queryKey: ["/api/clients", selectedClientId, "directory"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/directory`).then(r => r.json()),
    enabled: !!selectedClientId,
  });

  // Derive the stored title string from form state
  function deriveDirTitle(f: typeof dirForm): string {
    if (f.titleSelect === "Specialist") {
      const spec = f.specialty === "Other" ? (f.specialtyOther.trim() || "Other") : f.specialty;
      return spec ? `Specialist – ${spec}` : "Specialist";
    }
    if (f.titleSelect === "Other") return f.titleOther.trim() || "Other";
    return f.titleSelect;
  }

  const BLANK_DIR_FORM = { titleSelect: "", specialty: "", specialtyOther: "", titleOther: "", name: "", phone: "", email: "", address: "", notes: "" };

  const addDirectoryMutation = useMutation({
    mutationFn: (data: typeof dirForm) => apiRequest("POST", `/api/clients/${selectedClientId}/directory`, { ...data, title: deriveDirTitle(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "directory"] });
      setDirectoryAddOpen(false);
      setDirForm(BLANK_DIR_FORM);
      toast({ title: "Entry added", description: "Care Directory entry saved." });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Could not save entry.", variant: "destructive" }),
  });

  const editDirectoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof dirForm }) =>
      apiRequest("PATCH", `/api/clients/${selectedClientId}/directory/${id}`, { ...data, title: deriveDirTitle(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "directory"] });
      setDirectoryEditEntry(null);
      setDirForm(BLANK_DIR_FORM);
      toast({ title: "Entry updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Could not update entry.", variant: "destructive" }),
  });

  const deleteDirectoryMutation = useMutation({
    mutationFn: (entryId: number) => apiRequest("DELETE", `/api/clients/${selectedClientId}/directory/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "directory"] });
      setDirDeleteConfirm(null);
      setDirectoryDetailEntry(null);
      toast({ title: "Entry removed" });
    },
    onError: () => toast({ title: "Error", description: "Could not delete entry.", variant: "destructive" }),
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
  const isMCViewer = activeUser.role === "primary_family";

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

  const canEdit = activeUser.role === "primary_family" && !isShowcaseMode;

  if (clientLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  // Parse structured medical fields
  type AllergyEntry = { name: string; severity: "mild" | "serious" | "life-threatening" };
  type DiagnosisEntry = { name: string; severity: "managed" | "serious" | "critical"; dateNoted?: string };
  type DeviceEntry = { device: string; notes?: string };

  const allergies: AllergyEntry[] = (() => {
    try {
      const raw = JSON.parse(client?.allergies || "[]");
      // Handle legacy plain string array
      if (typeof raw[0] === "string") return raw.map((s: string) => ({ name: s, severity: "serious" as const }));
      return raw;
    } catch { return []; }
  })();
  const diagnoses: DiagnosisEntry[] = (() => { try { return JSON.parse(client?.diagnoses || "[]"); } catch { return []; } })();
  const assistiveDevices: DeviceEntry[] = (() => { try { return JSON.parse(client?.assistiveDevices || "[]"); } catch { return []; } })();

  const SEVERITY_ALLERGY_COLORS: Record<string, string> = {
    "mild": "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900",
    "serious": "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-900",
    "life-threatening": "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-300 border-red-400 dark:border-red-700 font-bold",
  };
  const SEVERITY_DX_COLORS: Record<string, string> = {
    "managed": "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border-teal-200 dark:border-teal-900",
    "serious": "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200 dark:border-orange-900",
    "critical": "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-900",
  };

  const TABS = [
    { key: 'overview' as const,   label: 'Overview'   },
    { key: 'medical' as const,    label: 'Medical'    },
    { key: 'care' as const,       label: 'Care'       },
    { key: 'directory' as const,  label: 'Directory'  },
  ];

  return (
    <div className="w-full overflow-x-hidden">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-border space-y-2">
        {/* Showcase mode banner */}
        {isPracticeClient && isShowcaseMode && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <span className="text-base">👁</span>
            <div>
              <strong>Showcase View</strong> — Edit controls are hidden. This is what a potential family will see when you share this portal with them.
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <UserIcon size={20} className="text-blue-600 dark:text-blue-400" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("portal.title")}</h1>
          </div>
        </div>
      </div>

      {/* ── In-page tab strip ────────────────────────────────────────────────── */}
      <nav className="flex items-stretch flex-shrink-0 border-b border-border bg-background">
        {TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          const isFamilyPortal = activeUser.role === 'primary_family' || activeUser.role === 'secondary_family' || activeUser.role === 'self_care';
          const accent = isFamilyPortal ? 'rose' : 'teal';
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold tracking-wide transition-colors relative',
                isActive
                  ? accent === 'rose'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-teal-600 dark:text-teal-400'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              data-testid={`profile-tab-${key}`}
            >
              {label}
              {isActive && (
                <span className={cn(
                  'absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full',
                  accent === 'rose' ? 'bg-rose-500' : 'bg-teal-500'
                )} />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-3">
        <LessonLauncher pageKey="client-portal" />
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      <div className="p-4 max-w-4xl mx-auto w-full space-y-6">

      {/* ════════════════════════════════ OVERVIEW TAB ═══════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">

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
        <CardContent className="space-y-5">
          {!editingClient ? (
            <div className="space-y-5">
              {/* MC guidance note */}
              {isMCViewer && (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
                  This page helps your caregiver do their job well. They can see everything here but cannot make changes.
                </div>
              )}
              {/* Basic info */}
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
              </div>

              {/* Primary Condition */}
              {client?.primaryCondition && (
                <div>
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Primary Condition</div>
                  <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-sm font-medium">
                    {client.primaryCondition}
                  </div>
                </div>
              )}

              {/* Diagnoses */}
              {diagnoses.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Diagnoses</div>
                  <div className="space-y-2">
                    {diagnoses.map((d, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                        <div className="text-sm font-medium flex-1">{d.name}</div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {d.dateNoted && <span className="text-xs text-muted-foreground">{new Date(d.dateNoted).toLocaleDateString([], { month: "short", year: "numeric" })}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${SEVERITY_DX_COLORS[d.severity] || SEVERITY_DX_COLORS["managed"]}`}>{d.severity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allergies */}
              {allergies.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={11} className="text-red-500" /> Allergies & Contraindications
                  </div>
                  <div className="space-y-2">
                    {allergies.map((a, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                        <div className="text-sm font-medium">{a.name}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${SEVERITY_ALLERGY_COLORS[a.severity] || SEVERITY_ALLERGY_COLORS["serious"]}`}>{a.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assistive Devices */}
              {assistiveDevices.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Assistive Devices</div>
                  <div className="space-y-2">
                    {assistiveDevices.map((d, i) => (
                      <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                        <div className="text-sm font-medium flex-1">{d.device}</div>
                        {d.notes && <div className="text-xs text-muted-foreground flex-1 text-right">{d.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Care Notes */}
              {client?.notes && (
                <div>
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Care Notes</div>
                  <div className="text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg">{client.notes}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Basic info */}
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

              {/* Primary Condition */}
              <div className="space-y-1.5">
                <Label>Primary Condition</Label>
                {(() => {
                  const val = editForm.primaryCondition || "";
                  const isKnown = CONDITIONS.includes(val as any);
                  const selectVal = isKnown ? val : (val ? "Other" : "");
                  const otherVal = isKnown ? "" : val;
                  return (
                    <div className="space-y-2">
                      <Select
                        value={selectVal}
                        onValueChange={v => setEditForm(f => ({ ...f, primaryCondition: v === "Other" ? "" : v }))}
                      >
                        <SelectTrigger data-testid="edit-condition-select">
                          <SelectValue placeholder="Select primary condition..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITIONS.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectVal === "Other" && (
                        <Input
                          placeholder="Describe condition"
                          value={otherVal}
                          onChange={e => setEditForm(f => ({ ...f, primaryCondition: e.target.value }))}
                          data-testid="edit-condition-other"
                        />
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Diagnoses editor */}
              <ClientListEditor
                label="Diagnoses"
                items={(() => { try { return JSON.parse(editForm.diagnoses || "[]"); } catch { return []; } })()}
                onSave={items => setEditForm(f => ({ ...f, diagnoses: JSON.stringify(items) }))}
                fields={[
                  { key: "name", label: "Diagnosis name", type: "text", required: true },
                  { key: "severity", label: "Severity", type: "select", options: ["managed", "serious", "critical"] },
                  { key: "dateNoted", label: "Date noted", type: "date" },
                ]}
              />

              {/* Allergies editor */}
              <ClientListEditor
                label="Allergies & Contraindications"
                items={(() => { try { const r = JSON.parse(editForm.allergies || "[]"); return typeof r[0] === "string" ? r.map((s: string) => ({ name: s, severity: "serious" })) : r; } catch { return []; } })()}
                onSave={items => setEditForm(f => ({ ...f, allergies: JSON.stringify(items) }))}
                fields={[
                  { key: "name", label: "Allergen or contraindication", type: "text", required: true },
                  { key: "severity", label: "Severity", type: "select", options: ["mild", "serious", "life-threatening"] },
                ]}
              />

              {/* Assistive devices editor */}
              <ClientListEditor
                label="Assistive Devices"
                items={(() => { try { return JSON.parse(editForm.assistiveDevices || "[]"); } catch { return []; } })()}
                onSave={items => setEditForm(f => ({ ...f, assistiveDevices: JSON.stringify(items) }))}
                fields={[
                  { key: "device", label: "Device name", type: "text", required: true },
                  { key: "notes", label: "Notes (optional)", type: "text" },
                ]}
              />

              {/* Care Notes */}
              <div className="space-y-1.5">
                <Label>Care Notes</Label>
                <Textarea value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={() => updateClientMutation.mutate(editForm)} disabled={updateClientMutation.isPending} className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white" data-testid="save-client-btn">
                  <Save size={13} /> Save Changes
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingClient(false)}>
                  <X size={13} /> Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

        </div>
      )}
      {/* ══════════════════════════════════ MEDICAL TAB ══════════════════════ */}
      {activeTab === 'medical' && (
        <div className="space-y-6">
          {/* Diagnoses */}
          <Card className="border-border" data-testid="medical-diagnoses-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  <Heart size={16} className="text-blue-500" /> Diagnoses
                </CardTitle>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingClient(true); setEditForm(client || {}); }} className="gap-1.5 h-8" data-testid="edit-medical-btn">
                    <Edit2 size={13} /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingClient ? (
                <div className="space-y-5">
                  <ClientListEditor
                    label="Diagnoses"
                    items={(() => { try { return JSON.parse(editForm.diagnoses || "[]"); } catch { return []; } })()}
                    onSave={items => setEditForm(f => ({ ...f, diagnoses: JSON.stringify(items) }))}
                    fields={[
                      { key: "name", label: "Diagnosis name", type: "text", required: true },
                      { key: "severity", label: "Severity", type: "select", options: ["managed", "serious", "critical"] },
                      { key: "dateNoted", label: "Date noted", type: "date" },
                    ]}
                  />
                  <ClientListEditor
                    label="Allergies & Contraindications"
                    items={(() => { try { const r = JSON.parse(editForm.allergies || "[]"); return typeof r[0] === "string" ? r.map((s: string) => ({ name: s, severity: "serious" })) : r; } catch { return []; } })()}
                    onSave={items => setEditForm(f => ({ ...f, allergies: JSON.stringify(items) }))}
                    fields={[
                      { key: "name", label: "Allergen or contraindication", type: "text", required: true },
                      { key: "severity", label: "Severity", type: "select", options: ["mild", "serious", "life-threatening"] },
                    ]}
                  />
                  <ClientListEditor
                    label="Assistive Devices"
                    items={(() => { try { return JSON.parse(editForm.assistiveDevices || "[]"); } catch { return []; } })()}
                    onSave={items => setEditForm(f => ({ ...f, assistiveDevices: JSON.stringify(items) }))}
                    fields={[
                      { key: "device", label: "Device name", type: "text", required: true },
                      { key: "notes", label: "Notes (optional)", type: "text" },
                    ]}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateClientMutation.mutate(editForm)} disabled={updateClientMutation.isPending} className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white" data-testid="save-medical-btn">
                      <Save size={13} /> Save Changes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingClient(false)}>
                      <X size={13} /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {diagnoses.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">No diagnoses recorded yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {diagnoses.map((d, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                          <div className="text-sm font-medium flex-1">{d.name}</div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {d.dateNoted && <span className="text-xs text-muted-foreground">{new Date(d.dateNoted).toLocaleDateString([], { month: "short", year: "numeric" })}</span>}
                            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${SEVERITY_DX_COLORS[d.severity] || SEVERITY_DX_COLORS["managed"]}`}>{d.severity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Allergies */}
          {!editingClient && (
            <Card className="border-border" data-testid="medical-allergies-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  <AlertTriangle size={16} className="text-red-500" /> Allergies & Contraindications
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allergies.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">No allergies or contraindications recorded.</div>
                ) : (
                  <div className="space-y-2">
                    {allergies.map((a, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                        <div className="text-sm font-medium">{a.name}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${SEVERITY_ALLERGY_COLORS[a.severity] || SEVERITY_ALLERGY_COLORS["serious"]}`}>{a.severity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assistive Devices */}
          {!editingClient && (
            <Card className="border-border" data-testid="medical-devices-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  <ArrowRightCircle size={16} className="text-slate-500" /> Assistive Devices
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assistiveDevices.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">No assistive devices recorded.</div>
                ) : (
                  <div className="space-y-2">
                    {assistiveDevices.map((d, i) => (
                      <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                        <div className="text-sm font-medium flex-1">{d.device}</div>
                        {d.notes && <div className="text-xs text-muted-foreground flex-1 text-right">{d.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Rating + Flags (MC + CG only) */}
          {caregiver && (
            <Card className={cn("border", scoreBg)} data-testid="rating-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  <Star size={16} className={scoreColor} /> {t("portal.caregiverRating")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <div className={cn("text-4xl font-bold", scoreColor)} data-testid="rating-score">{score}%</div>
                    <div className={cn("text-xs font-medium mt-0.5", scoreColor)}>{scoreLabel}</div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${Math.max(0, score)}%` }} />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{hearts}</span> / 5
                      <span className="ml-1">{Array.from({ length: 5 }).map((_, i) => (<span key={i} className={i < Math.floor(hearts) ? "text-rose-500" : "text-muted-foreground/30"}>♥</span>))}</span>
                      <span className="ml-1 text-muted-foreground">{t("portal.publicBadge")}</span>
                    </div>
                  </div>
                </div>
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
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">{t("portal.ratingFormula")}</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ CARE TAB ════════════════════════ */}
      {activeTab === 'care' && (
        <div className="space-y-6">
          {/* Care Notes */}
          <Card className="border-border" data-testid="care-notes-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  <BookOpen size={16} className="text-teal-600 dark:text-teal-400" /> Care Notes
                </CardTitle>
                {canEdit && !editingClient && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingClient(true); setEditForm(client || {}); }} className="gap-1.5 h-8" data-testid="edit-care-notes-btn">
                    <Edit2 size={13} /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingClient ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Care Notes</Label>
                    <Textarea value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={4} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateClientMutation.mutate(editForm)} disabled={updateClientMutation.isPending} className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white" data-testid="save-care-notes-btn">
                      <Save size={13} /> Save Changes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingClient(false)}>
                      <X size={13} /> Cancel
                    </Button>
                  </div>
                </div>
              ) : client?.notes ? (
                <div className="text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg leading-relaxed">{client.notes}</div>
              ) : (
                <div className="text-sm text-muted-foreground py-2">No care notes recorded yet.{canEdit ? " Tap Edit to add notes about routines, preferences, and care needs." : ""}</div>
              )}
            </CardContent>
          </Card>

          {/* Flag Reconciliation */}
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
                                <button onClick={() => { setExcuseFlagId(flag.id); setExcuseNote(""); }} className="text-xs text-red-600 hover:text-red-800 border border-red-300 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0" data-testid={`excuse-flag-${flag.id}`}>Excuse</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                                <button onClick={() => { setExcuseFlagId(flag.id); setExcuseNote(""); }} className="text-xs text-amber-600 hover:text-amber-800 border border-amber-300 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors flex-shrink-0" data-testid={`excuse-flag-${flag.id}`}>Excuse</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">{t("portal.flagsReviewedBy")}</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════ DIRECTORY TAB ═══════════════════════ */}
      {activeTab === 'directory' && (
        <div className="space-y-6">

      {/* ── CARE DIRECTORY ───────────────────────────────────────────────────── */}
      <Card className="border-border" data-testid="care-directory-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 justify-between" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <span className="flex items-center gap-2"><BookOpen size={16} className="text-teal-600 dark:text-teal-400" /> Care Directory</span>
            {isMCViewer && !isShowcaseMode && (
              <Button
                size="sm"
                className="h-8 px-3 gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => { setDirForm(BLANK_DIR_FORM); setDirectoryAddOpen(true); }}
                data-testid="add-directory-entry-btn"
              >
                <Plus size={13} /> Add Entry
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {directoryLoading ? (
            <div className="space-y-2">{Array(3).fill(0).map((_, i) => <div key={i} className="h-10 bg-muted/40 rounded-xl animate-pulse" />)}</div>
          ) : directoryEntries.length === 0 ? (
            <div className="text-center py-6 space-y-1.5">
              <BookOpen size={22} className="text-muted-foreground/30 mx-auto" />
              <div className="text-sm text-muted-foreground">
                {isMCViewer ? "No contacts added yet. Tap \"Add Entry\" to build your care directory." : "No contacts in this care directory yet."}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2" data-testid="care-directory-list">
              {directoryEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => setDirectoryDetailEntry(entry)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 text-teal-700 dark:text-teal-300 text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-950/50 transition-colors"
                  data-testid={`directory-chip-${entry.id}`}
                >
                  {entry.title}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Directory Detail Sheet */}
      {directoryDetailEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setDirectoryDetailEntry(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4" onClick={e => e.stopPropagation()} data-testid="directory-detail-sheet">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-0.5">{directoryDetailEntry.title}</div>
                {directoryDetailEntry.name && <div className="font-semibold text-base">{directoryDetailEntry.name}</div>}
              </div>
              <button onClick={() => setDirectoryDetailEntry(null)} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                <X size={18} />
              </button>
            </div>

            {/* Tappable fields */}
            <div className="space-y-2.5">
              {directoryDetailEntry.phone && (
                <a href={`tel:${directoryDetailEntry.phone}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors group" data-testid="directory-phone-link">
                  <Phone size={15} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  <span className="text-sm flex-1">{directoryDetailEntry.phone}</span>
                  <ExternalLink size={13} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </a>
              )}
              {directoryDetailEntry.email && (
                <a href={`mailto:${directoryDetailEntry.email}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors group" data-testid="directory-email-link">
                  <Mail size={15} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  <span className="text-sm flex-1 break-all">{directoryDetailEntry.email}</span>
                  <ExternalLink size={13} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </a>
              )}
              {directoryDetailEntry.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directoryDetailEntry.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors group"
                  data-testid="directory-address-link"
                >
                  <MapPin size={15} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  <span className="text-sm flex-1 leading-snug">{directoryDetailEntry.address}</span>
                  <ExternalLink size={13} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </a>
              )}
              {directoryDetailEntry.notes && (
                <div className="p-2.5 rounded-xl bg-muted/40">
                  <div className="text-xs text-muted-foreground mb-0.5">Notes</div>
                  <div className="text-sm leading-relaxed">{directoryDetailEntry.notes}</div>
                </div>
              )}
            </div>

            {/* MC actions */}
            {isMCViewer && !isShowcaseMode && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    // Reverse-parse stored title back into form state
                    const stored = directoryDetailEntry.title;
                    let titleSelect = DIR_TITLES.includes(stored as any) ? stored : "";
                    let specialty = ""; let specialtyOther = ""; let titleOther = "";
                    if (stored.startsWith("Specialist – ")) {
                      titleSelect = "Specialist";
                      const spec = stored.replace("Specialist – ", "");
                      if (SPECIALTIES.includes(spec as any)) { specialty = spec; }
                      else { specialty = "Other"; specialtyOther = spec; }
                    } else if (!DIR_TITLES.includes(stored as any)) {
                      titleSelect = "Other"; titleOther = stored;
                    }
                    setDirForm({
                      titleSelect, specialty, specialtyOther, titleOther,
                      name: directoryDetailEntry.name || "",
                      phone: directoryDetailEntry.phone || "",
                      email: directoryDetailEntry.email || "",
                      address: directoryDetailEntry.address || "",
                      notes: directoryDetailEntry.notes || "",
                    });
                    setDirectoryEditEntry(directoryDetailEntry);
                    setDirectoryDetailEntry(null);
                  }}
                  data-testid="directory-edit-btn"
                >
                  <Edit2 size={13} /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/20"
                  onClick={() => setDirDeleteConfirm(directoryDetailEntry.id)}
                  data-testid="directory-delete-btn"
                >
                  <Trash2 size={13} /> Remove
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Directory Add/Edit Form Sheet */}
      {(directoryAddOpen || directoryEditEntry) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4" data-testid="directory-form-sheet">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{directoryEditEntry ? "Edit Entry" : "Add to Care Directory"}</div>
              <button
                onClick={() => { setDirectoryAddOpen(false); setDirectoryEditEntry(null); setDirForm(BLANK_DIR_FORM); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {/* Title dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs">Category / Title <span className="text-red-500">*</span></Label>
                <Select
                  value={dirForm.titleSelect}
                  onValueChange={v => setDirForm(f => ({ ...f, titleSelect: v, specialty: "", specialtyOther: "", titleOther: "" }))}
                >
                  <SelectTrigger data-testid="dir-select-title">
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DIR_TITLES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Specialist sub-dropdown */}
              {dirForm.titleSelect === "Specialist" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Specialty <span className="text-red-500">*</span></Label>
                  <Select
                    value={dirForm.specialty}
                    onValueChange={v => setDirForm(f => ({ ...f, specialty: v, specialtyOther: "" }))}
                  >
                    <SelectTrigger data-testid="dir-select-specialty">
                      <SelectValue placeholder="Select specialty..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALTIES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dirForm.specialty === "Other" && (
                    <Input
                      placeholder="Describe specialty"
                      value={dirForm.specialtyOther}
                      onChange={e => setDirForm(f => ({ ...f, specialtyOther: e.target.value }))}
                      data-testid="dir-input-specialty-other"
                    />
                  )}
                </div>
              )}

              {/* Other free text */}
              {dirForm.titleSelect === "Other" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Describe <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g. Pinky Toenail Specialist"
                    value={dirForm.titleOther}
                    onChange={e => setDirForm(f => ({ ...f, titleOther: e.target.value }))}
                    data-testid="dir-input-title-other"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  placeholder="Person or business name"
                  value={dirForm.name}
                  onChange={e => setDirForm(f => ({ ...f, name: e.target.value }))}
                  data-testid="dir-input-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  placeholder="(555) 000-0000"
                  type="tel"
                  value={dirForm.phone}
                  onChange={e => setDirForm(f => ({ ...f, phone: e.target.value }))}
                  data-testid="dir-input-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  placeholder="example@email.com"
                  type="email"
                  value={dirForm.email}
                  onChange={e => setDirForm(f => ({ ...f, email: e.target.value }))}
                  data-testid="dir-input-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input
                  placeholder="Street address or city"
                  value={dirForm.address}
                  onChange={e => setDirForm(f => ({ ...f, address: e.target.value }))}
                  data-testid="dir-input-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  placeholder="Any extra context (optional)"
                  value={dirForm.notes}
                  onChange={e => setDirForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  data-testid="dir-input-notes"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDirectoryAddOpen(false); setDirectoryEditEntry(null); setDirForm(BLANK_DIR_FORM); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                disabled={(
                  !dirForm.titleSelect ||
                  (dirForm.titleSelect === "Specialist" && !dirForm.specialty) ||
                  (dirForm.titleSelect === "Specialist" && dirForm.specialty === "Other" && !dirForm.specialtyOther.trim()) ||
                  (dirForm.titleSelect === "Other" && !dirForm.titleOther.trim()) ||
                  addDirectoryMutation.isPending || editDirectoryMutation.isPending
                )}
                onClick={() => {
                  if (directoryEditEntry) {
                    editDirectoryMutation.mutate({ id: directoryEditEntry.id, data: dirForm });
                  } else {
                    addDirectoryMutation.mutate(dirForm);
                  }
                }}
                data-testid="dir-save-btn"
              >
                {(addDirectoryMutation.isPending || editDirectoryMutation.isPending) ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Directory Delete Confirm */}
      {dirDeleteConfirm !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-xs shadow-2xl space-y-4" data-testid="directory-delete-confirm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-600" />
              </div>
              <div>
                <div className="font-semibold">Remove Entry?</div>
                <div className="text-xs text-muted-foreground">This cannot be undone.</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDirDeleteConfirm(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteDirectoryMutation.isPending}
                onClick={() => deleteDirectoryMutation.mutate(dirDeleteConfirm)}
                data-testid="dir-confirm-delete-btn"
              >
                {deleteDirectoryMutation.isPending ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Family Participants */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 justify-between" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <span className="flex items-center gap-2"><Users size={16} /> Care Team & Family</span>
            {isPrimaryFC && (
              <Button
                size="sm"
                className="h-8 px-3 gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => setFamilyInviteOpen(true)}
                data-testid="invite-family-btn"
              >
                <UserPlus size={13} /> Invite Family Member
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
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <NotifToggle label="Updates" userId={member.id} field="all" prefs={member.notificationPrefs} readOnly={!isMCViewer} onToggle={(prefs) => updateUserMutation.mutate({ id: member.id, data: { notificationPrefs: prefs } })} />
                        <NotifToggle label="Meds" userId={member.id} field="medications" prefs={member.notificationPrefs} readOnly={!isMCViewer} onToggle={(prefs) => updateUserMutation.mutate({ id: member.id, data: { notificationPrefs: prefs } })} />
                        <NotifToggle label="Alerts" userId={member.id} field="alerts" prefs={member.notificationPrefs} readOnly={!isMCViewer} onToggle={(prefs) => updateUserMutation.mutate({ id: member.id, data: { notificationPrefs: prefs } })} />
                        {!isMCViewer && (
                          <span className="text-xs text-muted-foreground/60 italic">view only</span>
                        )}
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

        </div>
      )}

      {/* ══════════════════════════════ SHARED MODALS (all tabs) ════════════ */}

      {/* ── CAREGIVER RATING SCORE (moved to Medical tab — kept here for modal contexts) ── */}
      {false && caregiver && (
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

      {/* ── FLAG RECONCILIATION (moved to Care tab) ─────────────────────── */}
      {false && (canManageFlags || isCaregiverRole(activeUser.role)) && (
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

      </div>{/* end tab content */}

      {/* ── SHARED MODALS & PORTALS (outside tab panels, always mounted) ── */}

      {/* Invite Family Member Sheet (MC only) — shared component */}
      <FamilyInviteSheet open={familyInviteOpen} onOpenChange={setFamilyInviteOpen} />

      {/* ── CLIENT PORTAL ACCESS (MC side) ───────────────────────────────── */}
      {isPrimaryFC && (
        <div className="px-4 pb-4 max-w-4xl mx-auto w-full space-y-6">
          <ClientPortalAccessSection
            clientId={selectedClientId}
            clientName={client?.name ?? "Client"}
            clientDateOfBirth={client?.dateOfBirth ?? null}
            requiresMinorApproval={!!(client as any)?.requiresMinorApproval}
            allUsers={allUsers}
          />

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
      )}
    </div>
  );
}

// ── Client Portal Access Section (MC side) ──────────────────────────────────
// Helper: compute age in full years from ISO date string
function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function ClientPortalAccessSection({ clientId, clientName, clientDateOfBirth, requiresMinorApproval, allUsers }: {
  clientId: number;
  clientName: string;
  clientDateOfBirth: string | null;
  requiresMinorApproval: boolean;
  allUsers: any[];
}) {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferModalStep, setTransferModalStep] = useState(1); // 1=intro, 2=choose MC role, 3=confirm
  const [transferRole, setTransferRole] = useState<'monitor' | 'step_back' | 'remove' | null>(null);

  // Age computation for minor approval toggle
  const clientAge = computeAge(clientDateOfBirth);
  const isMinor = clientAge !== null && clientAge < 18;

  // Check if client already has a portal user linked
  const { data: portalStatus, refetch: refetchStatus } = useQuery<{
    hasPortalAccess: boolean;
    permissionLevel: string | null;
    userId: number | null;
  }>({
    queryKey: ["/api/clients", clientId, "client-portal-status"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/client-portal-status`).then(r => r.json()),
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest("POST", "/api/invite/create", { inviteType: "mc_to_client", recipientEmail: email, clientId }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Invite sent", description: `An invitation was sent to ${inviteEmail}. They will sign in as a read-only observer.` });
      setInviteEmail("");
      setShowInviteForm(false);
      refetchStatus();
    },
    onError: () => toast({ title: "Could not send invite", description: "Please check the email and try again.", variant: "destructive" }),
  });

  const upgradeMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/clients/${clientId}/client-permission`, { permissionLevel: "contributor" }),
    onSuccess: () => {
      toast({ title: "Access upgraded", description: `${clientName} can now contribute to their own record.` });
      refetchStatus();
    },
    onError: () => toast({ title: "Upgrade failed", description: "Please try again.", variant: "destructive" }),
  });

  // Phase 3 — Transfer of Care
  const { data: transferStatus, refetch: refetchTransfer } = useQuery<{
    step: number; initiatedBy: string | null; offeredAt: string | null;
    step2At: string | null; mcCoConfirmed: boolean; cancelledAt: string | null; confirmedAt: string | null; expired?: boolean;
  }>({
    queryKey: ["/api/clients", clientId, "transfer-status"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/transfer-status`).then(r => r.json()),
    enabled: portalStatus?.permissionLevel === "contributor",
  });

  const initiateMCTransferMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${clientId}/transfer/initiate`, {}),
    onSuccess: () => {
      setTransferModalStep(2);
      refetchTransfer();
    },
    onError: () => toast({ title: "Could not initiate transfer", description: "Please try again.", variant: "destructive" }),
  });

  const cancelTransferMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${clientId}/transfer/cancel`, {}),
    onSuccess: () => {
      toast({ title: "Transfer cancelled", description: "Everything remains as it is." });
      setShowTransferModal(false);
      setTransferModalStep(1);
      setTransferRole(null);
      refetchTransfer();
    },
    onError: () => toast({ title: "Could not cancel transfer", variant: "destructive" }),
  });

  const coConfirmTransferMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${clientId}/transfer/co-confirm`, {}),
    onSuccess: () => {
      toast({ title: "You\'ve co-confirmed", description: `${clientName} can now complete their transfer at any time.` });
      refetchTransfer();
    },
    onError: () => toast({ title: "Could not co-confirm", variant: "destructive" }),
  });

  const isTransferInProgress = (transferStatus?.step ?? 0) > 0 && !transferStatus?.confirmedAt;

  // Phase 2: minor approval toggle
  const [approvalToggle, setApprovalToggle] = useState(requiresMinorApproval);
  const approvalToggleMutation = useMutation({
    mutationFn: (val: boolean) => apiRequest("PATCH", `/api/clients/${clientId}/minor-approval-toggle`, { requiresMinorApproval: val }),
    onSuccess: (_data, val) => {
      setApprovalToggle(val);
      toast({ title: val ? "Review mode on" : "Review mode off", description: val ? `You will review ${clientName}'s entries before they are posted.` : `${clientName}'s entries will post directly.` });
    },
    onError: () => toast({ title: "Could not update setting", variant: "destructive" }),
  });

  const statusLabel = !portalStatus?.hasPortalAccess
    ? "No portal access"
    : portalStatus.permissionLevel === "contributor"
    ? "Contributor"
    : portalStatus.permissionLevel === "self_care_mc"
    ? "Self-Care MC"
    : "Observer (read-only)";

  const statusColor = !portalStatus?.hasPortalAccess
    ? "bg-muted/50 text-muted-foreground border-border"
    : portalStatus.permissionLevel === "contributor"
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900"
    : portalStatus.permissionLevel === "self_care_mc"
    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900"
    : "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border-teal-200 dark:border-teal-900";

  return (
    <Card className="border-border" data-testid="client-portal-access-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          <UserPlus size={16} className="text-emerald-600 dark:text-emerald-400" /> Client Portal Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground leading-relaxed">
          Invite {clientName} to view their own care record. They will receive a private login and see their schedule, vitals, medications, activity, and documents in a simplified read-only view.
        </div>

        {/* Status row */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-0.5">Current Access</div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", statusColor)} data-testid="portal-access-status">
                {statusLabel}
              </span>
            </div>
          </div>
          {!portalStatus?.hasPortalAccess && !showInviteForm && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
              onClick={() => setShowInviteForm(true)}
              data-testid="invite-client-portal-btn"
            >
              <Mail size={13} /> Invite {clientName}
            </Button>
          )}
          {portalStatus?.hasPortalAccess && portalStatus.permissionLevel === "observer" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
              onClick={() => upgradeMutation.mutate()}
              disabled={upgradeMutation.isPending}
              data-testid="upgrade-to-contributor-btn"
            >
              <ArrowUpCircle size={13} /> Upgrade to Contributor
            </Button>
          )}
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border">
            <div className="text-xs font-medium text-foreground">{clientName}'s email address</div>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="client@example.com"
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="client-invite-email-input"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => { setShowInviteForm(false); setInviteEmail(""); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                disabled={!inviteEmail.trim() || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate(inviteEmail.trim())}
                data-testid="send-client-invite-btn"
              >
                <Mail size={13} />
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              They will receive an email with a private link to create their portal login. Access starts as read-only (Observer).
            </div>
          </div>
        )}

        {/* Phase 2: Minor approval toggle — only shown when client is a contributor and under 18 */}
        {isMinor && portalStatus?.permissionLevel === "contributor" && (
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 space-y-2" data-testid="minor-approval-toggle-section">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-0.5">Entry Review</div>
                <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  This client is a minor. You can review their entries before they are posted.
                </div>
              </div>
              <Switch
                checked={approvalToggle}
                onCheckedChange={(val) => approvalToggleMutation.mutate(val)}
                disabled={approvalToggleMutation.isPending}
                data-testid="minor-approval-switch"
              />
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-500">
              {approvalToggle
                ? `${clientName}'s entries will be held for your review before posting.`
                : `${clientName}'s entries post directly. You will see all entries.`
              }
            </div>
          </div>
        )}

        {/* Phase 3: Transfer of Care — MC side — only when client is Contributor */}
        {portalStatus?.permissionLevel === "contributor" && !transferStatus?.confirmedAt && (
          <div className="space-y-2" data-testid="transfer-of-care-mc-section">
            <div className="border-t border-border pt-3">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">Transfer of Care</div>
              <div className="text-xs text-muted-foreground leading-relaxed mb-3">
                When {clientName} is ready to own their care record, you can transfer primary authority to them. You choose your continued role.
              </div>

              {/* Client-initiated in progress: MC sees status + co-confirm option */}
              {isTransferInProgress && transferStatus?.initiatedBy === 'client' && (
                <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-emerald-700 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      <strong>{clientName} has started a Transfer of Care</strong> (step {transferStatus.step} of 3).
                      {!transferStatus.mcCoConfirmed && " They are working through the confirmation period."}
                      {transferStatus.mcCoConfirmed && " You have co-confirmed. They can complete the final step at any time."}
                    </div>
                  </div>
                  {!transferStatus.mcCoConfirmed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950/30 text-xs"
                      onClick={() => coConfirmTransferMutation.mutate()}
                      disabled={coConfirmTransferMutation.isPending}
                      data-testid="mc-co-confirm-transfer-btn"
                    >
                      <CheckCircle2 size={12} /> I agree — skip the wait
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 h-7 text-muted-foreground hover:text-destructive text-xs px-2"
                    onClick={() => cancelTransferMutation.mutate()}
                    disabled={cancelTransferMutation.isPending}
                    data-testid="mc-cancel-transfer-btn"
                  >
                    <X size={11} /> Cancel transfer
                  </Button>
                </div>
              )}

              {/* MC-initiated: offer pending client response */}
              {isTransferInProgress && transferStatus?.initiatedBy === 'mc' && (
                <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      <strong>Your offer is pending.</strong> {clientName} has been notified and can accept within 72 hours. If they don’t respond, everything stays as is.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 h-7 text-muted-foreground hover:text-destructive text-xs px-2"
                    onClick={() => cancelTransferMutation.mutate()}
                    disabled={cancelTransferMutation.isPending}
                    data-testid="mc-withdraw-offer-btn"
                  >
                    <X size={11} /> Withdraw offer
                  </Button>
                </div>
              )}

              {/* No transfer in progress: show You Are Ready button */}
              {!isTransferInProgress && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                  onClick={() => { setShowTransferModal(true); setTransferModalStep(1); setTransferRole(null); }}
                  data-testid="you-are-ready-btn"
                >
                  <ArrowRightCircle size={13} /> You Are Ready
                </Button>
              )}
            </div>
          </div>
        )}

        {/* You Are Ready modal — 3-step */}
        {showTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="transfer-modal-overlay">
            <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">

              {/* Step 1: Intro */}
              {transferModalStep === 1 && (
                <>
                  <div className="space-y-2">
                    <div className="text-base font-semibold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Transfer of Care</div>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      You’re telling <strong>{clientName}</strong> they are ready to own their care record. This will transfer primary authority to them and change your role on the portal.
                    </div>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {clientName} will receive your offer and have 72 hours to accept. You choose your continued role when they accept.
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-2">
                      This is a significant moment. Take a breath before continuing.
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowTransferModal(false)}>Not yet</Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                      onClick={() => initiateMCTransferMutation.mutate()}
                      disabled={initiateMCTransferMutation.isPending}
                      data-testid="transfer-modal-send-offer-btn"
                    >
                      <ChevronRight size={14} /> Send the offer
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2: Offer sent — choose MC post-transfer role (shown after offer accepted by client via their portal) */}
              {/* Note: step 2 here just confirms the offer was sent */}
              {transferModalStep === 2 && (
                <>
                  <div className="space-y-2">
                    <div className="text-base font-semibold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Offer sent</div>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {clientName} has been notified. When they accept, you’ll choose how you’d like to stay involved.
                    </div>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      The offer expires in 72 hours. You can withdraw it at any time from the Client Profile page.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    variant="outline"
                    onClick={() => setShowTransferModal(false)}
                    data-testid="transfer-modal-close-btn"
                  >
                    Close
                  </Button>
                </>
              )}

            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

function NotifToggle({ label, userId, field, prefs, onToggle, readOnly = false }: {
  label: string; userId: number; field: string; prefs: string | null;
  onToggle: (newPrefs: string) => void;
  readOnly?: boolean;
}) {
  const parsed = prefs ? JSON.parse(prefs) : {};
  const checked = parsed[field] === true;

  const handleChange = () => {
    if (readOnly) return;
    const newPrefs = { ...parsed, [field]: !checked };
    onToggle(JSON.stringify(newPrefs));
  };

  return (
    <label className={cn("flex items-center gap-1.5 select-none", readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer")}>
      <Switch
        checked={checked}
        onCheckedChange={handleChange}
        disabled={readOnly}
        className="scale-75 data-[state=checked]:bg-teal-600 data-[state=unchecked]:bg-zinc-300 dark:data-[state=unchecked]:bg-zinc-600"
      />
      <span className={cn("text-xs", checked ? "text-teal-700 dark:text-teal-400 font-medium" : "text-muted-foreground")}>{label}</span>
    </label>
  );
}
