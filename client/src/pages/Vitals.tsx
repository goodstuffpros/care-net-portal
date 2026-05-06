import { useApp, isCaregiverRole } from "@/App";
import { LessonLauncher } from "@/components/LessonLauncher";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Vitals } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Heart, Activity, Thermometer, Wind, Scale, Droplets,
  Brain, Plus, TrendingUp, TrendingDown, Minus, ClipboardList,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── Reference ranges ─────────────────────────────────────────────────────────
function getBPStatus(sys: number, dia: number): "normal" | "elevated" | "high" | "critical" {
  if (sys >= 180 || dia >= 120) return "critical";
  if (sys >= 140 || dia >= 90) return "high";
  if (sys >= 130 || dia >= 80) return "elevated";
  return "normal";
}
function getHRStatus(hr: number): "low" | "normal" | "high" {
  if (hr < 60) return "low";
  if (hr > 100) return "high";
  return "normal";
}
function getTempStatus(t: number): "low" | "normal" | "fever" | "high_fever" {
  if (t < 97.0) return "low";
  if (t >= 103.0) return "high_fever";
  if (t >= 100.4) return "fever";
  return "normal";
}
function getO2Status(o2: number): "normal" | "low" | "critical" {
  if (o2 < 90) return "critical";
  if (o2 < 95) return "low";
  return "normal";
}
function getGlucoseStatus(g: number): "low" | "normal" | "elevated" | "high" {
  if (g < 70) return "low";
  if (g > 180) return "high";
  if (g > 140) return "elevated";
  return "normal";
}

const STATUS_COLORS = {
  normal: "text-emerald-600 dark:text-emerald-400",
  elevated: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
  fever: "text-amber-600 dark:text-amber-400",
  high_fever: "text-red-600 dark:text-red-400",
  low: "text-blue-600 dark:text-blue-400",
};
const STATUS_BG = {
  normal: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
  elevated: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
  high: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
  critical: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
  fever: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
  high_fever: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
  low: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " today";
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

const MOOD_LABELS: Record<string, string> = {
  calm: "Calm", anxious: "Anxious", confused: "Confused",
  agitated: "Agitated", happy: "Happy", sad: "Sad",
};
const MOOD_COLORS: Record<string, string> = {
  calm: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  anxious: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  confused: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  agitated: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  happy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  sad: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
};
const COG_LABELS: Record<string, string> = {
  oriented: "Oriented", mild_confusion: "Mild Confusion",
  moderate_confusion: "Moderate Confusion", unresponsive: "Unresponsive",
};

// ─── Vital Tile ────────────────────────────────────────────────────────────────
function VitalTile({
  icon: Icon, label, value, unit, status, sublabel,
}: {
  icon: any; label: string; value: string | null; unit?: string;
  status?: keyof typeof STATUS_COLORS; sublabel?: string;
}) {
  const s = status ?? "normal";
  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-1", STATUS_BG[s])}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon size={13} />
        <span>{label}</span>
      </div>
      {value ? (
        <div className={cn("text-xl font-bold leading-none", STATUS_COLORS[s])}>
          {value}
          {unit && <span className="text-sm font-normal ml-1 opacity-70">{unit}</span>}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic">—</div>
      )}
      {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
    </div>
  );
}

// ─── Entry Form ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  bloodPressureSystolic: "",
  bloodPressureDiastolic: "",
  heartRate: "",
  temperature: "",
  oxygenSaturation: "",
  weight: "",
  bloodGlucose: "",
  painLevel: 0,
  bowelMovement: false,
  bowelNotes: "",
  urination: false,
  urinationNotes: "",
  fluidIntake: "",
  mood: "",
  cognitionLevel: "",
  notes: "",
};

