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
  Pill, Plus, Clock, AlertTriangle, CheckCircle2, ChevronDown,
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
    return arr.map(t => {
      const [h, m] = t.split(":");
      const d = new Date();
      d.setHours(Number(h), Number(m));
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }).join(" · ");
  } catch { return times; }
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
  med, allMeds, canEdit, isFamilyPortal, onLogDose, onEdit, onDiscontinue,
}: {
  med: Medication;
  allMeds: Medication[];
  canEdit: boolean;
  isFamilyPortal: boolean;
  onLogDose: (med: Medication) => void;
  onEdit: (med: Medication) => void;
  onDiscontinue: (med: Medication) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPRN = med.scheduleType === "as_needed";

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
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onLogDose(med)} data-testid={`log-dose-${med.id}`} title="Log dose">
                  <CheckCircle2 size={14} className="text-emerald-600" />
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
            {med.rxNumber && !isFamilyPortal && (
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

// ─── Add / Edit Medication Dialog ─────────────────────────────────────────────
const EMPTY_MED_FORM = {
  name: "", genericName: "", form: "tablet", dosageAmount: "",
  dosageUnit: "mg", strength: "",
  scheduleType: "scheduled", frequency: "once_daily",
  scheduledTimes: ["08:00"], frequencyNote: "",
  prescribingPhysician: "", pharmacy: "", rxNumber: "",
  purpose: "", instructions: "", sideEffectsToWatch: "",
  startDate: new Date().toISOString().split("T")[0],
  notes: "", changeNote: "",
};

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
    existing ? {
      ...EMPTY_MED_FORM,
      name: existing.name,
      genericName: existing.genericName || "",
      form: existing.form,
      dosageAmount: String(existing.dosageAmount),
      dosageUnit: existing.dosageUnit,
      strength: existing.strength || "",
      scheduleType: existing.scheduleType,
      frequency: existing.frequency || "once_daily",
      scheduledTimes: existing.scheduledTimes ? JSON.parse(existing.scheduledTimes) : ["08:00"],
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
    } : EMPTY_MED_FORM
  );

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));
  const isPRN = form.scheduleType === "as_needed";

  const handleSubmit = () => {
    onSubmit({
      name: form.name,
      genericName: form.genericName || undefined,
      form: form.form,
      dosageAmount: Number(form.dosageAmount),
      dosageUnit: form.dosageUnit,
      strength: form.strength || undefined,
      scheduleType: form.scheduleType,
      frequency: isPRN ? undefined : form.frequency,
      scheduledTimes: isPRN ? undefined : JSON.stringify(form.scheduledTimes),
      frequencyNote: form.frequencyNote || undefined,
      prescribingPhysician: form.prescribingPhysician || undefined,
      pharmacy: form.pharmacy || undefined,
      rxNumber: form.rxNumber || undefined,
      purpose: form.purpose || undefined,
      instructions: form.instructions || undefined,
      sideEffectsToWatch: form.sideEffectsToWatch || undefined,
      startDate: form.startDate,
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
                  <div className="space-y-1.5">
                    <Label className="text-xs">Time(s) <span className="text-muted-foreground">(24hr, comma-sep)</span></Label>
                    <Input
                      value={form.scheduledTimes.join(",")}
                      onChange={e => set("scheduledTimes", e.target.value.split(",").map(s => s.trim()))}
                      placeholder="08:00,20:00" className="h-8 text-sm" />
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
  const canEdit = isCaregiverRole(activeUser.role);
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
    mutationFn: (data: any) => apiRequest("POST", `/api/clients/${selectedClientId}/medications`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "medications"] });
      setAddOpen(false);
      toast({ title: "Medication added" });
    },
    onError: () => toast({ title: "Error adding medication", variant: "destructive" }),
  });

  // ── MC: Add to Regimen ─────────────────────────────────────────────────
  const [mcMedOpen, setMcMedOpen] = useState(false);
  const [mcMedForm, setMcMedForm] = useState({
    name: "", dosage: "", frequency: "", scheduleType: "scheduled" as "scheduled" | "as_needed",
    prescribingDoctor: "", pharmacy: "", instructions: "", notes: "",
  });

  const mcMedMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/medications`, {
      name: mcMedForm.name,
      dosage: mcMedForm.dosage,
      frequency: mcMedForm.frequency,
      scheduleType: mcMedForm.scheduleType,
      prescribingDoctor: mcMedForm.prescribingDoctor,
      pharmacy: mcMedForm.pharmacy,
      instructions: mcMedForm.instructions,
      notes: mcMedForm.notes,
      status: "active",
      route: "oral",
      addedByRole: "primary_family",
      addedByUserId: activeUser.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "medications"] });
      setMcMedOpen(false);
      setMcMedForm({ name: "", dosage: "", frequency: "", scheduleType: "scheduled", prescribingDoctor: "", pharmacy: "", instructions: "", notes: "" });
      toast({ title: "Added to regimen", description: "Caregiver has been notified." });
    },
    onError: () => toast({ title: "Please fill in medication name and dosage", variant: "destructive" }),
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
        {isCaregiverRole(activeUser.role) && (
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white" data-testid="add-med-btn">
            <Plus size={14} />
            Add Medication
          </Button>
        )}
        {activeUser.role === "primary_family" && (
          <Dialog open={mcMedOpen} onOpenChange={setMcMedOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white" data-testid="mc-add-med-btn">
                <Plus size={14} />
                Add to Regimen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pill size={18} className="text-rose-600" /> Add to Medication Regimen
                </DialogTitle>
              </DialogHeader>
              {/* MC info banner */}
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                <span className="mt-0.5">⚠️</span>
                <span>Your caregiver will receive an <strong>urgent alert</strong> to review and confirm this addition.</span>
              </div>
              <div className="space-y-4 py-1">
                <div className="space-y-1.5 relative">
                  <DrugSearchInput
                    value={mcMedForm.name}
                    onSelect={(name) => setMcMedForm(f => ({ ...f, name }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Dosage <span className="text-red-500">*</span></Label>
                  <Input
                    value={mcMedForm.dosage}
                    onChange={e => setMcMedForm(f => ({ ...f, dosage: e.target.value }))}
                    placeholder="e.g. 25mg"
                    data-testid="mc-med-dosage"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Frequency</Label>
                    <Input
                      value={mcMedForm.frequency}
                      onChange={e => setMcMedForm(f => ({ ...f, frequency: e.target.value }))}
                      placeholder="e.g. Twice daily"
                      data-testid="mc-med-frequency"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={mcMedForm.scheduleType} onValueChange={v => setMcMedForm(f => ({ ...f, scheduleType: v as any }))}>
                      <SelectTrigger data-testid="mc-med-schedule-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="as_needed">As Needed (PRN)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Prescribing Doctor</Label>
                  <Input
                    value={mcMedForm.prescribingDoctor}
                    onChange={e => setMcMedForm(f => ({ ...f, prescribingDoctor: e.target.value }))}
                    placeholder="e.g. Dr. Williams"
                    data-testid="mc-med-doctor"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pharmacy</Label>
                  <Input
                    value={mcMedForm.pharmacy}
                    onChange={e => setMcMedForm(f => ({ ...f, pharmacy: e.target.value }))}
                    placeholder="e.g. CVS on Main St."
                    data-testid="mc-med-pharmacy"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Administration Instructions</Label>
                  <Input
                    value={mcMedForm.instructions}
                    onChange={e => setMcMedForm(f => ({ ...f, instructions: e.target.value }))}
                    placeholder="e.g. Take with food"
                    data-testid="mc-med-instructions"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes for Caregiver</Label>
                  <Textarea
                    value={mcMedForm.notes}
                    onChange={e => setMcMedForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any relevant context, side effects to watch, or special instructions..."
                    rows={3}
                    data-testid="mc-med-notes"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => mcMedMutation.mutate()}
                  disabled={!mcMedForm.name || !mcMedForm.dosage || mcMedMutation.isPending}
                  data-testid="mc-save-med-btn"
                >
                  {mcMedMutation.isPending ? "Saving…" : "Add to Regimen & Notify Caregiver"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="active">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="active" className="text-xs px-3">
            Active {activeMeds.length > 0 && <span className="ml-1 bg-primary/15 text-primary rounded-full px-1.5 text-[10px]">{activeMeds.length}</span>}
          </TabsTrigger>
          {!isFamilyPortal && !isFamily && (
            <TabsTrigger value="log" className="text-xs px-3">Admin Log</TabsTrigger>
          )}
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
                      onLogDose={setLogMed} onEdit={setEditMed} onDiscontinue={setDiscontinueMed} />
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
                      onLogDose={setLogMed} onEdit={setEditMed} onDiscontinue={setDiscontinueMed} />
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
                      onLogDose={setLogMed} onEdit={setEditMed} onDiscontinue={setDiscontinueMed} />
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
                      onLogDose={setLogMed} onEdit={setEditMed} onDiscontinue={setDiscontinueMed} />
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
