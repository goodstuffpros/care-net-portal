import { useApp, isCaregiverRole } from "@/App";
import { LessonLauncher } from "@/components/LessonLauncher";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Medication, MedicationLog } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Pill, Plus, Clock, AlertTriangle, CheckCircle2, Circle, ChevronDown,
  ChevronUp, Pencil, XCircle, Archive, ClipboardList,
  Loader2, Info, Calendar, User, Building2, Hash,
  FlaskConical, Stethoscope, FileText, Search, CheckCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import ModuleIntro from "@/components/ModuleIntro";

// ─── Constants ────────────────────────────────────────────────────────────────
const FREQUENCY_LABELS: Record<string, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  three_daily: "Three times daily",
  four_daily: "Four times daily",
  weekly: "Weekly",
  biweekly: "Every two weeks",
  monthly: "Monthly",
  other: "Other",
};
const FORM_LABELS: Record<string, string> = {
  tablet: "Tablet", capsule: "Capsule", liquid: "Liquid",
  patch: "Patch", injection: "Injection", inhaler: "Inhaler",
  drops: "Drops", other: "Other",
};
const DISCONTINUE_REASONS: Record<string, string> = {
  side_effects: "Side effects",
  completed: "Course completed",
  replaced: "Replaced by new medication",
  physician_order: "Physician order",
  other: "Other",
};

