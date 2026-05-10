/**
 * Care Scope Settings — Main Contact only
 * Tab 1 (Modules): Controls which care modules are active — affects scoring + flagging.
 * Tab 2 (Flagging): Per-category flag on/off — caregiver still logs, but misses don't flag.
 * Caregiver sees read-only view of both tabs.
 */

import { useState } from "react";
import { LessonLauncher } from "@/components/LessonLauncher";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useApp } from "@/App";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Pill, Activity, Calendar, MessageSquare, ClipboardList,
  Info, CheckCircle2, AlertCircle, Settings, ChevronRight,
  Shield, RefreshCw, Flag, BellOff
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CareScope {
  id?: number;
  clientId: number;
  caregiverId: number;
  medications: boolean;
  vitals: boolean;
  appointments: boolean;
  activityLog: boolean;
  messaging: boolean;
  medicationsNote: string | null;
  vitalsNote: string | null;
  appointmentsNote: string | null;
  pendingRequest: string | null;
}

// ── Module Config ─────────────────────────────────────────────────────────────

const MODULES = [
  {
    key: "medications" as keyof CareScope,
    noteKey: "medicationsNote" as keyof CareScope,
    label: "Medication Tracking",
    description: "Caregiver logs each dose with time and notes. Affects Knowledge score.",
    icon: Pill,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-100 dark:border-rose-800/30",
    canDisable: true,
    disableReason: "Common near end of life when medication management shifts to family or hospice.",
  },
  {
    key: "vitals" as keyof CareScope,
    noteKey: "vitalsNote" as keyof CareScope,
    label: "Vitals & Health Monitoring",
    description: "Daily vitals logging (BP, O₂, weight, etc.). Affects Knowledge score.",
    icon: Activity,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-100 dark:border-blue-800/30",
    canDisable: true,
    disableReason: "Can be paused when care focus shifts to comfort and the family takes over monitoring.",
  },
  {
    key: "appointments" as keyof CareScope,
    noteKey: "appointmentsNote" as keyof CareScope,
    label: "Appointment Tracking",
    description: "Caregiver is responsible for appointment attendance. Affects Dependability score.",
    icon: Calendar,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    border: "border-violet-100 dark:border-violet-800/30",
    canDisable: true,
    disableReason: "Can be paused when the family is managing doctor visits directly.",
  },
  {
    key: "activityLog" as keyof CareScope,
    noteKey: null,
    label: "Care Log (Activity)",
    description: "Daily care entries and notes from the caregiver. Always required.",
    icon: ClipboardList,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    border: "border-teal-100 dark:border-teal-800/30",
    canDisable: false,
    disableReason: null,
  },
  {
    key: "messaging" as keyof CareScope,
    noteKey: null,
    label: "Messaging",
    description: "Communication between caregiver and family. Always required.",
    icon: MessageSquare,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-100 dark:border-emerald-800/30",
    canDisable: false,
    disableReason: null,
  },
];

// ── Flag Control Types & Config ──────────────────────────────────────────────

interface FlagControl {
  id?: number;
  clientId: number;
  caregiverId: number;
  medicationFlags: boolean;
  appointmentFlags: boolean;
  messageFlags: boolean;
  medicationFlagsNote: string | null;
  appointmentFlagsNote: string | null;
  messageFlagsNote: string | null;
}

const FLAG_CATEGORIES = [
  {
    key: "medicationFlags" as keyof FlagControl,
    noteKey: "medicationFlagsNote" as keyof FlagControl,
    label: "Medication Flags",
    description: "Yellow flag when a scheduled dose is not logged within 1 hour. Red flag after 3 unexcused misses in 30 days.",
    icon: Pill,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-100 dark:border-rose-800/30",
    disableReason: "Common near end of life when medication management has transferred to hospice or family.",
  },
  {
    key: "appointmentFlags" as keyof FlagControl,
    noteKey: "appointmentFlagsNote" as keyof FlagControl,
    label: "Appointment Flags",
    description: "Yellow flag when a caregiver-responsible appointment is not marked complete by end of day.",
    icon: Calendar,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    border: "border-violet-100 dark:border-violet-800/30",
    disableReason: "Can be paused when the family is managing appointments directly.",
  },
  {
    key: "messageFlags" as keyof FlagControl,
    noteKey: "messageFlagsNote" as keyof FlagControl,
    label: "Message Response Flags",
    description: "Yellow flag when an Urgent message goes unread for 4+ hours during an active shift.",
    icon: MessageSquare,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-100 dark:border-blue-800/30",
    disableReason: "Can be paused when communication expectations have been adjusted by mutual agreement.",
  },
];

// ── Flag Category Card ────────────────────────────────────────────────────────

