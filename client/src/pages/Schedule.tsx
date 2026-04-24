import { useApp } from "@/App";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ScheduleEvent } from "@shared/schema";
import { PriorityBadge } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus, CheckCircle2, Circle, Calendar, Pill, Stethoscope, Dumbbell, Clock, MapPin, RefreshCw, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const TYPE_ICONS: Record<string, typeof Calendar> = {
  medication: Pill,
  appointment: Stethoscope,
  therapy: Dumbbell,
  task: CheckCircle2,
  other: Calendar,
};

const TYPE_COLORS: Record<string, string> = {
  medication: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  appointment: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  therapy: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  task: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function groupByDay(events: ScheduleEvent[]) {
  const groups: Record<string, ScheduleEvent[]> = {};
  events.forEach(e => {
    const d = new Date(e.scheduledAt);
    const key = d.toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return groups;
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

export default function SchedulePage() {
  const { activeUser, selectedClientId } = useApp();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const canEdit = activeUser.role === "caregiver";

  const [form, setForm] = useState({
    title: "", type: "task", scheduledAt: "", notes: "", priority: "green",
    recurrence: "none", location: "", reminderMinutes: 30,
  });

  const { data: events = [], isLoading } = useQuery<ScheduleEvent[]>({
    queryKey: ["/api/clients", selectedClientId, "schedule"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/schedule`).then(r => r.json()),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/schedule/${id}`, {
      isCompleted: true, completedAt: new Date().toISOString(), completedByUserId: activeUser.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "schedule"] });
      toast({ title: "Marked complete", description: "Task has been checked off." });
    },
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/schedule`, {
      ...form, scheduledAt: new Date(form.scheduledAt).toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "schedule"] });
      setAddOpen(false);
      setForm({ title: "", type: "task", scheduledAt: "", notes: "", priority: "green", recurrence: "none", location: "", reminderMinutes: 30 });
      toast({ title: "Event added", description: "Schedule updated successfully." });
    },
  });

  const toggleVoice = () => {
    if (!isRecording && "webkitSpeechRecognition" in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setForm(f => ({ ...f, notes: f.notes ? f.notes + " " + text : text }));
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
      setIsRecording(true);
    } else {
      setIsRecording(false);
    }
  };

  const filtered = filter === "all" ? events : events.filter(e => e.type === filter || e.priority === filter);
  const grouped = groupByDay(filtered);
  const sortedDays = Object.keys(grouped).sort();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Schedule</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Appointments, medications & therapy sessions</p>
        </div>
        {canEdit && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" data-testid="add-event-btn">
                <Plus size={16} /> Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Schedule Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Morning Medications" data-testid="event-title-input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger data-testid="event-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medication">Medication</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="therapy">Therapy</SelectItem>
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger data-testid="event-priority-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="red">🔴 Urgent</SelectItem>
                        <SelectItem value="yellow">🟡 Important</SelectItem>
                        <SelectItem value="green">🟢 Routine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Date & Time</Label>
                  <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} data-testid="event-datetime-input" />
                </div>
                <div className="space-y-1.5">
                  <Label>Location (optional)</Label>
                  <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. St. Mary's Medical Center" />
                </div>
                <div className="space-y-1.5">
                  <Label>Recurrence</Label>
                  <Select value={form.recurrence} onValueChange={v => setForm(f => ({ ...f, recurrence: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No recurrence</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between">
                    Notes
                    <button onClick={toggleVoice} className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded-full transition-colors", isRecording ? "bg-red-100 text-red-600 recording-pulse" : "bg-muted text-muted-foreground hover:text-foreground")} type="button">
                      {isRecording ? <><MicOff size={12} /> Stop</> : <><Mic size={12} /> Voice</>}
                    </button>
                  </Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Add notes or speak them..." rows={3} />
                </div>
                <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.title || !form.scheduledAt || addMutation.isPending} data-testid="save-event-btn">
                  {addMutation.isPending ? "Saving..." : "Add to Schedule"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {["all", "medication", "appointment", "therapy", "task", "red", "yellow"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
            data-testid={`filter-${f}`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Events by Day */}
      {isLoading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : sortedDays.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">No events found</p>
          <p className="text-sm mt-1">{canEdit ? "Add an event to get started." : "No scheduled events yet."}</p>
        </div>
      ) : sortedDays.map(day => (
        <div key={day}>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {formatDayLabel(day)}
            </h2>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{grouped[day].filter(e => e.isCompleted).length}/{grouped[day].length} done</span>
          </div>
          <div className="space-y-2">
            {grouped[day].map(event => {
              const Icon = TYPE_ICONS[event.type] || Calendar;
              return (
                <div key={event.id} className={cn("flex items-start gap-4 p-4 rounded-xl border bg-card transition-all", event.isCompleted && "opacity-60")} data-testid={`event-card-${event.id}`}>
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", TYPE_COLORS[event.type])}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn("font-medium text-sm", event.isCompleted && "line-through")}>{event.title}</div>
                      <PriorityBadge priority={event.priority} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={11} /> {new Date(event.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                      {event.location && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={11} /> {event.location}</span>}
                      {event.recurrence && event.recurrence !== "none" && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw size={11} /> {event.recurrence}</span>
                      )}
                    </div>
                    {event.notes && <p className="text-xs text-muted-foreground mt-1.5">{event.notes}</p>}
                    {event.isCompleted && event.completedAt && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Completed at {new Date(event.completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                  {canEdit && !event.isCompleted && (
                    <button
                      onClick={() => completeMutation.mutate(event.id)}
                      className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-border hover:border-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                      data-testid={`complete-event-${event.id}`}
                    >
                      <Circle size={16} className="text-muted-foreground" />
                    </button>
                  )}
                  {event.isCompleted && (
                    <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-500 mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