function formatScheduledTimes(times: string | null): string {
  if (!times) return "";
  try {
    const arr: string[] = JSON.parse(times);
    const formatted = arr
      .map(t => {
        // Only format valid HH:MM strings — skip anything that doesn't match
        if (!/^\d{1,2}:\d{2}$/.test((t ?? "").trim())) return null;
        const [h, m] = t.split(":");
        const d = new Date();
        d.setHours(Number(h), Number(m), 0, 0);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      })
      .filter(Boolean);
    return formatted.join(" · ") || "";
  } catch { return ""; }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.includes("T") ? iso : iso + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " today";
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ─── Med Card ──────────────────────────────────────────────────────────────────
function MedCard({
  med, allMeds, canEdit, isFamilyPortal, onLogDose, onEdit, onDiscontinue, logs,
}: {
  med: Medication;
  allMeds: Medication[];
  canEdit: boolean;
  isFamilyPortal: boolean;
  onLogDose: (med: Medication) => void;
  onEdit: (med: Medication) => void;
  onDiscontinue: (med: Medication) => void;
  logs?: MedicationLog[];
}) {
  const [expanded, setExpanded] = useState(false);
  const isPRN = med.scheduleType === "as_needed";

  // Check if this med was given today (any log with wasGiven=true for today)
  const today = new Date().toISOString().slice(0, 10);
  const givenToday = (logs ?? []).some(
    l => l.medicationId === med.id && l.wasGiven && l.loggedAt?.slice(0, 10) === today
  );

  return (
    <Card className={cn("transition-all", isPRN && "border-dashed")}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
              isPRN ? "bg-amber-100 dark:bg-amber-950/30" : "bg-primary/10"
            )}>
              <Pill size={16} className={isPRN ? "text-amber-600 dark:text-amber-400" : "text-primary"} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight">{med.name}</div>
              {med.genericName && med.genericName !== med.name && (
                <div className="text-xs text-muted-foreground">{med.genericName}</div>
              )}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-xs font-medium text-foreground">
                  {med.dosageAmount}{med.dosageUnit}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground capitalize">{FORM_LABELS[med.form] || med.form}</span>
                {isPRN ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600 dark:text-amber-400 h-4">PRN</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {FREQUENCY_LABELS[med.frequency || ""] || med.frequency}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canEdit && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 transition-colors"
                  onClick={() => onLogDose(med)}
                  data-testid={`log-dose-${med.id}`}
                  title={givenToday ? "Dose logged today — log again" : "Log dose"}
                >
                  {givenToday ? (
                    <CheckCircle2 size={16} className="text-emerald-600 fill-emerald-600" />
                  ) : (
                    <Circle size={16} className="text-emerald-500" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(med)} data-testid={`edit-med-${med.id}`} title="Edit">
                  <Pencil size={13} className="text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDiscontinue(med)} data-testid={`discontinue-med-${med.id}`} title="Discontinue">
                  <XCircle size={13} className="text-muted-foreground hover:text-red-500" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(e => !e)}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>
        </div>

        {/* Schedule times */}
        {!isPRN && med.scheduledTimes && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Clock size={11} />
            <span>{formatScheduledTimes(med.scheduledTimes)}</span>
            {med.frequencyNote && <span className="text-muted-foreground/60">· {med.frequencyNote}</span>}
          </div>
        )}
        {isPRN && med.frequencyNote && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400">
            <Info size={11} />
            <span>{med.frequencyNote}</span>
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t border-border mt-1">
          {med.purpose && (
            <div className="flex gap-2 text-xs">
              <Stethoscope size={12} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div><span className="text-muted-foreground">Purpose: </span>{med.purpose}</div>
            </div>
          )}
          {med.instructions && (
            <div className="flex gap-2 text-xs">
              <FileText size={12} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div><span className="text-muted-foreground">Instructions: </span>{med.instructions}</div>
            </div>
          )}
          {med.sideEffectsToWatch && (
            <div className="flex gap-2 text-xs">
              <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div><span className="text-muted-foreground">Watch for: </span>{med.sideEffectsToWatch}</div>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {med.prescribingPhysician && (
              <div className="flex gap-1.5 items-center">
                <User size={10} className="text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Dr: </span>
                <span>{med.prescribingPhysician}</span>
              </div>
            )}
            {med.pharmacy && (
              <div className="flex gap-1.5 items-center">
                <Building2 size={10} className="text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Pharmacy: </span>
                <span>{med.pharmacy}</span>
              </div>
            )}
            {med.rxNumber && (
              <div className="flex gap-1.5 items-center">
                <Hash size={10} className="text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Rx: </span>
                <span>{med.rxNumber}</span>
              </div>
            )}

            <div className="flex gap-1.5 items-center">
              <Calendar size={10} className="text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Started: </span>
              <span>{formatDate(med.startDate)}</span>
            </div>
          </div>
          {med.notes && (
            <div className="text-xs text-muted-foreground italic bg-muted/40 rounded px-2 py-1.5">"{med.notes}"</div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Log Dose Dialog ───────────────────────────────────────────────────────────
function LogDoseDialog({
  med, open, onClose, onSubmit, isPending,
}: {
  med: Medication | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [given, setGiven] = useState(true);
  const [refused, setRefused] = useState(false);
  const [refusalReason, setRefusalReason] = useState("");
  const [prnReason, setPrnReason] = useState("");
  const [reaction, setReaction] = useState("");
  const [notes, setNotes] = useState("");

  if (!med) return null;
  const isPRN = med.scheduleType === "as_needed";

  const handleSubmit = () => {
    onSubmit({
      medicationId: med.id,
      loggedAt: new Date().toISOString(),
      wasGiven: given,
      refusedOrMissed: refused,
      refusalReason: refusalReason || undefined,
      prnReason: prnReason || undefined,
      reaction: reaction || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 size={16} className="text-emerald-600" />
            Log Dose — {med.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {med.dosageAmount}{med.dosageUnit} · {FORM_LABELS[med.form] || med.form}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="flex gap-3">
            <button
              onClick={() => { setGiven(true); setRefused(false); }}
              className={cn("flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all",
                given ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "border-border")}
              data-testid="dose-given-btn"
            >
              <CheckCircle2 size={14} className="inline mr-1.5" />
              Given
            </button>
            <button
              onClick={() => { setGiven(false); setRefused(true); }}
              className={cn("flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all",
                !given ? "border-red-400 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" : "border-border")}
              data-testid="dose-refused-btn"
            >
              <XCircle size={14} className="inline mr-1.5" />
              Not Given
            </button>
          </div>

          {!given && (
            <div className="space-y-1.5">
              <Label className="text-xs">Reason not given</Label>
              <Select value={refusalReason} onValueChange={setRefusalReason}>
                <SelectTrigger className="h-8 text-xs" data-testid="dose-refusal-reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_refused" className="text-xs">Client refused</SelectItem>
                  <SelectItem value="caregiver_error" className="text-xs">Caregiver error</SelectItem>
                  <SelectItem value="out_of_stock" className="text-xs">Out of stock</SelectItem>
                  <SelectItem value="other" className="text-xs">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {isPRN && given && (
            <div className="space-y-1.5">
              <Label className="text-xs">Reason given (PRN)</Label>
              <Input placeholder="e.g. Knee pain 6/10 after PT" value={prnReason}
                onChange={e => setPrnReason(e.target.value)} className="h-8 text-sm"
                data-testid="dose-prn-reason" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Reaction / side effects observed</Label>
            <Input placeholder="None noted" value={reaction}
              onChange={e => setReaction(e.target.value)} className="h-8 text-sm"
              data-testid="dose-reaction" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea placeholder="Optional notes..." value={notes}
              onChange={e => setNotes(e.target.value)} className="text-sm resize-none min-h-[52px]"
              data-testid="dose-notes" />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="flex-1" onClick={handleSubmit} disabled={isPending} data-testid="dose-submit">
              {isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : <CheckCircle2 size={13} className="mr-1" />}
              Save Log
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── RxNorm Drug Search Autocomplete ─────────────────────────────────────────
interface RxSuggestion {
  name: string;
  rxcui: string;
  synonym?: string;
}

function DrugSearchInput({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (name: string, genericName: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<RxSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(!!value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (term: string) => {
    if (term.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      // approximateTerm handles misspellings; returns up to 8 candidates
      const res = await fetch(
        `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=8`
      );
      const data = await res.json();
      const candidates = data?.approximateGroup?.candidate ?? [];
      // Deduplicate by name (case-insensitive)
      const seen = new Set<string>();
      const results: RxSuggestion[] = [];
      for (const c of candidates) {
        const name: string = c.name ?? "";
        const key = name.toLowerCase();
        if (name && !seen.has(key)) {
          seen.add(key);
          results.push({ name, rxcui: c.rxcui ?? "", synonym: c.synonym });
        }
      }
      setSuggestions(results);
      setOpen(results.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setConfirmed(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handlePick = async (s: RxSuggestion) => {
    setQuery(s.name);
    setOpen(false);
    setConfirmed(true);
    // Fetch generic name via RxNorm related info
    let genericName = "";
    try {
      const res = await fetch(
        `https://rxnav.nlm.nih.gov/REST/rxcui/${s.rxcui}/related.json?tty=IN`
      );
      const data = await res.json();
      const groups = data?.relatedGroup?.conceptGroup ?? [];
      for (const g of groups) {
        const props = g?.conceptProperties ?? [];
        if (props.length > 0) { genericName = props[0].name ?? ""; break; }
      }
    } catch { /* no-op */ }
    onSelect(s.name, genericName);
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <Label className="text-xs">Name *</Label>
      <div className="relative">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading
            ? <Loader2 size={13} className="text-muted-foreground animate-spin" />
            : confirmed
            ? <CheckCheck size={13} className="text-teal-600" />
            : <Search size={13} className="text-muted-foreground" />}
        </div>
        <Input
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => {
            // Accept whatever is typed even if not picked from dropdown
            if (query.trim() && !confirmed) {
              setConfirmed(true);
              onSelect(query.trim(), "");
            }
            setTimeout(() => setOpen(false), 150);
          }}
          placeholder="Start typing a drug name…"
          className="h-8 text-sm pl-7"
          data-testid="med-name"
          autoComplete="off"
        />
        {confirmed && (
          <button
            type="button"
            onClick={() => { setQuery(""); setConfirmed(false); setSuggestions([]); onSelect("", ""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <XCircle size={13} />
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-w-sm bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border font-medium uppercase tracking-wider">
            Verified drug names · tap to select
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); handlePick(s); }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-start gap-2"
                >
                  <Pill size={13} className="text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{s.name}</div>
                    {s.synonym && s.synonym !== s.name && (
                      <div className="text-xs text-muted-foreground">{s.synonym}</div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">Powered by NLM RxNorm · handles misspellings · select to confirm</p>
    </div>
  );
}

// ─── Time-of-day presets ──────────────────────────────────────────────────────
// Maps a friendly label to representative times stored in DB
const TIME_SLOTS = [
  { label: "Morning",   emoji: "🌅", times: ["08:00"] },
  { label: "Afternoon", emoji: "☀️", times: ["13:00"] },
  { label: "Evening",   emoji: "🌙", times: ["20:00"] },
  { label: "Night",     emoji: "🌛", times: ["22:00"] },
] as const;

/** Returns true if ALL times in the array are "canonical" slot times (no specificity) */
function areSlotTimes(times: string[]): boolean {
  const canonical = new Set(TIME_SLOTS.flatMap(s => s.times));
  return times.every(t => canonical.has(t));
}

/** Given a scheduledTimes array, derive which TIME_SLOTS are selected */
function timesToSlots(times: string[]): string[] {
  const selected = new Set<string>();
  times.forEach(t => {
    const h = parseInt((t ?? "").split(":")[0], 10);
    if (isNaN(h)) return;
    if (h >= 5 && h < 12)  selected.add("Morning");
    else if (h >= 12 && h < 17) selected.add("Afternoon");
    else if (h >= 17 && h < 21) selected.add("Evening");
    else selected.add("Night");
  });
  return [...selected];
}

/** Convert selected slot labels back to canonical times */
function slotsToTimes(slots: string[]): string[] {
  return slots.flatMap(s => TIME_SLOTS.find(ts => ts.label === s)?.times ?? []);
}

/** Format a 24hr "HH:MM" string to "9:00 AM" style */
function fmt24to12(t: string): string {
  if (!/^\d{1,2}:\d{2}$/.test((t ?? "").trim())) return t;
  const [h, m] = t.split(":").map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  if (isNaN(d.getTime())) return t;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ─── Add / Edit Medication Dialog ─────────────────────────────────────────────
const EMPTY_MED_FORM = {
  name: "", genericName: "", form: "tablet", dosageAmount: "",
  dosageUnit: "mg", strength: "",
  scheduleType: "scheduled", frequency: "once_daily",
  selectedSlots: ["Morning"] as string[],
  useSpecificTimes: false,
  specificTimes: [] as string[],           // e.g. ["09:00", "14:00", "19:00"]
  frequencyNote: "",
  prescribingPhysician: "", pharmacy: "", rxNumber: "",
  purpose: "", instructions: "", sideEffectsToWatch: "",
  startDate: new Date().toISOString().split("T")[0],
  notes: "", changeNote: "",
};

function buildFormFromExisting(existing: Medication) {
  let existingTimes: string[] = ["08:00"];
  try { existingTimes = JSON.parse(existing.scheduledTimes || "[]") || ["08:00"]; } catch {}
  // If stored times are non-canonical (i.e. specific), turn on the specific-times mode
  const hasSpecific = existingTimes.length > 0 && !areSlotTimes(existingTimes);
  return {
    ...EMPTY_MED_FORM,
    name: existing.name,
    genericName: existing.genericName || "",
    form: existing.form,
    dosageAmount: String(existing.dosageAmount),
    dosageUnit: existing.dosageUnit,
    strength: existing.strength || "",
    scheduleType: existing.scheduleType,
    frequency: existing.frequency || "once_daily",
    selectedSlots: existing.scheduleType === "as_needed" ? ["Morning"]
      : hasSpecific ? timesToSlots(existingTimes).length ? timesToSlots(existingTimes) : ["Morning"]
      : timesToSlots(existingTimes).length ? timesToSlots(existingTimes) : ["Morning"],
    useSpecificTimes: existing.scheduleType !== "as_needed" && hasSpecific,
    specificTimes: hasSpecific ? existingTimes : [],
    frequencyNote: existing.frequencyNote || "",
    prescribingPhysician: existing.prescribingPhysician || "",
    pharmacy: existing.pharmacy || "",
    rxNumber: existing.rxNumber || "",
    purpose: existing.purpose || "",
    instructions: existing.instructions || "",
    sideEffectsToWatch: existing.sideEffectsToWatch || "",
    startDate: existing.startDate || new Date().toISOString().split("T")[0],
    notes: existing.notes || "",
    changeNote: "",
  };
}

function MedFormDialog({
  open, onClose, onSubmit, isPending, existing,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  existing?: Medication | null;
}) {
  const isEdit = !!existing;
  const [form, setForm] = useState(() =>
    existing ? buildFormFromExisting(existing) : { ...EMPTY_MED_FORM }
  );

  // Reset form whenever the dialog opens or the target medication changes
  useEffect(() => {
    if (open) {
      setForm(existing ? buildFormFromExisting(existing) : { ...EMPTY_MED_FORM });
    }
  }, [open, existing?.id]);

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));
  const isPRN = form.scheduleType === "as_needed";

  const toggleSlot = (label: string) => {
    setForm(prev => {
      const slots = prev.selectedSlots.includes(label)
        ? prev.selectedSlots.filter(s => s !== label)
        : [...prev.selectedSlots, label];
      // Always keep at least one slot selected
      return { ...prev, selectedSlots: slots.length ? slots : [label] };
    });
  };

  const addSpecificTime = () => set("specificTimes", [...form.specificTimes, "09:00"]);
  const removeSpecificTime = (i: number) =>
    set("specificTimes", form.specificTimes.filter((_, idx) => idx !== i));
  const updateSpecificTime = (i: number, val: string) =>
    set("specificTimes", form.specificTimes.map((t, idx) => idx === i ? val : t));

  const handleSubmit = () => {
    let times: string[] | undefined;
    if (!isPRN) {
      if (form.useSpecificTimes && form.specificTimes.length > 0) {
        // Sort specific times chronologically
        times = [...form.specificTimes].sort();
      } else {
        times = slotsToTimes(form.selectedSlots);
      }
    }
    onSubmit({
      name: form.name,
      genericName: form.genericName || undefined,
      form: form.form,
      dosageAmount: Number(form.dosageAmount),
      dosageUnit: form.dosageUnit,
      strength: form.strength || undefined,
      scheduleType: form.scheduleType,
      frequency: isPRN ? undefined : form.frequency,
      scheduledTimes: times ? JSON.stringify(times) : undefined,
      frequencyNote: form.frequencyNote || undefined,
      prescribingPhysician: form.prescribingPhysician || undefined,
      pharmacy: form.pharmacy || undefined,
      rxNumber: form.rxNumber || undefined,
      purpose: form.purpose || undefined,
      instructions: form.instructions || undefined,
      sideEffectsToWatch: form.sideEffectsToWatch || undefined,
      startDate: form.startDate || new Date().toISOString().split("T")[0],
      notes: form.notes || undefined,
      changeNote: form.changeNote || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pill size={16} className="text-primary" />
            {isEdit ? "Edit Medication" : "Add Medication"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Identity */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Medication</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 relative">
                {isEdit ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name *</Label>
                    <Input value={form.name} onChange={e => set("name", e.target.value)}
                      className="h-8 text-sm" data-testid="med-name" />
                  </div>
                ) : (
                  <DrugSearchInput
                    value={form.name}
                    onSelect={(name, genericName) => {
                      set("name", name);
                      if (genericName) set("genericName", genericName);
                    }}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Generic name</Label>
                <Input value={form.genericName} onChange={e => set("genericName", e.target.value)}
                  placeholder={isEdit ? "" : "Auto-fills on selection"} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Form</Label>
                <Select value={form.form} onValueChange={v => set("form", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORM_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dosage amount *</Label>
                <Input type="number" step="0.1" value={form.dosageAmount}
                  onChange={e => set("dosageAmount", e.target.value)}
                  placeholder="e.g. 10" className="h-8 text-sm" data-testid="med-dosage" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Select value={form.dosageUnit} onValueChange={v => set("dosageUnit", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["mg", "mcg", "ml", "units", "%", "other"].map(u => (
                      <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Type</Label>
                <div className="flex gap-2">
                  {["scheduled", "as_needed"].map(t => (
                    <button key={t} onClick={() => set("scheduleType", t)}
                      className={cn("flex-1 rounded-lg border py-2 text-xs font-medium transition-all",
                        form.scheduleType === t ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                      {t === "scheduled" ? "Scheduled" : "As Needed (PRN)"}
                    </button>
                  ))}
                </div>
              </div>
              {!isPRN && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Frequency</Label>
                    <Select value={form.frequency} onValueChange={v => set("frequency", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FREQUENCY_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    {/* General time-of-day — hidden when specific times are on */}
                    {!form.useSpecificTimes && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Time of day <span className="text-muted-foreground">(select all that apply)</span></Label>
                        <div className="flex gap-1.5 flex-wrap">
                          {TIME_SLOTS.map(slot => {
                            const selected = form.selectedSlots.includes(slot.label);
                            return (
                              <button
                                key={slot.label}
                                type="button"
                                onClick={() => toggleSlot(slot.label)}
                                className={cn(
                                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                                  selected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:border-primary/50"
                                )}
                              >
                                <span>{slot.emoji}</span>
                                {slot.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Specific times toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = !form.useSpecificTimes;
                        setForm(prev => ({
                          ...prev,
                          useSpecificTimes: next,
                          // Pre-seed one entry when turning on
                          specificTimes: next && prev.specificTimes.length === 0 ? ["09:00"] : prev.specificTimes,
                        }));
                      }}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all",
                        form.useSpecificTimes
                          ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300"
                          : "border-border text-muted-foreground hover:border-teal-400"
                      )}
                    >
                      <Clock size={12} />
                      {form.useSpecificTimes ? "Using specific times" : "Set specific times"}
                    </button>

                    {/* Specific times list */}
                    {form.useSpecificTimes && (
                      <div className="space-y-2 pl-1">
                        <p className="text-[10px] text-muted-foreground">Exact times this medication must be taken — overrides general time of day</p>
                        {form.specificTimes.map((t, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={t}
                              onChange={e => updateSpecificTime(i, e.target.value)}
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <span className="text-xs text-muted-foreground min-w-[52px]">{fmt24to12(t)}</span>
                            <button
                              type="button"
                              onClick={() => removeSpecificTime(i)}
                              className="text-muted-foreground hover:text-red-500 flex-shrink-0"
                              aria-label="Remove time"
                            >
                              <XCircle size={15} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addSpecificTime}
                          className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium mt-1"
                        >
                          <Plus size={13} />
                          Add time
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">{isPRN ? "Conditions / limits" : "Additional note"}</Label>
                <Input value={form.frequencyNote} onChange={e => set("frequencyNote", e.target.value)}
                  placeholder={isPRN ? "e.g. Max 4 doses per 24 hrs" : "e.g. Take with food"}
                  className="h-8 text-sm" />
              </div>
            </div>
          </div>

          {/* Prescriber */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prescriber & Pharmacy</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Physician</Label>
                <Input value={form.prescribingPhysician} onChange={e => set("prescribingPhysician", e.target.value)}
                  placeholder="Dr. Name" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pharmacy</Label>
                <Input value={form.pharmacy} onChange={e => set("pharmacy", e.target.value)}
                  placeholder="Pharmacy name" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rx number</Label>
                <Input value={form.rxNumber} onChange={e => set("rxNumber", e.target.value)}
                  placeholder="RX-XXXXX" className="h-8 text-sm" />
              </div>

            </div>
          </div>

          {/* Clinical */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clinical Details</div>
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs">Purpose</Label>
                <Input value={form.purpose} onChange={e => set("purpose", e.target.value)}
                  placeholder="e.g. Blood pressure control" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Instructions</Label>
                <Textarea value={form.instructions} onChange={e => set("instructions", e.target.value)}
                  placeholder="e.g. Take with food" className="text-sm resize-none min-h-[52px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Side effects to watch for</Label>
                <Input value={form.sideEffectsToWatch} onChange={e => set("sideEffectsToWatch", e.target.value)}
                  placeholder="e.g. Dizziness, nausea" className="h-8 text-sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)}
                className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder="Optional" className="h-8 text-sm" />
            </div>
          </div>

          {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for change <span className="text-muted-foreground">(required for audit trail)</span></Label>
              <Input value={form.changeNote} onChange={e => set("changeNote", e.target.value)}
                placeholder="e.g. Dose increased per Dr. Chen 4/27" className="h-8 text-sm"
                data-testid="med-change-note" />
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="flex-1" onClick={handleSubmit}
              disabled={isPending || !form.name || !form.dosageAmount} data-testid="med-submit">
              {isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}
              {isEdit ? "Save Changes" : "Add Medication"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Discontinue Dialog ────────────────────────────────────────────────────────
function DiscontinueDialog({
  med, open, onClose, onSubmit, isPending,
}: {
  med: Medication | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  if (!med) return null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-red-600">
            <XCircle size={16} />
            Discontinue {med.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            This medication will be moved to the archive. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-8 text-xs" data-testid="discontinue-reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DISCONTINUE_REASONS).map(([v, l]) => (
                  <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date discontinued</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes <span className="text-muted-foreground">(physician order, context, etc.)</span></Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Discontinued per Dr. Chen order 4/27 due to side effects."
              className="text-sm resize-none min-h-[72px]" data-testid="discontinue-note" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" size="sm" className="flex-1"
              disabled={isPending || !reason || !note.trim()}
              onClick={() => onSubmit({ reason, note, date })} data-testid="discontinue-submit">
              {isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : <XCircle size={13} className="mr-1" />}
              Discontinue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MedicationsPage() {
  const { activeUser, selectedClientId, portalMode } = useApp();
  const isFamilyPortal = portalMode === "family";
  const { t } = useLang();
  const { toast } = useToast();
  const canEdit = isCaregiverRole(activeUser.role) || activeUser.role === "primary_family";
  const isMC = activeUser.role === "primary_family";
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";

  const [addOpen, setAddOpen] = useState(false);
  const [editMed, setEditMed] = useState<Medication | null>(null);
  const [logMed, setLogMed] = useState<Medication | null>(null);
  const [discontinueMed, setDiscontinueMed] = useState<Medication | null>(null);

  const { data: allMeds = [], isLoading } = useQuery<Medication[]>({
    queryKey: ["/api/clients", selectedClientId, "medications"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/medications`).then(r => r.json()),
  });

  const { data: logs = [] } = useQuery<MedicationLog[]>({
    queryKey: ["/api/clients", selectedClientId, "medication-logs"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/medication-logs?limit=50`).then(r => r.json()),
  });

  const activeMeds = allMeds.filter(m => m.status === "active");
  const archivedMeds = allMeds.filter(m => m.status === "discontinued");
  const prnMeds = activeMeds.filter(m => m.scheduleType === "as_needed").sort((a, b) => a.name.localeCompare(b.name));

  // ── Time-of-day grouping for scheduled meds ──────────────────────────────
  // Returns ALL time groups a med belongs to (may appear in multiple)
  const getTimeGroups = (med: Medication): Set<"morning" | "afternoon" | "evening"> => {
    try {
      const times: string[] = JSON.parse(med.scheduledTimes || "[]");
      if (!times.length) return new Set(["morning"]);
      const groups = new Set<"morning" | "afternoon" | "evening">();
      times.forEach(t => {
        const h = parseInt(t.split(":")[0], 10);
        if (h >= 5 && h < 12) groups.add("morning");
        else if (h >= 12 && h < 17) groups.add("afternoon");
        else groups.add("evening");
      });
      return groups;
    } catch { return new Set(["morning"]); }
  };

  const scheduledMeds = activeMeds.filter(m => m.scheduleType === "scheduled");
  const sortAlpha = (a: Medication, b: Medication) => a.name.localeCompare(b.name);
  const morningMeds   = scheduledMeds.filter(m => getTimeGroups(m).has("morning")).sort(sortAlpha);
  const afternoonMeds = scheduledMeds.filter(m => getTimeGroups(m).has("afternoon")).sort(sortAlpha);
  const eveningMeds   = scheduledMeds.filter(m => getTimeGroups(m).has("evening")).sort(sortAlpha);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/clients/${selectedClientId}/medications`, {
      ...data,
      addedByRole: activeUser.role,
      addedByUserId: activeUser.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "medications"] });
      setAddOpen(false);
      toast({ title: isMC ? "Added to regimen" : "Medication added", description: isMC ? "Caregiver has been notified." : undefined });
    },
    onError: (err: any) => toast({ title: "Error saving medication", description: err?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/medications/${id}`, { ...data, changedByUserId: activeUser.id, changeNote: data.changeNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "medications"] });
      setEditMed(null);
      toast({ title: "Medication updated" });
    },
    onError: () => toast({ title: "Error updating medication", variant: "destructive" }),
  });

  const discontinueMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("POST", `/api/medications/${id}/discontinue`, { ...data, changedByUserId: activeUser.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "medications"] });
      setDiscontinueMed(null);
      toast({ title: "Medication discontinued and archived" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const logMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/clients/${selectedClientId}/medication-logs`, {
      ...data, caregiverId: activeUser.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "medication-logs"] });
      setLogMed(null);
      toast({ title: "Dose logged" });
    },
    onError: () => toast({ title: "Error logging dose", variant: "destructive" }),
  });

  // Build a map of medId -> last log time for the log tab
  const medNames = Object.fromEntries(allMeds.map(m => [m.id, m.name]));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <ModuleIntro moduleKey="medications" />
      {/* Header */}
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center flex-shrink-0">
            <Pill size={20} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Medications</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeMeds.length} active · {prnMeds.length} PRN · {archivedMeds.length} archived
            </p>
          </div>
          <LessonLauncher pageKey="medications" />
        </div>
        {(isCaregiverRole(activeUser.role) || isMC) && (
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white" data-testid="add-med-btn">
            <Plus size={14} />
            {isMC ? "Add to Regimen" : "Add Medication"}
          </Button>
        )}
      </div>

      <Tabs defaultValue="active">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="active" className="text-xs px-3">
            Active {activeMeds.length > 0 && <span className="ml-1 bg-primary/15 text-primary rounded-full px-1.5 text-[10px]">{activeMeds.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="log" className="text-xs px-3">Admin Log</TabsTrigger>
          <TabsTrigger value="archive" className="text-xs px-3">
            Archive {archivedMeds.length > 0 && <span className="ml-1 bg-muted text-muted-foreground rounded-full px-1.5 text-[10px]">{archivedMeds.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* ── ACTIVE TAB ── */}
        <TabsContent value="active" className="mt-4 space-y-5">
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : activeMeds.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No active medications recorded.
              {canEdit && <div className="mt-2"><Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>Add first medication</Button></div>}
            </CardContent></Card>
          ) : (
            <>
              {/* Morning */}
              {morningMeds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">🌅</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Morning</span>
                  </div>
                  {morningMeds.map(m => (
                    <MedCard key={m.id} med={m} allMeds={allMeds} canEdit={canEdit} isFamilyPortal={isFamilyPortal}
                      onLogDose={setLogMed} onEdit={setEditMed} onDiscontinue={setDiscontinueMed} logs={logs} />
                  ))}
                </div>
              )}

              {/* Afternoon */}
              {afternoonMeds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">☀️</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Afternoon</span>
                  </div>
                  {afternoonMeds.map(m => (
                    <MedCard key={m.id} med={m} allMeds={allMeds} canEdit={canEdit} isFamilyPortal={isFamilyPortal}
                      onLogDose={setLogMed} onEdit={setEditMed} onDiscontinue={setDiscontinueMed} logs={logs} />
                  ))}
                </div>
              )}

              {/* Evening */}
              {eveningMeds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">🌙</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evening</span>
                  </div>
                  {eveningMeds.map(m => (
                    <MedCard key={m.id} med={m} allMeds={allMeds} canEdit={canEdit} isFamilyPortal={isFamilyPortal}
                      onLogDose={setLogMed} onEdit={setEditMed} onDiscontinue={setDiscontinueMed} logs={logs} />
                  ))}
                </div>
              )}
              {prnMeds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={13} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">As Needed (PRN)</span>
                  </div>
                  {prnMeds.map(m => (
                    <MedCard key={m.id} med={m} allMeds={allMeds} canEdit={canEdit} isFamilyPortal={isFamilyPortal}
                      onLogDose={setLogMed} onEdit={setEditMed} onDiscontinue={setDiscontinueMed} logs={logs} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── LOG TAB ── */}
        <TabsContent value="log" className="mt-4 space-y-2">
          {logs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No dose logs yet.</CardContent></Card>
          ) : (
            logs.map(log => {
              const medName = medNames[log.medicationId] || `Med #${log.medicationId}`;
              return (
                <div key={log.id} className={cn(
                  "rounded-lg border bg-card px-4 py-3 flex items-start gap-3",
                  !log.wasGiven && "border-red-200 dark:border-red-900"
                )} data-testid={`log-row-${log.id}`}>
                  <div className={cn("mt-0.5 flex-shrink-0",
                    log.wasGiven ? "text-emerald-500" : "text-red-400")}>
                    {log.wasGiven ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium">{medName}</span>
                      <span className="text-xs text-muted-foreground">{formatLogTime(log.loggedAt)}</span>
                      {!log.wasGiven && (
                        <Badge variant="outline" className="text-[10px] px-1.5 border-red-300 text-red-500 h-4">Not given</Badge>
                      )}
                      {log.prnReason && (
                        <Badge variant="outline" className="text-[10px] px-1.5 border-amber-300 text-amber-600 h-4">PRN</Badge>
                      )}
                    </div>
                    {log.prnReason && <div className="text-xs text-muted-foreground mt-0.5">Reason: {log.prnReason}</div>}
                    {log.refusalReason && <div className="text-xs text-red-500 mt-0.5">Reason not given: {log.refusalReason.replace(/_/g, " ")}</div>}
                    {log.reaction && <div className="text-xs text-amber-600 mt-0.5">Reaction: {log.reaction}</div>}
                    {log.notes && <div className="text-xs text-muted-foreground mt-0.5 italic">{log.notes}</div>}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* ── ARCHIVE TAB ── */}
        <TabsContent value="archive" className="mt-4 space-y-3">
          {archivedMeds.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No discontinued medications on record.
            </CardContent></Card>
          ) : (
            archivedMeds.map(m => (
              <Card key={m.id} className="opacity-80 border-dashed">
                <CardContent className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Archive size={13} className="text-muted-foreground" />
                        <span className="font-semibold text-sm">{m.name}</span>
                        {m.genericName && m.genericName !== m.name && (
                          <span className="text-xs text-muted-foreground">({m.genericName})</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {m.dosageAmount}{m.dosageUnit} · {FORM_LABELS[m.form] || m.form}
                        {m.purpose && ` · ${m.purpose}`}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground flex-shrink-0">Discontinued</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Started: </span>{formatDate(m.startDate)}</div>
                    <div><span className="text-muted-foreground">Discontinued: </span>{formatDate(m.discontinuedDate)}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">Reason: </span>
                      {DISCONTINUE_REASONS[m.discontinuedReason || ""] || m.discontinuedReason || "—"}
                    </div>
                  </div>
                  {m.discontinuedNote && (
                    <div className="mt-2 text-xs text-muted-foreground italic bg-muted/40 rounded px-2 py-1.5">
                      "{m.discontinuedNote}"
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <MedFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={data => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
      <MedFormDialog
        open={!!editMed}
        existing={editMed}
        onClose={() => setEditMed(null)}
        onSubmit={data => updateMutation.mutate({ id: editMed!.id, data })}
        isPending={updateMutation.isPending}
      />
      <LogDoseDialog
        med={logMed}
        open={!!logMed}
        onClose={() => setLogMed(null)}
        onSubmit={data => logMutation.mutate(data)}
        isPending={logMutation.isPending}
      />
      <DiscontinueDialog
        med={discontinueMed}
        open={!!discontinueMed}
        onClose={() => setDiscontinueMed(null)}
        onSubmit={data => discontinueMutation.mutate({ id: discontinueMed!.id, data })}
        isPending={discontinueMutation.isPending}
      />
    </div>
  );
}