function FlagCategoryCard({
  category,
  isActive,
  note,
  onToggle,
  onNoteChange,
  isPrimaryFC,
}: {
  category: typeof FLAG_CATEGORIES[0];
  isActive: boolean;
  note: string;
  onToggle: (val: boolean) => void;
  onNoteChange: (val: string) => void;
  isPrimaryFC: boolean;
}) {
  const Icon = category.icon;
  const [editingNote, setEditingNote] = useState(false);
  const [localNote, setLocalNote] = useState(note);

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3 transition-all",
      isActive
        ? category.bg + " " + category.border
        : "bg-muted/40 border-border opacity-75"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          isActive ? "bg-white/60 dark:bg-black/20" : "bg-muted"
        )}>
          <Icon size={17} className={isActive ? category.color : "text-muted-foreground"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-sm font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>
              {category.label}
            </span>
            {isPrimaryFC ? (
              <button
                onClick={() => onToggle(!isActive)}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0",
                  isActive ? "bg-primary" : "bg-muted-foreground/30"
                )}
                data-testid={`flag-toggle-${category.key}`}
                aria-label={isActive ? `Disable ${category.label}` : `Enable ${category.label}`}
              >
                <span className={cn(
                  "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform",
                  isActive ? "translate-x-4" : "translate-x-0.5"
                )} />
              </button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
        </div>
      </div>

      {/* Active status indicator */}
      <div className={cn(
        "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg w-fit",
        isActive
          ? "text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/20"
          : "text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20"
      )}>
        {isActive
          ? <><CheckCircle2 size={11} /> Enabled — flags will generate normally</>
          : <><BellOff size={11} /> Disabled — misses in this category will not flag</>
        }
      </div>

      {/* FC: optional note for caregiver when disabled */}
      {!isActive && isPrimaryFC && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            Optional: Add a note for the caregiver explaining why flags are paused.
          </p>
          {editingNote ? (
            <div className="flex gap-2">
              <input
                className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={category.disableReason}
                value={localNote}
                onChange={e => setLocalNote(e.target.value)}
                data-testid={`flag-note-${category.key}`}
              />
              <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => {
                onNoteChange(localNote);
                setEditingNote(false);
              }}>Save</Button>
            </div>
          ) : (
            <button
              className="text-xs text-primary/70 hover:text-primary flex items-center gap-1"
              onClick={() => setEditingNote(true)}
            >
              <ChevronRight size={11} />
              {note ? `"${note.slice(0, 50)}${note.length > 50 ? '…' : ''}"` : "Add caregiver note"}
            </button>
          )}
        </div>
      )}

      {/* Caregiver: see note if disabled */}
      {!isActive && !isPrimaryFC && note && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2">
          <Info size={11} className="shrink-0 mt-0.5" />
          <span>{note}</span>
        </div>
      )}
    </div>
  );
}

// ── Toggle Card ───────────────────────────────────────────────────────────────

