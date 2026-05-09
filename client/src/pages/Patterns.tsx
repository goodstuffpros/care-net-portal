import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  AlertTriangle, Brain, ChevronDown, ChevronUp, Clock, FileText,
  Info, Send, Settings, ShieldCheck, TrendingUp, X, CheckCircle2,
  Pill, Activity, Utensils, Moon, Heart, Eye, RefreshCw, Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface HealthPattern {
  id: number;
  client_id: number;
  pattern_key: string;
  label: string;
  description: string;
  symptom_tag: string;
  correlated_with: string | null;
  severity: "mild" | "moderate" | "severe";
  occurrence_count: number;
  consecutive_days: number;
  window_days: number;
  first_seen_at: string;
  last_seen_at: string;
  alert_3day_fired_at: string | null;
  alert_7day_fired_at: string | null;
  alert_3x_week_fired_at: string | null;
  alert_6x_2week_fired_at: string | null;
  status: "active" | "dismissed" | "escalated" | "resolved";
  dismissed_until: string | null;
  escalated_at: string | null;
  doctor_note_text: string | null;
  doctor_note_sent_at: string | null;
  created_at: string;
}

interface PatternPreference {
  watch_symptoms: boolean;
  watch_activity: boolean;
  watch_food: boolean;
  watch_sleep: boolean;
  watch_vitals: boolean;
  notify_threshold: string;
}

interface PatternsProps {
  activeUser: { id: number; role: string; clientId: number };
  selectedClientId: number;
  clientName: string;
}

const SEVERITY_CONFIG = {
  severe: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-900",
    badge: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
    dot: "bg-red-500",
    label: "Significant",
    icon: AlertTriangle,
  },
  moderate: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-900",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "Worth watching",
    icon: TrendingUp,
  },
  mild: {
    bg: "bg-slate-50 dark:bg-slate-900/30",
    border: "border-slate-200 dark:border-slate-800",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    dot: "bg-slate-400",
    label: "Mild",
    icon: Info,
  },
};

const CATEGORY_ICONS: Record<string, any> = {
  headache: Brain,
  dizziness: Activity,
  nausea: Heart,
  pain: AlertTriangle,
  fatigue: Moon,
  confusion: Brain,
  poor_sleep: Moon,
  poor_appetite: Utensils,
  appetite_loss: Utensils,
  fall: AlertTriangle,
  low_mood: Heart,
};

const THRESHOLD_OPTIONS = [
  { value: "summary_only", label: "Summary only", desc: "Only see patterns in weekly/monthly reports" },
  { value: "3day", label: "3 days in a row", desc: "Notify when a pattern repeats 3 consecutive days" },
  { value: "7day", label: "7 days in a row", desc: "Only notify on sustained week-long patterns" },
  { value: "severe_only", label: "Severe only", desc: "Only notify on high-severity patterns" },
];

