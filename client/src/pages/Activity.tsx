import { useApp } from "@/App";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ActivityLog } from "@shared/schema";
import { PriorityBadge } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus, CheckCircle2, Circle, ClipboardList, Mic, MicOff, AlertTriangle, Pill, Utensils, Heart, Activity, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, typeof ClipboardList> = {
  medication: Pill,
  hygiene: Heart,
  meal: Utensils,
  mood: Activity,
  medical: Stethoscope,
  general: ClipboardList,
};

const CATEGORY_COLORS: Record<string, string> = {
  medication: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  hygiene: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",
  meal: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  mood: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  medical: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  general: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " today";
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ActivityPage() {
  const { activeUser, selectedClientId } = useApp();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const canEdit = activeUser.role === "caregiver";

  const [form, setForm] = useState({
    title: "", description: "", priority: "green", category: "general",
  });

  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/clients", selectedClientId, "activity"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/activity`).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/activity`, {
      ...form,
      loggedByUserId: activeUser.id,
      loggedAt: new Date().toISOString(),
      isChecked: false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "activity"] });
      setAddOpen(false);
      setForm({ title: "", description: "", priority: "green", category: "general" });
      toast({ title: "Activity logged", description: "Entry added to activity log." });
    },
  });

  const checkMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/activity/${id}`, { isChecked: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "activity"] }),
  });

  const toggleVoice = (field: "title" | "description") => {
    if (!isRecording && "webkitSpeechRecognition" in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setForm(f => ({ ...f, [field]: f[field] ? f[field] + " " + text : text }));
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
      setIsRecording(true);
    }
  };

  const filtered = logs.filter(l =>
    (filterPriority === "all" || l.priority === filterPriority) &&
    (filterCategory === "all" || l.category === filterCategory)
  );

  const stats = {
    red: logs.filter(l => l.priority === "red").length,
    yellow: logs.filter(l => l.priority === "yellow").length,
    green: logs.filter(l => l.priority === "green").length,
    checked: logs.filter(l => l.isChecked).length,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Daily care entries, notes, and task completions</p>
        </div>
        {canEdit && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" data-testid="add-activity-btn">
                <Plus size={16} /> Log Activity
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Log Activity</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between">
                    Activity Title
                    <button onClick={() => toggleVoice("title")} className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded-full", isRecording ? "bg-red-100 text-red-600 recording-pulse" : "bg-muted text-muted-foreground hover:text-foreground")} type="button">
                      {isRecording ? <><MicOff size={12} /> Stop</> : <><Mic size={12} /> Voice</>}
                    </button>
                  </Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Morning medications given" data-testid="activity-title-input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger data-testid="activity-category-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medication">Medication</SelectItem>
                        <SelectItem value="meal">Meal / Nutrition</SelectItem>
                        <SelectItem value="hygiene">Hygiene</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="mood">Mood / Behavior</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger data-testid="activity-priority-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="red">🔴 Urgent</SelectItem>
                        <SelectItem value="yellow">🟡 Important</SelectItem>
                        <SelectItem value="green">🟢 Routine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between">
                    Description
                    <button onClick={() => toggleVoice("description")} className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded-full", isRecording ? "bg-red-100 text-red-600 recording-pulse" : "bg-muted text-muted-foreground hover:text-foreground")} type="button">
                      {isRecording ? <><MicOff size={12} /> Stop</> : <><Mic size={12} /> Voice</>}
                    </button>
                  </Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Add details — or use voice to speak your notes..." rows={4} data-testid="activity-description-input" />
                </div>
                <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.title || addMutation.isPending} data-testid="save-activity-btn">
                  {addMutation.isPending ? "Logging..." : "Log Activity"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Priority Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Urgent", count: stats.red, color: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400", dot: "bg-red-500" },
          { label: "Important", count: stats.yellow, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400", dot: "bg-amber-500" },
          { label: "Routine", count: stats.green, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400", dot: "bg-emerald-500" },
          { label: "Checked", count: stats.checked, color: "text-primary bg-primary/10", dot: "bg-primary" },
        ].map(({ label, count, color, dot }) => (
          <div key={label} className={cn("rounded-xl p-3 text-center border border-transparent", color)}>
            <div className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{count}</div>
            <div className="text-xs mt-0.5 opacity-80">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1.5">
          {["all", "red", "yellow", "green"].map(p => (
            <button key={p} onClick={() => setFilterPriority(p)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                filterPriority === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
              )} data-testid={`priority-filter-${p}`}
            >
              {p === "all" ? "All" : p === "red" ? "🔴 Urgent" : p === "yellow" ? "🟡 Important" : "🟢 Routine"}
            </button>
          ))}
        </div>
        <div className="w-px bg-border" />
        {["all", "medication", "meal", "medical", "general"].map(c => (
          <button key={c} onClick={() => setFilterCategory(c)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              filterCategory === c ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
            )} data-testid={`category-filter-${c}`}
          >
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {/* Log Entries */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">No activity logged yet</p>
          <p className="text-sm mt-1">{canEdit ? "Tap 'Log Activity' or use voice to add your first entry." : "No entries found."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const Icon = CATEGORY_ICONS[log.category] || ClipboardList;
            return (
              <div key={log.id} className={cn("flex items-start gap-4 p-4 rounded-xl border bg-card transition-all", log.isChecked && "opacity-60")} data-testid={`activity-card-${log.id}`}>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", CATEGORY_COLORS[log.category])}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("font-medium text-sm", log.isChecked && "line-through")}>{log.title}</span>
                    <PriorityBadge priority={log.priority} />
                  </div>
                  {log.description && (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{log.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">{formatTime(log.loggedAt)}</div>
                </div>
                {canEdit && !log.isChecked && (
                  <button
                    onClick={() => checkMutation.mutate(log.id)}
                    className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-border hover:border-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                    data-testid={`check-activity-${log.id}`}
                  >
                    <Circle size={16} className="text-muted-foreground" />
                  </button>
                )}
                {log.isChecked && <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-500 mt-0.5" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