function ModuleToggleCard({
  module,
  isActive,
  note,
  onToggle,
  onNoteChange,
  isPrimaryFC,
}: {
  module: typeof MODULES[0];
  isActive: boolean;
  note: string;
  onToggle: (val: boolean) => void;
  onNoteChange: (val: string) => void;
  isPrimaryFC: boolean;
}) {
  const Icon = module.icon;
  const [editingNote, setEditingNote] = useState(false);
  const [localNote, setLocalNote] = useState(note);

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3 transition-all",
      isActive
        ? module.bg + " " + module.border
        : "bg-muted/40 border-border opacity-75"
    )}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          isActive ? "bg-white/60 dark:bg-black/20" : "bg-muted"
        )}>
          <Icon size={17} className={isActive ? module.color : "text-muted-foreground"} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-sm font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>
              {module.label}
            </span>
            {module.canDisable && isPrimaryFC ? (
              <button
                onClick={() => onToggle(!isActive)}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0",
                  isActive ? "bg-primary" : "bg-muted-foreground/30"
                )}
                data-testid={`scope-toggle-${module.key}`}
                aria-label={isActive ? `Deactivate ${module.label}` : `Activate ${module.label}`}
              >
                <span className={cn(
                  "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform",
                  isActive ? "translate-x-4" : "translate-x-0.5"
                )} />
              </button>
            ) : !module.canDisable ? (
              <span className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 bg-muted rounded-full shrink-0">
                Always on
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>
        </div>
      </div>

      {/* Active status indicator */}
      {module.canDisable && (
        <div className={cn(
          "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg w-fit",
          isActive
            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/20"
            : "text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20"
        )}>
          {isActive
            ? <><CheckCircle2 size={11} /> Active — caregiver is being tracked</>
            : <><AlertCircle size={11} /> Paused — not scored, no flags generated</>
          }
        </div>
      )}

      {/* Deactivation note (visible to caregiver) */}
      {module.canDisable && !isActive && isPrimaryFC && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            Optional: Add a note for the caregiver explaining why this is paused.
          </p>
          {editingNote ? (
            <div className="flex gap-2">
              <input
                className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={module.disableReason || "Reason for pausing..."}
                value={localNote}
                onChange={e => setLocalNote(e.target.value)}
                data-testid={`scope-note-${module.key}`}
              />
              <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => {
                onNoteChange(localNote);
                setEditingNote(false);
              }}>Save</Button>
            </div>
          ) : (
            <button
              className="text-xs text-primary/70 hover:text-primary flex items-center gap-1"
              onClick={() => setEditingNote(true)}
            >
              <ChevronRight size={11} />
              {note ? `"${note.slice(0, 50)}${note.length > 50 ? '…' : ''}"` : "Add caregiver note"}
            </button>
          )}
        </div>
      )}

      {/* Caregiver view: show note if deactivated */}
      {module.canDisable && !isActive && !isPrimaryFC && note && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2">
          <Info size={11} className="shrink-0 mt-0.5" />
          <span>{note}</span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CareScope() {
  const { activeUser, selectedClientId } = useApp();
  const { toast } = useToast();

  // Demo: primary caregiver is always userId=1
  const caregiverId = 1;
  const isPrimaryFC = activeUser.role === "primary_family";

  const [activeTab, setActiveTab] = useState<"modules" | "flagging">("modules");

  // ── Scope query + draft ────────────────────────────────────────────────────
  const { data: scope, isLoading: scopeLoading } = useQuery<CareScope>({
    queryKey: ["/api/scope", selectedClientId, caregiverId],
    queryFn: () => apiRequest("GET", `/api/scope/${selectedClientId}/${caregiverId}`),
  });
  const [scopeDraft, setScopeDraft] = useState<Partial<CareScope>>({});
  const hasScopeDraft = Object.keys(scopeDraft).length > 0;
  const currentScope = scope ? { ...scope, ...scopeDraft } : null;

  const saveScopeMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/scope/${selectedClientId}/${caregiverId}`, {
      ...scopeDraft,
      updatedByUserId: activeUser.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scope", selectedClientId, caregiverId] });
      setScopeDraft({});
      toast({ title: "Scope settings saved", description: "Changes will take effect immediately." });
    },
    onError: () => toast({ title: "Error", description: "Could not save scope settings.", variant: "destructive" }),
  });

  // ── Flag control query + draft ─────────────────────────────────────────────
  const { data: flagControl, isLoading: flagLoading } = useQuery<FlagControl>({
    queryKey: ["/api/flag-control", selectedClientId, caregiverId],
    queryFn: () => apiRequest("GET", `/api/flag-control/${selectedClientId}/${caregiverId}`),
  });
  const [flagDraft, setFlagDraft] = useState<Partial<FlagControl>>({});
  const hasFlagDraft = Object.keys(flagDraft).length > 0;
  const currentFlags = flagControl ? { ...flagControl, ...flagDraft } : null;

  const saveFlagMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/flag-control/${selectedClientId}/${caregiverId}`, {
      ...flagDraft,
      updatedByUserId: activeUser.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flag-control", selectedClientId, caregiverId] });
      setFlagDraft({});
      toast({ title: "Flag settings saved", description: "Changes will take effect immediately." });
    },
    onError: () => toast({ title: "Error", description: "Could not save flag settings.", variant: "destructive" }),
  });

  if (scopeLoading || flagLoading || !currentScope || !currentFlags) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Settings size={20} className="text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Care Scope
            </h1>
            <p className="text-xs text-muted-foreground">
              {isPrimaryFC
                ? "Manage care modules and accountability settings for this caregiver"
                : "Your current care scope and flag settings"
              }
            </p>