function VitalsForm({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = () => {
    const payload: any = {
      recordedAt: new Date().toISOString(),
      notes: form.notes || undefined,
      mood: form.mood || undefined,
      cognitionLevel: form.cognitionLevel || undefined,
      painLevel: form.painLevel,
      bowelMovement: form.bowelMovement,
      bowelNotes: form.bowelNotes || undefined,
      urination: form.urination,
      urinationNotes: form.urinationNotes || undefined,
      fluidIntake: form.fluidIntake ? Number(form.fluidIntake) : undefined,
    };
    if (form.bloodPressureSystolic && form.bloodPressureDiastolic) {
      payload.bloodPressureSystolic = Number(form.bloodPressureSystolic);
      payload.bloodPressureDiastolic = Number(form.bloodPressureDiastolic);
    }
    if (form.heartRate) payload.heartRate = Number(form.heartRate);
    if (form.temperature) payload.temperature = Number(form.temperature);
    if (form.oxygenSaturation) payload.oxygenSaturation = Number(form.oxygenSaturation);
    if (form.weight) payload.weight = Number(form.weight);
    if (form.bloodGlucose) payload.bloodGlucose = Number(form.bloodGlucose);
    onSubmit(payload);
  };

  return (
    <div className="space-y-5 pt-1">
      {/* Vital Signs */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vital Signs</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Blood Pressure (mmHg)</Label>
            <div className="flex items-center gap-2">
              <Input placeholder="Systolic" type="number" value={form.bloodPressureSystolic}
                onChange={e => set("bloodPressureSystolic", e.target.value)} className="h-8 text-sm" data-testid="vitals-bp-sys" />
              <span className="text-muted-foreground">/</span>
              <Input placeholder="Diastolic" type="number" value={form.bloodPressureDiastolic}
                onChange={e => set("bloodPressureDiastolic", e.target.value)} className="h-8 text-sm" data-testid="vitals-bp-dia" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Heart Rate (bpm)</Label>
            <Input placeholder="e.g. 72" type="number" value={form.heartRate}
              onChange={e => set("heartRate", e.target.value)} className="h-8 text-sm" data-testid="vitals-hr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Temperature (°F)</Label>
            <Input placeholder="e.g. 98.6" type="number" step="0.1" value={form.temperature}
              onChange={e => set("temperature", e.target.value)} className="h-8 text-sm" data-testid="vitals-temp" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">O₂ Saturation (%)</Label>
            <Input placeholder="e.g. 97" type="number" value={form.oxygenSaturation}
              onChange={e => set("oxygenSaturation", e.target.value)} className="h-8 text-sm" data-testid="vitals-o2" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Blood Glucose (mg/dL)</Label>
            <Input placeholder="e.g. 115" type="number" value={form.bloodGlucose}
              onChange={e => set("bloodGlucose", e.target.value)} className="h-8 text-sm" data-testid="vitals-glucose" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Weight (lbs)</Label>
            <Input placeholder="e.g. 182.5" type="number" step="0.1" value={form.weight}
              onChange={e => set("weight", e.target.value)} className="h-8 text-sm" data-testid="vitals-weight" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fluid Intake (oz)</Label>
            <Input placeholder="e.g. 24" type="number" value={form.fluidIntake}
              onChange={e => set("fluidIntake", e.target.value)} className="h-8 text-sm" data-testid="vitals-fluid" />
          </div>
        </div>
      </div>

      {/* Pain Level */}
      <div className="space-y-2">
        <Label className="text-xs">Pain Level: <span className="font-bold text-foreground">{form.painLevel}/10</span></Label>
        <Slider
          min={0} max={10} step={1}
          value={[form.painLevel]}
          onValueChange={([v]) => set("painLevel", v)}
          className="w-full"
          data-testid="vitals-pain-slider"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>No pain</span><span>Moderate</span><span>Worst pain</span>
        </div>
      </div>

      {/* Bodily Functions */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Bodily Functions</div>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="bm-check" checked={form.bowelMovement}
                onChange={e => set("bowelMovement", e.target.checked)}
                className="rounded" data-testid="vitals-bm-check" />
              <Label htmlFor="bm-check" className="text-sm cursor-pointer">Bowel Movement</Label>
            </div>
            {form.bowelMovement && (
              <Select value={form.bowelNotes} onValueChange={v => set("bowelNotes", v)}>
                <SelectTrigger className="h-7 text-xs w-32" data-testid="vitals-bm-notes">
                  <SelectValue placeholder="Character" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                  <SelectItem value="loose" className="text-xs">Loose</SelectItem>
                  <SelectItem value="hard" className="text-xs">Hard</SelectItem>
                  <SelectItem value="other" className="text-xs">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ur-check" checked={form.urination}
                onChange={e => set("urination", e.target.checked)}
                className="rounded" data-testid="vitals-ur-check" />
              <Label htmlFor="ur-check" className="text-sm cursor-pointer">Urination</Label>
            </div>
            {form.urination && (
              <Select value={form.urinationNotes} onValueChange={v => set("urinationNotes", v)}>
                <SelectTrigger className="h-7 text-xs w-32" data-testid="vitals-ur-notes">
                  <SelectValue placeholder="Character" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                  <SelectItem value="dark" className="text-xs">Dark</SelectItem>
                  <SelectItem value="frequent" className="text-xs">Frequent</SelectItem>
                  <SelectItem value="other" className="text-xs">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Mood & Cognition */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mood & Cognition</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mood</Label>
            <Select value={form.mood} onValueChange={v => set("mood", v)}>
              <SelectTrigger className="h-8 text-xs" data-testid="vitals-mood">
                <SelectValue placeholder="Select mood" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MOOD_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cognition</Label>
            <Select value={form.cognitionLevel} onValueChange={v => set("cognitionLevel", v)}>
              <SelectTrigger className="h-8 text-xs" data-testid="vitals-cog">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COG_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea placeholder="Additional observations..." value={form.notes}
          onChange={e => set("notes", e.target.value)} className="text-sm resize-none min-h-[60px]"
          data-testid="vitals-notes" />
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={isPending} data-testid="vitals-submit">
        {isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
        {isPending ? "Saving..." : "Save Vitals Entry"}
      </Button>
    </div>
  );
}

// ─── Trend Chart ───────────────────────────────────────────────────────────────
function TrendChart({
  data, dataKey, label, unit, refLow, refHigh, color = "#2a8c7a",
}: {
  data: Vitals[]; dataKey: keyof Vitals; label: string; unit?: string;
  refLow?: number; refHigh?: number; color?: string;
}) {
  const chartData = [...data]
    .filter(v => v[dataKey] != null)
    .reverse()
    .slice(-14)
    .map(v => ({ date: formatDate(v.recordedAt), value: v[dataKey] as number }));

  if (chartData.length < 2) {
    return <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">Not enough data to chart</div>;
  }

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
          <YAxis tick={{ fontSize: 9 }} tickLine={false} />
          <Tooltip
            formatter={(v: any) => [`${v}${unit ? " " + unit : ""}`, label]}
            labelStyle={{ fontSize: 11 }}
            contentStyle={{ fontSize: 11, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
          />
          {refLow && <ReferenceLine y={refLow} stroke="#60a5fa" strokeDasharray="3 3" strokeOpacity={0.6} />}
          {refHigh && <ReferenceLine y={refHigh} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.6} />}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2, fill: color }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── History Row ───────────────────────────────────────────────────────────────
function HistoryRow({ v, expanded, onToggle }: { v: Vitals; expanded: boolean; onToggle: () => void }) {
  const bpStatus = v.bloodPressureSystolic && v.bloodPressureDiastolic
    ? getBPStatus(v.bloodPressureSystolic, v.bloodPressureDiastolic) : null;
  const hasAlert = bpStatus === "high" || bpStatus === "critical"
    || (v.oxygenSaturation && getO2Status(v.oxygenSaturation) !== "normal")
    || (v.temperature && getTempStatus(v.temperature) !== "normal" && getTempStatus(v.temperature) !== "low");

  return (
    <div className={cn("rounded-lg border bg-card transition-colors", hasAlert && "border-amber-200 dark:border-amber-800")}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={onToggle}
        data-testid={`vitals-history-row-${v.id}`}
      >
        {hasAlert && <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-foreground">{formatTime(v.recordedAt)}</div>
          <div className="flex items-center flex-wrap gap-2 mt-0.5">
            {v.bloodPressureSystolic && (
              <span className={cn("text-xs", bpStatus ? STATUS_COLORS[bpStatus] : "")}>
                BP {v.bloodPressureSystolic}/{v.bloodPressureDiastolic}
              </span>
            )}
            {v.heartRate && <span className="text-xs text-muted-foreground">HR {v.heartRate}</span>}
            {v.oxygenSaturation && <span className="text-xs text-muted-foreground">O₂ {v.oxygenSaturation}%</span>}
            {v.temperature && <span className="text-xs text-muted-foreground">{v.temperature}°F</span>}
            {v.painLevel !== null && v.painLevel !== undefined && v.painLevel > 0 && (
              <span className={cn("text-xs", v.painLevel >= 7 ? "text-red-500" : v.painLevel >= 4 ? "text-amber-500" : "text-muted-foreground")}>
                Pain {v.painLevel}/10
              </span>
            )}
            {v.mood && <span className={cn("text-xs px-1.5 py-0.5 rounded-full", MOOD_COLORS[v.mood] || "bg-muted")}>{MOOD_LABELS[v.mood] || v.mood}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {v.bloodGlucose && <div><span className="text-muted-foreground">Blood Glucose:</span> <span className={cn("font-medium", STATUS_COLORS[getGlucoseStatus(v.bloodGlucose)])}>{v.bloodGlucose} mg/dL</span></div>}
          {v.weight && <div><span className="text-muted-foreground">Weight:</span> <span className="font-medium">{v.weight} lbs</span></div>}
          {v.fluidIntake && <div><span className="text-muted-foreground">Fluid Intake:</span> <span className="font-medium">{v.fluidIntake} oz</span></div>}
          {v.cognitionLevel && <div><span className="text-muted-foreground">Cognition:</span> <span className="font-medium">{COG_LABELS[v.cognitionLevel] || v.cognitionLevel}</span></div>}
          <div><span className="text-muted-foreground">Bowel:</span> <span className="font-medium">{v.bowelMovement ? (v.bowelNotes ? `Yes — ${v.bowelNotes}` : "Yes") : "Not recorded"}</span></div>
          <div><span className="text-muted-foreground">Urination:</span> <span className="font-medium">{v.urination ? (v.urinationNotes ? `Yes — ${v.urinationNotes}` : "Yes") : "Not recorded"}</span></div>
          {v.notes && <div className="col-span-2 mt-1 p-2 bg-muted/40 rounded text-muted-foreground italic">"{v.notes}"</div>}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function VitalsPage() {
  const { activeUser, selectedClientId } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const canEdit = isCaregiverRole(activeUser.role);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: records = [], isLoading } = useQuery<Vitals[]>({
    queryKey: ["/api/clients", selectedClientId, "vitals"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/vitals`).then(r => r.json()),
    refetchInterval: 60000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/clients/${selectedClientId}/vitals`, {
      ...data,
      caregiverId: activeUser.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "vitals"] });
      setAddOpen(false);
      toast({ title: "Vitals recorded", description: "Entry saved to history." });
    },
    onError: () => toast({ title: "Error saving vitals", variant: "destructive" }),
  });

  const latest = records[0] ?? null;

  // Derive trend (latest vs previous reading)
  function trend(key: keyof Vitals): "up" | "down" | "same" | null {
    const vals = records.filter(r => r[key] != null).slice(0, 2);
    if (vals.length < 2) return null;
    const diff = (vals[0][key] as number) - (vals[1][key] as number);
    if (Math.abs(diff) < 1) return "same";
    return diff > 0 ? "up" : "down";
  }
  function TrendIcon({ dir }: { dir: "up" | "down" | "same" | null }) {
    if (!dir || dir === "same") return <Minus size={11} className="text-muted-foreground" />;
    return dir === "up"
      ? <TrendingUp size={11} className="text-amber-500" />
      : <TrendingDown size={11} className="text-emerald-500" />;
  }

  const bpStatus = latest?.bloodPressureSystolic && latest?.bloodPressureDiastolic
    ? getBPStatus(latest.bloodPressureSystolic, latest.bloodPressureDiastolic) : "normal";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Vitals & Bodily Functions
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Health monitoring · Trend tracking</p>
          <div className="mt-2"><LessonLauncher pageKey="vitals" /></div>
        </div>
        {canEdit && (
          <Button onClick={() => setAddOpen(true)} size="sm" className="flex-shrink-0" data-testid="vitals-add-btn">
            <Plus size={14} className="mr-1" />
            Log Vitals
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="overview" className="text-xs px-3">Overview</TabsTrigger>
          <TabsTrigger value="trends" className="text-xs px-3">Trends</TabsTrigger>
          <TabsTrigger value="history" className="text-xs px-3">History</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : !latest ? (
            <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground py-12">
              No vitals recorded yet. {canEdit && "Log the first entry to get started."}
            </CardContent></Card>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 size={13} className="text-emerald-500" />
                Last recorded {formatTime(latest.recordedAt)}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <VitalTile
                  icon={Heart} label="Blood Pressure"
                  value={latest.bloodPressureSystolic && latest.bloodPressureDiastolic
                    ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}` : null}
                  unit="mmHg" status={bpStatus}
                  sublabel={bpStatus === "normal" ? "Normal range" : bpStatus === "elevated" ? "Elevated" : bpStatus === "high" ? "High — monitor" : "Critical — act now"}
                />
                <VitalTile
                  icon={Activity} label="Heart Rate"
                  value={latest.heartRate?.toString() ?? null} unit="bpm"
                  status={latest.heartRate ? getHRStatus(latest.heartRate) : "normal"}
                />
                <VitalTile
                  icon={Thermometer} label="Temperature"
                  value={latest.temperature?.toFixed(1) ?? null} unit="°F"
                  status={latest.temperature ? getTempStatus(latest.temperature) : "normal"}
                />
                <VitalTile
                  icon={Wind} label="O₂ Saturation"
                  value={latest.oxygenSaturation?.toString() ?? null} unit="%"
                  status={latest.oxygenSaturation ? getO2Status(latest.oxygenSaturation) : "normal"}
                />
                <VitalTile
                  icon={Droplets} label="Blood Glucose"
                  value={latest.bloodGlucose?.toString() ?? null} unit="mg/dL"
                  status={latest.bloodGlucose ? getGlucoseStatus(latest.bloodGlucose) : "normal"}
                />
                <VitalTile
                  icon={Scale} label="Weight"
                  value={latest.weight?.toFixed(1) ?? null} unit="lbs"
                />
                <VitalTile
                  icon={Heart} label="Fluid Intake"
                  value={latest.fluidIntake?.toString() ?? null} unit="oz"
                  sublabel={latest.fluidIntake && latest.fluidIntake < 20 ? "Below target (24 oz)" : undefined}
                  status={latest.fluidIntake && latest.fluidIntake < 20 ? "elevated" : "normal"}
                />
                <VitalTile
                  icon={Brain} label="Pain Level"
                  value={latest.painLevel !== null && latest.painLevel !== undefined ? `${latest.painLevel}/10` : null}
                  status={!latest.painLevel ? "normal" : latest.painLevel >= 7 ? "critical" : latest.painLevel >= 4 ? "elevated" : "normal"}
                />
              </div>

              {/* Mood + Cognition + Bodily Functions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain size={14} /> Mood & Cognition
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {latest.mood && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Mood</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", MOOD_COLORS[latest.mood] || "bg-muted")}>
                          {MOOD_LABELS[latest.mood] || latest.mood}
                        </span>
                      </div>
                    )}
                    {latest.cognitionLevel && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Cognition</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                          latest.cognitionLevel === "oriented" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : latest.cognitionLevel === "mild_confusion" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400")}>
                          {COG_LABELS[latest.cognitionLevel] || latest.cognitionLevel}
                        </span>
                      </div>
                    )}
                    {!latest.mood && !latest.cognitionLevel && (
                      <div className="text-xs text-muted-foreground italic">Not recorded in this entry</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardList size={14} /> Bodily Functions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Bowel Movement</span>
                      <div className="flex items-center gap-1.5">
                        {latest.bowelMovement
                          ? <CheckCircle2 size={13} className="text-emerald-500" />
                          : <Minus size={13} className="text-muted-foreground" />}
                        <span className="text-xs font-medium">
                          {latest.bowelMovement ? (latest.bowelNotes ? `Yes — ${latest.bowelNotes}` : "Yes") : "Not recorded"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Urination</span>
                      <div className="flex items-center gap-1.5">
                        {latest.urination
                          ? <CheckCircle2 size={13} className="text-emerald-500" />
                          : <Minus size={13} className="text-muted-foreground" />}
                        <span className="text-xs font-medium">
                          {latest.urination ? (latest.urinationNotes ? `Yes — ${latest.urinationNotes}` : "Yes") : "Not recorded"}
                        </span>
                      </div>
                    </div>
                    {latest.notes && (
                      <div className="pt-1 text-xs text-muted-foreground italic border-t border-border mt-2">"{latest.notes}"</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── TRENDS TAB ── */}
        <TabsContent value="trends" className="mt-4">
          {records.length < 2 ? (
            <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground py-12">
              Need at least 2 entries to show trends.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "bloodPressureSystolic" as keyof Vitals, label: "Systolic BP", unit: "mmHg", refLow: 90, refHigh: 140, color: "#e05252" },
                { key: "bloodPressureDiastolic" as keyof Vitals, label: "Diastolic BP", unit: "mmHg", refLow: 60, refHigh: 90, color: "#e07a52" },
                { key: "heartRate" as keyof Vitals, label: "Heart Rate", unit: "bpm", refLow: 60, refHigh: 100, color: "#2a8c7a" },
                { key: "oxygenSaturation" as keyof Vitals, label: "O₂ Saturation", unit: "%", refLow: 95, color: "#5282e0" },
                { key: "temperature" as keyof Vitals, label: "Temperature", unit: "°F", refLow: 97, refHigh: 100.4, color: "#e0a052" },
                { key: "bloodGlucose" as keyof Vitals, label: "Blood Glucose", unit: "mg/dL", refLow: 70, refHigh: 140, color: "#8c52e0" },
                { key: "weight" as keyof Vitals, label: "Weight", unit: "lbs", color: "#52a0e0" },
                { key: "painLevel" as keyof Vitals, label: "Pain Level", unit: "/10", refHigh: 7, color: "#e05252" },
              ].map(cfg => (
                <Card key={cfg.key}>
                  <CardHeader className="pb-1 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>{cfg.label}</span>
                      <div className="flex items-center gap-1 text-[10px]">
                        <TrendIcon dir={trend(cfg.key)} />
                        {latest && latest[cfg.key] != null && (
                          <span className="font-medium text-foreground">{String(latest[cfg.key])}{cfg.unit !== "/10" ? "" : ""} {cfg.unit}</span>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <TrendChart data={records} dataKey={cfg.key} label={cfg.label} unit={cfg.unit} refLow={cfg.refLow} refHigh={cfg.refHigh} color={cfg.color} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── HISTORY TAB ── */}
        <TabsContent value="history" className="mt-4 space-y-2">
          {isLoading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)
          ) : records.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground py-12">
              No vitals history yet.
            </CardContent></Card>
          ) : (
            records.map(v => (
              <HistoryRow
                key={v.id} v={v}
                expanded={expandedId === v.id}
                onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              Log Vitals & Bodily Functions
            </DialogTitle>
          </DialogHeader>
          <VitalsForm onSubmit={data => createMutation.mutate(data)} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