function PatternCard({
  pattern,
  activeUser,
  clientName,
  onDismiss,
  onEscalate,
}: {
  pattern: HealthPattern;
  activeUser: { id: number; role: string };
  clientName: string;
  onDismiss: (id: number) => void;
  onEscalate: (id: number) => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showDoctorNote, setShowDoctorNote] = useState(false);
  const [noteText, setNoteText] = useState(pattern.doctor_note_text || "");
  const [acknowledged, setAcknowledged] = useState(false);

  const cfg = SEVERITY_CONFIG[pattern.severity] || SEVERITY_CONFIG.moderate;
  const Icon = CATEGORY_ICONS[pattern.symptom_tag] || TrendingUp;
  const isMC = activeUser.role === "primary_family" || activeUser.role === "secondary_family";
  const isCG = ["caregiver", "multi_caregiver", "temp_caregiver"].includes(activeUser.role);

  const correlatedMeds: { type: string; name: string; id: number }[] = (() => {
    try { return JSON.parse(pattern.correlated_with || "[]"); } catch { return []; }
  })();

  const firstDate = new Date(pattern.first_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const lastDate = new Date(pattern.last_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // Determine highest threshold fired
  const highestAlert = pattern.alert_7day_fired_at ? "7-day"
    : pattern.alert_6x_2week_fired_at ? "6× in 2 weeks"
    : pattern.alert_3x_week_fired_at ? "3× this week"
    : pattern.alert_3day_fired_at ? "3-day"
    : null;

  const acknowledgeMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/patterns/${pattern.id}/acknowledge`, {
      userId: activeUser.id,
      alertLevel: highestAlert || "manual",
    }),
    onSuccess: () => setAcknowledged(true),
  });

  const sendNoteMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/patterns/${pattern.id}/doctor-note`, {
      doctorNoteText: noteText,
      sentByUserId: activeUser.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", pattern.client_id, "patterns"] });
      toast({ title: "Note marked as sent", description: "This pattern has been escalated." });
      setShowDoctorNote(false);
    },
  });

  const saveNoteDraftMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/patterns/${pattern.id}/doctor-note`, { doctorNoteText: noteText }),
    onSuccess: () => toast({ title: "Draft saved" }),
  });

  return (
    <div className={cn("rounded-xl border transition-all", cfg.bg, cfg.border)} data-testid={`pattern-card-${pattern.id}`}>
      {/* Header row */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
            pattern.severity === "severe" ? "bg-red-100 dark:bg-red-950/50" :
            pattern.severity === "moderate" ? "bg-amber-100 dark:bg-amber-950/50" :
            "bg-slate-100 dark:bg-slate-800"
          )}>
            <Icon size={18} className={
              pattern.severity === "severe" ? "text-red-600 dark:text-red-400" :
              pattern.severity === "moderate" ? "text-amber-600 dark:text-amber-400" :
              "text-slate-500"
            } />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-semibold text-sm text-foreground leading-tight">{pattern.label}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cfg.badge)}>
                    {cfg.label}
                  </span>
                  {highestAlert && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp size={10} /> {highestAlert} pattern
                    </span>
                  )}
                  {pattern.status === "escalated" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400 font-medium">
                      Escalated
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
                data-testid={`pattern-expand-${pattern.id}`}
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {/* Observation sentence */}
            <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{pattern.description}</p>

            {/* Correlation chips */}
            {correlatedMeds.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Observed alongside:</span>
                {correlatedMeds.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-background border border-border">
                    <Pill size={9} /> {m.name}
                  </span>
                ))}
              </div>
            )}

            {/* Date range + count */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Clock size={10} /> {firstDate} – {lastDate}</span>
              <span>{pattern.occurrence_count} occurrence{pattern.occurrence_count !== 1 ? "s" : ""}</span>
              {pattern.consecutive_days >= 3 && (
                <span>{pattern.consecutive_days} consecutive days</span>
              )}
            </div>
          </div>
        </div>

        {/* CG framing message — always shown for CG users */}
        {isCG && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              Because of careful and consistent logging, this pattern became visible. What {clientName} is experiencing is the focus — this information is simply worth having.
            </p>
          </div>
        )}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">

          {/* Acknowledgement */}
          {!acknowledged && !pattern.doctor_note_sent_at && (
            <div className="rounded-lg bg-background border border-border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Mark as seen</p>
                <p className="text-xs text-muted-foreground mt-0.5">Both caregiver and family need to acknowledge this pattern.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => acknowledgeMutation.mutate()}
                className="flex-shrink-0 gap-1.5"
                data-testid={`ack-btn-${pattern.id}`}
              >
                <Eye size={13} /> I've seen this
              </Button>
            </div>
          )}
          {acknowledged && (
            <div className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400">
              <CheckCircle2 size={14} /> Acknowledged
            </div>
          )}

          {/* Doctor note section */}
          {(isMC || pattern.status === "escalated") && (
            <div className="rounded-lg bg-background border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {pattern.doctor_note_sent_at ? "Note sent to physician" : "Draft note to physician"}
                  </span>
                </div>
                {!pattern.doctor_note_sent_at && (
                  <button
                    onClick={() => setShowDoctorNote(s => !s)}
                    className="text-xs text-primary hover:underline"
                    data-testid={`toggle-note-${pattern.id}`}
                  >
                    {showDoctorNote ? "Hide" : "Review & edit"}
                  </button>
                )}
              </div>

              {pattern.doctor_note_sent_at && (
                <p className="text-xs text-muted-foreground">
                  Sent {new Date(pattern.doctor_note_sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}

              {showDoctorNote && !pattern.doctor_note_sent_at && (
                <div className="space-y-2">
                  <Textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    rows={8}
                    className="text-xs font-mono leading-relaxed"
                    data-testid={`note-textarea-${pattern.id}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    This note was drafted automatically based on observed patterns. Review, edit, and share it however works best — print it, copy it, or read it to the physician's office.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveNoteDraftMutation.mutate()}
                      className="gap-1.5 text-xs"
                    >
                      Save draft
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => sendNoteMutation.mutate()}
                      className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                      data-testid={`send-note-${pattern.id}`}
                    >
                      <Send size={12} /> Mark as sent
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MC escalate override */}
          {isMC && pattern.status === "active" && !pattern.escalated_at && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400"
              onClick={() => onEscalate(pattern.id)}
              data-testid={`escalate-btn-${pattern.id}`}
            >
              <AlertTriangle size={12} /> I want to escalate this now
            </Button>
          )}

          {/* Dismiss */}
          {pattern.status === "active" && (
            <button
              onClick={() => onDismiss(pattern.id)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 w-full text-center pt-1"
              data-testid={`dismiss-btn-${pattern.id}`}
            >
              We're aware — snooze for 7 days
            </button>
          )}
          {pattern.status === "dismissed" && pattern.dismissed_until && (
            <p className="text-xs text-muted-foreground text-center">
              Snoozed until {new Date(pattern.dismissed_until).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Will resurface automatically if pattern continues.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PreferencesSheet({
  open, onClose, userId, clientId,
}: {
  open: boolean; onClose: () => void; userId: number; clientId: number;
}) {
  const { data: prefs } = useQuery<PatternPreference>({
    queryKey: ["/api/users", userId, "pattern-preferences"],
    queryFn: () => apiRequest("GET", `/api/users/${userId}/pattern-preferences`).then(r => r.json()),
  });

  const [local, setLocal] = useState<PatternPreference>({
    watch_symptoms: true, watch_activity: true, watch_food: true,
    watch_sleep: true, watch_vitals: true, notify_threshold: "3day",
    ...prefs,
  });

  const { toast } = useToast();
  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/users/${userId}/pattern-preferences`, {
      clientId,
      watchSymptoms: local.watch_symptoms,
      watchActivity: local.watch_activity,
      watchFood: local.watch_food,
      watchSleep: local.watch_sleep,
      watchVitals: local.watch_vitals,
      notifyThreshold: local.notify_threshold,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "pattern-preferences"] });
      toast({ title: "Preferences saved" });
      onClose();
    },
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Settings size={16} /> Pattern Preferences
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium mb-1">What to watch for</p>
            <p className="text-xs text-muted-foreground mb-3">
              The more categories are active, the more the app can connect. Turning a category off means patterns in that area won't be tracked.
            </p>
            <div className="space-y-3">
              {[
                { key: "watch_symptoms", label: "Symptoms", desc: "Headache, dizziness, nausea, pain, fatigue", icon: AlertTriangle },
                { key: "watch_activity", label: "Activity", desc: "Walks, therapy, falls, low movement", icon: Activity },
                { key: "watch_food", label: "Food & nutrition", desc: "Appetite, fluid intake, meal completion", icon: Utensils },
                { key: "watch_sleep", label: "Sleep", desc: "Restlessness, poor sleep, excessive sleep", icon: Moon },
                { key: "watch_vitals", label: "Vitals", desc: "Blood pressure, weight, glucose trends", icon: Heart },
              ].map(({ key, label, desc, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between gap-3 py-1">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                  </div>
                  <Switch
                    checked={!!(local as any)[key]}
                    onCheckedChange={v => setLocal(l => ({ ...l, [key]: v }))}
                    data-testid={`pref-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Notification threshold</p>
            <p className="text-xs text-muted-foreground mb-3">
              Mild patterns always appear in summaries. This controls when you receive a direct notification.
            </p>
            <div className="space-y-2">
              {THRESHOLD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setLocal(l => ({ ...l, notify_threshold: opt.value }))}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all",
                    local.notify_threshold === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                  data-testid={`threshold-${opt.value}`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={() => saveMutation.mutate()}>
            Save preferences
          </Button>

          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium mb-1 flex items-center gap-1.5"><ShieldCheck size={12} /> How this works</p>
            Care Net Portal watches for connections between what's logged — medications, symptoms, sleep, activity, food. It notices what would be hard for any one person to see when they're living inside the situation. You control what it tracks and what it tells you.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Patterns({ activeUser, selectedClientId, clientName }: PatternsProps) {
  const { toast } = useToast();
  const [showPrefs, setShowPrefs] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "escalated" | "resolved">("all");

  const isMC = activeUser.role === "primary_family" || activeUser.role === "secondary_family";

  const { data: patterns = [], isLoading, refetch } = useQuery<HealthPattern[]>({
    queryKey: ["/api/clients", selectedClientId, "patterns"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/patterns`).then(r => r.json()),
    refetchInterval: 60000, // refresh every minute
  });

  const runEngineMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/patterns/run`, {}),
    onSuccess: () => {
      refetch();
      toast({ title: "Pattern scan complete", description: "Care log reviewed for new patterns." });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/patterns/${id}/dismiss`, { userId: activeUser.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "patterns"] });
      toast({ title: "Snoozed for 7 days", description: "This pattern will resurface automatically if it continues." });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/patterns/${id}/escalate`, { userId: activeUser.id }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "patterns"] });
      toast({ title: "Pattern escalated", description: "The doctor note is ready to review." });
    },
  });

  const filtered = patterns.filter(p => {
    if (filter === "all") return p.status !== "resolved";
    return p.status === filter;
  });

  const active = patterns.filter(p => p.status === "active");
  const escalated = patterns.filter(p => p.status === "escalated");
  const resolved = patterns.filter(p => p.status === "resolved");

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-5 w-full overflow-x-hidden" data-testid="patterns-page">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h1 className="text-lg font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Health Patterns
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xs">
            Connections noticed through careful logging — not conclusions, just observations worth having.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => runEngineMutation.mutate()}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
            title="Scan care log for new patterns"
            data-testid="run-engine-btn"
          >
            <RefreshCw size={15} className={cn("text-muted-foreground", runEngineMutation.isPending && "animate-spin")} />
          </button>
          {isMC && (
            <button
              onClick={() => setShowPrefs(true)}
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
              title="Pattern preferences"
              data-testid="prefs-btn"
            >
              <Settings size={15} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Transparency notice */}
      <div className="rounded-xl bg-muted/40 border border-border p-3 text-xs text-muted-foreground leading-relaxed flex gap-2.5">
        <Info size={13} className="flex-shrink-0 mt-0.5 text-primary/70" />
        <span>
          Sometimes technology can notice what a sibling or family member would notice — if they had all the information in front of them all the time. These patterns don't require action. They're observations that may be worth discussing.
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: "all", label: "Current", count: active.length + escalated.length },
          { key: "escalated", label: "Escalated", count: escalated.length },
          { key: "resolved", label: "Resolved", count: resolved.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              filter === tab.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:bg-muted text-muted-foreground"
            )}
            data-testid={`filter-${tab.key}`}
          >
            {tab.label} {tab.count > 0 && <span className="ml-1 opacity-70">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Pattern list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-28 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Brain size={36} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium text-sm">
            {filter === "resolved" ? "No resolved patterns yet" : "No patterns detected yet"}
          </p>
          <p className="text-xs mt-1 max-w-xs mx-auto leading-relaxed">
            {filter === "all"
              ? `The more that's logged — symptoms, meals, sleep, activities — the more connections can be found. Patterns will appear here when they emerge.`
              : `Patterns will appear here as they are ${filter}.`}
          </p>
          <button
            onClick={() => runEngineMutation.mutate()}
            className="mt-4 text-xs text-primary hover:underline"
          >
            Scan care log now
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(pattern => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              activeUser={activeUser}
              clientName={clientName}
              onDismiss={id => dismissMutation.mutate(id)}
              onEscalate={id => escalateMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Preferences sheet */}
      <PreferencesSheet
        open={showPrefs}
        onClose={() => setShowPrefs(false)}
        userId={activeUser.id}
        clientId={selectedClientId}
      />
    </div>
  );
}