<LessonLauncher pageKey="carescope" />
          </div>
        </div>

        {isPrimaryFC && activeTab === "modules" && hasScopeDraft && (
          <Button size="sm" onClick={() => saveScopeMutation.mutate()} disabled={saveScopeMutation.isPending} data-testid="scope-save-btn">
            {saveScopeMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        )}
        {isPrimaryFC && activeTab === "flagging" && hasFlagDraft && (
          <Button size="sm" onClick={() => saveFlagMutation.mutate()} disabled={saveFlagMutation.isPending} data-testid="flag-save-btn">
            {saveFlagMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl bg-muted/50 p-1 gap-1">
        {([
          { id: "modules" as const, label: "Modules", icon: Settings },
          { id: "flagging" as const, label: "Flagging", icon: Flag },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ───── TAB: MODULES ───── */}
      {activeTab === "modules" && (
        <>
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4 flex items-start gap-3">
            <Shield size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Scope is a shared responsibility</p>
              <p>
                These settings help ensure your caregiver isn’t penalized for care areas that have changed focus —
                such as when a loved one moves to comfort care and medications are managed by hospice.
                It is the family’s responsibility to keep scope settings current and to communicate any changes to the caregiver.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active Modules</h2>
            {MODULES.map(module => {
              const isActive = Boolean(currentScope[module.key as keyof CareScope] ?? true);
              const note = module.noteKey ? String(currentScope[module.noteKey as keyof CareScope] ?? "") : "";
              return (
                <ModuleToggleCard
                  key={module.key}
                  module={module}
                  isActive={isActive}
                  note={note}
                  onToggle={val => setScopeDraft(prev => ({ ...prev, [module.key]: val }))}
                  onNoteChange={val => module.noteKey && setScopeDraft(prev => ({ ...prev, [module.noteKey!]: val }))}
                  isPrimaryFC={isPrimaryFC}
                />
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Info size={14} className="text-muted-foreground" />
              How scope affects scoring
            </h3>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-5 list-disc">
              <li><strong className="text-foreground">Medication tracking off</strong> — removed from Knowledge score. Caregiver not penalized for unlogged doses.</li>
              <li><strong className="text-foreground">Vitals tracking off</strong> — removed from Knowledge score. No flags for unrecorded vitals.</li>
              <li><strong className="text-foreground">Appointment tracking off</strong> — removed from Dependability score. No flags for missed appointments.</li>
              <li><strong className="text-foreground">Scores are normalized</strong> — remaining active modules carry full weight.</li>
              <li><strong className="text-foreground">7-day inactivity prompt</strong> — if medications or vitals go unlogged for 7+ days, you’ll see a gentle reminder rather than a flag.</li>
            </ul>
          </div>

          {!isPrimaryFC && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Need a scope change?</p>
              <p className="text-xs text-muted-foreground">
                Only the Main Contact can change scope settings. If a module should be deactivated —
                for example, because hospice has taken over medication management — reach out to the family through Messages.
              </p>
            </div>
          )}

          {isPrimaryFC && hasScopeDraft && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setScopeDraft({})}>Discard Changes</Button>
              <Button className="flex-1" onClick={() => saveScopeMutation.mutate()} disabled={saveScopeMutation.isPending}>
                {saveScopeMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* ───── TAB: FLAGGING ───── */}
      {activeTab === "flagging" && (
        <>
          <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/10 p-4 flex items-start gap-3">
            <Flag size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 dark:text-blue-300 space-y-1">
              <p className="font-semibold">Flagging vs. Modules — what’s the difference?</p>
              <p>
                <strong>Turning a module off</strong> means the caregiver is no longer expected to track it at all —
                it’s removed from scoring entirely.{" "}
                <strong>Disabling a flag category</strong> means the caregiver is still expected to do the work,
                but missed events will not generate a yellow flag.
                Use this when accountability is being managed by other means, or when a temporary arrangement is in place.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4 flex items-start gap-3">
            <Shield size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Family responsibility</p>
              <p>
                It is the family’s responsibility to work with the caregiver to ensure accountability tools are
                activated or deactivated appropriately. Disabling flags does not change what the caregiver is
                expected to do — it changes how the system responds to missed tasks.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Flag Categories</h2>
            {FLAG_CATEGORIES.map(category => {
              const isActive = Boolean(currentFlags[category.key as keyof FlagControl] ?? true);
              const note = String(currentFlags[category.noteKey as keyof FlagControl] ?? "");
              return (
                <FlagCategoryCard
                  key={String(category.key)}
                  category={category}
                  isActive={isActive}
                  note={note}
                  onToggle={val => setFlagDraft(prev => ({ ...prev, [category.key]: val }))}
                  onNoteChange={val => setFlagDraft(prev => ({ ...prev, [category.noteKey]: val }))}
                  isPrimaryFC={isPrimaryFC}
                />
              );
            })}
          </div>

          {!isPrimaryFC && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Questions about your flag settings?</p>
              <p className="text-xs text-muted-foreground">
                Only the Main Contact can change flag settings. If you believe a flag category should be
                adjusted, reach out through Messages to discuss it with the family.
              </p>
            </div>
          )}

          {isPrimaryFC && hasFlagDraft && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setFlagDraft({})}>Discard Changes</Button>
              <Button className="flex-1" onClick={() => saveFlagMutation.mutate()} disabled={saveFlagMutation.isPending}>
                {saveFlagMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          )}
        </>
      )}

    </div>
  );
}
