import { useApp } from "@/App";
import { LessonLauncher } from "@/components/LessonLauncher";
import { useLang } from "@/lib/useLang";
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
import { Plus, CheckCircle2, Circle, Calendar, Pill, Stethoscope, Dumbbell, Clock, MapPin, RefreshCw, Mic, MicOff, CalendarPlus, AlertTriangle, Eye, Loader2, UserX, Bell, BellOff } from "lucide-react";
import { AlarmConfig } from "@/components/AlarmConfig";
import { Switch } from "@/components/ui/switch";
import type { Client } from "@shared/schema";
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

// Check if completion was logged significantly late (>1 hour after scheduled)
function isLateCompletion(scheduledAt: string, completedAt: string): boolean {
  const scheduled = new Date(scheduledAt).getTime();
  const completed = new Date(completedAt).getTime();
  return completed - scheduled > 60 * 60 * 1000; // > 1 hour
}

// Max date = 1 year from today (datetime-local format: YYYY-MM-DDTHH:mm)
function maxDateOneYear(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 16);
}

export default function SchedulePage() {
  const { activeUser, selectedClientId, portalMode, isRealSession } = useApp();
  const isFamilyPortal = portalMode === "family";
  const { t } = useLang();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [excuseOpen, setExcuseOpen] = useState<number | null>(null);
  const [excuseNote, setExcuseNote] = useState("");
  const [excusedIds, setExcusedIds] = useState<Set<number>>(new Set());
  const [discussingId, setDiscussingId] = useState<number | null>(null);
  const canEdit = activeUser.role === "caregiver";
  const { isTemporarilyElevated } = useApp();
  const isFamilyPrimary = activeUser.role === "primary_family" || isTemporarilyElevated;

  const [form, setForm] = useState({
    title: "", type: "task", scheduledAt: "", notes: "", priority: "green",
    recurrence: "none", location: "", reminderMinutes: 30,
    alarmEnabled: false,
    caregiverResponsible: true, responsibilityNote: "",
  });

  const { data: events = [], isLoading } = useQuery<ScheduleEvent[]>({
    queryKey: ["/api/clients", selectedClientId, "schedule"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/schedule`).then(r => r.json()),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });
  const client = clients.find(c => c.id === selectedClientId);
  const allergies: string[] = client?.allergies ? JSON.parse(client.allergies) : [];

  // All portal users for this client — used to auto-populate discuss threads
  const { data: portalUsers = [] } = useQuery<{ id: number }[]>({
    queryKey: ["/api/clients", selectedClientId, "family"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/family`).then(r => r.json()),
    enabled: !!selectedClientId,
  });

  function exportToCalendar(event: ScheduleEvent) {
    const start = new Date(event.scheduledAt);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Care Net Portal//EN',
      'BEGIN:VEVENT',
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${event.title}`,
      event.location ? `LOCATION:${event.location}` : '',
      event.notes ? `DESCRIPTION:${event.notes.replace(/\n/g, '\\n')}` : '',
      `PRIORITY:${event.priority === 'red' ? 1 : event.priority === 'yellow' ? 5 : 9}`,
      'END:VEVENT', 'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const completeMutation = useMutation({
    mutationFn: (id: number) => {
      const now = new Date().toISOString(); // Always use actual log time
      return apiRequest("PATCH", `/api/schedule/${id}`, {
        isCompleted: true, completedAt: now, completedByUserId: activeUser.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "schedule"] });
      toast({ title: "Marked complete", description: "Task has been checked off." });
    },
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/schedule`, {
      ...form,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      alarmEnabled: form.alarmEnabled,
      reminderMinutes: form.alarmEnabled ? form.reminderMinutes : 30,
      caregiverResponsible: form.caregiverResponsible,
      responsibilityNote: form.caregiverResponsible ? null : form.responsibilityNote,
    }),
    onError: () => {
      toast({ title: "Validation error", description: "Please fill in all required fields.", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "schedule"] });
      setAddOpen(false);
      setForm({ title: "", type: "task", scheduledAt: "", notes: "", priority: "green", recurrence: "none", location: "", reminderMinutes: 30, alarmEnabled: false, caregiverResponsible: true, responsibilityNote: "" });
      toast({ title: "Event added", description: "Schedule updated successfully." });
    },
  });

  // ── MC: Add Appointment ──────────────────────────────────────────────────
  const [alarmPickerOpen, setAlarmPickerOpen] = useState(false);
  const [mcAlarmPickerOpen, setMcAlarmPickerOpen] = useState(false);
  const [mcAddOpen, setMcAddOpen] = useState(false);
  const [mcForm, setMcForm] = useState({
    title: "", scheduledAt: "", location: "", doctor: "", notes: "", priority: "green",
    alarmEnabled: false, reminderMinutes: 30,
  });

  const mcAddMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/schedule`, {
      title: mcForm.title,
      type: "appointment",
      scheduledAt: new Date(mcForm.scheduledAt).toISOString(),
      location: mcForm.location,
      notes: [mcForm.doctor ? `Dr./Provider: ${mcForm.doctor}` : "", mcForm.notes].filter(Boolean).join("\n"),
      priority: mcForm.priority,
      recurrence: "none",
      caregiverResponsible: true,
      addedByRole: "primary_family",
      addedByUserId: activeUser.id,
      alarmEnabled: mcForm.alarmEnabled,
      reminderMinutes: mcForm.alarmEnabled ? mcForm.reminderMinutes : 30,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "schedule"] });
      setMcAddOpen(false);
      setMcForm({ title: "", scheduledAt: "", location: "", doctor: "", notes: "", priority: "green", alarmEnabled: false, reminderMinutes: 30 });
      toast({ title: "Appointment added", description: "Caregiver has been notified." });
    },
    onError: () => {
      toast({ title: "Missing required fields", description: "Please fill in appointment name and date/time.", variant: "destructive" });
    },
  });

  const discussMutation = useMutation({
    mutationFn: async (event: ScheduleEvent) => {
      const allMemberIds = portalUsers.length > 0 ? portalUsers.map((u: { id: number }) => u.id) : [activeUser.id];
      const threadRes = await apiRequest("POST", `/api/clients/${selectedClientId}/threads`, {
        name: `Discuss: ${event.title}`,
        members: JSON.stringify(allMemberIds),
        createdByUserId: activeUser.id,
        isOpen: true,
        createdAt: new Date().toISOString(),
      });
      const thread = await threadRes.json();
      await apiRequest("POST", `/api/threads/${thread.id}/messages`, {
        senderId: activeUser.id,
        content: `📅 Re: "${event.title}"\n\n${event.notes ? event.notes + "\n\n" : ""}Scheduled for ${new Date(event.scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Any questions or concerns?`,
        messageType: "text",
        priority: event.priority || "green",
        sentAt: new Date().toISOString(),
        isRead: false,
        readByUserIds: JSON.stringify([activeUser.id]),
      });
      return thread;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
      setDiscussingId(null);
      toast({ title: "Thread created", description: "Opening the new discussion in Messages." });
      window.location.hash = "#/messages";
    },
    onError: () => {
      setDiscussingId(null);
      toast({ title: "Error", description: "Could not create thread. Please try again.", variant: "destructive" });
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

  const [showHistory, setShowHistory] = useState(false);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const allFiltered = filter === "all" ? events : events.filter(e => e.type === filter || e.priority === filter);
  const upcomingEvents = allFiltered.filter(e => new Date(e.scheduledAt) >= todayStart);
  const pastEvents = allFiltered.filter(e => new Date(e.scheduledAt) < todayStart);

  const grouped = groupByDay(upcomingEvents);
  const sortedDays = Object.keys(grouped).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()); // ascending — soonest first

  const pastGrouped = groupByDay(pastEvents);
  const pastSortedDays = Object.keys(pastGrouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // descending — most recent first

  function renderEventCard(event: ScheduleEvent) {
    const Icon = TYPE_ICONS[event.type] || Calendar;
    const late = event.isCompleted && event.completedAt && isLateCompletion(event.scheduledAt, event.completedAt);
    const isExcused = excusedIds.has(event.id);
    const seenBy: string[] = []; // future: pull from DB via read-receipts API
    return (
      <div key={event.id} className={cn("p-4 rounded-xl border bg-card transition-all", event.isCompleted && "opacity-70")} data-testid={`event-card-${event.id}`}>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", TYPE_COLORS[event.type])}>
              <Icon size={16} />
            </div>
            {canEdit && !event.isCompleted ? (
              <button
                onClick={() => completeMutation.mutate(event.id)}
                className="w-7 h-7 rounded-full border-2 border-border hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-colors"
                title={t("schedule.markComplete")}
                data-testid={`complete-event-${event.id}`}
              >
                <Circle size={13} className="text-muted-foreground" />
              </button>
            ) : event.isCompleted ? (
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0" title="Completed">
                <CheckCircle2 size={14} className="text-white" />
              </div>
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <span className="font-medium text-sm">{event.title}</span>
              <PriorityBadge priority={event.priority} />
              {late && !isExcused && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900 font-medium">
                  <AlertTriangle size={10} /> Late entry
                </span>
              )}
              {late && isExcused && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 font-medium">
                  ✓ Excused
                </span>
              )}
            </div>
            <div className="mt-1.5 space-y-0.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={11} />
                <span>{new Date(event.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              {event.recurrence && event.recurrence !== "none" && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw size={11} />
                  <span className="capitalize">{event.recurrence}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={11} /> {event.location}
                </div>
              )}
            </div>
            {event.notes && <p className="text-xs text-muted-foreground mt-1.5">{event.notes}</p>}
            {event.type === "appointment" && event.caregiverResponsible === false && (
              <div className="inline-flex items-center gap-1.5 mt-1.5 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                <UserX size={10} /> {t("schedule.responsible.familyHandling")}
                {event.responsibilityNote && <span className="text-muted-foreground">· {event.responsibilityNote}</span>}
              </div>
            )}
            {event.isCompleted && event.completedAt && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5">
                Logged at {new Date(event.completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                {late && !isExcused && " (scheduled earlier)"}
              </div>
            )}
            {seenBy.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                <Eye size={10} />
                <span>Seen by {seenBy.join(", ")}</span>
              </div>
            )}
            {late && !isExcused && isFamilyPrimary && (
              <button
                onClick={() => setExcuseOpen(event.id)}
                className="mt-2 text-xs text-amber-600 underline hover:text-amber-800"
              >
                Excuse this flag
              </button>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <AlarmConfig
              eventId={event.id}
              eventTitle={event.title}
              eventTime={event.scheduledAt}
              alarmEnabled={event.alarmEnabled ?? false}
              reminderMinutes={event.reminderMinutes ?? 30}
              eventType={event.type}
              clientId={selectedClientId}
            />
            <button
              onClick={() => exportToCalendar(event)}
              className="w-8 h-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center transition-colors"
              title="Export to Calendar (.ics)"
              data-testid={`export-calendar-${event.id}`}
            >
              <CalendarPlus size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>
        {(activeUser.role === "primary_family" || activeUser.role === "secondary_family") && (
          <div className="mt-3 pt-2.5 border-t border-border/50 flex justify-end">
            <button
              onClick={() => { setDiscussingId(event.id); discussMutation.mutate(event); }}
              disabled={discussingId === event.id && discussMutation.isPending}
              className="text-xs text-primary hover:underline flex items-center gap-1.5 disabled:opacity-60"
              data-testid={`discuss-event-${event.id}`}
            >
              {discussingId === event.id && discussMutation.isPending
                ? <><Loader2 size={11} className="animate-spin" /> Creating thread...</>
                : <>💬 Discuss with family</>}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 w-full overflow-x-hidden" data-testid="schedule-page">
      {/* Page Header */}
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("schedule.title")}</h1>
            <p className="text-xs text-muted-foreground truncate">{t("schedule.subtitle")}</p>
          </div>
        </div>
        <LessonLauncher pageKey="schedule" />
        {canEdit && (<Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white" data-testid="add-event-btn">
              <Plus size={16} /> {t("schedule.addEvent")}
            </Button>
          </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90dvh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Add Schedule Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
                <div className="space-y-1.5">
                  <Label>{t("schedule.eventTitle")}</Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Morning Medications" data-testid="event-title-input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("schedule.eventType")}</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger data-testid="event-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medication">{t("schedule.types.medication")}</SelectItem>
                        <SelectItem value="appointment">{t("schedule.types.appointment")}</SelectItem>
                        <SelectItem value="therapy">Therapy</SelectItem>
                        <SelectItem value="task">{t("schedule.types.task")}</SelectItem>
                        <SelectItem value="other">{t("schedule.types.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("schedule.priority")}</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger data-testid="event-priority-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="red">🔴 Urgent</SelectItem>
                        <SelectItem value="yellow">🟡 Important</SelectItem>
                        <SelectItem value="green">🟢 Normal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("schedule.dateTime")}</Label>
                  <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} max={maxDateOneYear()} data-testid="event-datetime-input" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("schedule.location")} (optional)</Label>
                  <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. St. Mary's Medical Center" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("schedule.recurrence")}</Label>
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
                    {t("schedule.notes")}
                    <button onClick={toggleVoice} className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded-full transition-colors", isRecording ? "bg-red-100 text-red-600 recording-pulse" : "bg-muted text-muted-foreground hover:text-foreground")} type="button">
                      {isRecording ? <><MicOff size={12} /> Stop</> : <><Mic size={12} /> Voice</>}
                    </button>
                  </Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Add notes or speak them..." rows={3} />
                </div>
                {/* Alarm */}
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {form.alarmEnabled
                        ? <Bell size={15} className="text-teal-600 dark:text-teal-400 fill-current" />
                        : <Bell size={15} className="text-muted-foreground" />}
                      <div>
                        <div className="text-sm font-medium">Alarm</div>
                        <div className="text-xs text-muted-foreground">
                          {form.alarmEnabled ? "Will alert before this event" : "No alert set"}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={form.alarmEnabled}
                      onCheckedChange={v => { setForm(f => ({ ...f, alarmEnabled: v })); setAlarmPickerOpen(v); }}
                      data-testid="alarm-toggle-new"
                    />
                  </div>
                  {form.alarmEnabled && (
                    alarmPickerOpen ? (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {[{ value: 0, label: "At time" }, { value: 10, label: "10 min before" }, { value: 15, label: "15 min before" }, { value: 30, label: "30 min before" }, { value: 60, label: "1 hr before" }, { value: 120, label: "2 hrs before" }].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setForm(f => ({ ...f, reminderMinutes: opt.value })); setAlarmPickerOpen(false); }}
                            className={cn(
                              "py-2 px-3 rounded-lg text-xs text-left border transition-all",
                              form.reminderMinutes === opt.value
                                ? "bg-primary text-primary-foreground border-primary font-medium"
                                : "bg-background border-border hover:bg-muted"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-medium text-foreground">
                          {[{ value: 0, label: "At time" }, { value: 10, label: "10 min before" }, { value: 15, label: "15 min before" }, { value: 30, label: "30 min before" }, { value: 60, label: "1 hr before" }, { value: 120, label: "2 hrs before" }].find(o => o.value === form.reminderMinutes)?.label ?? "30 min before"}
                        </span>
                        <button type="button" onClick={() => setAlarmPickerOpen(true)} className="text-xs text-primary hover:underline">Change</button>
                      </div>
                    )
                  )}
                </div>

                {/* Caregiver Responsibility Toggle */}
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{t("schedule.responsible.label")}</div>
                      <div className="text-xs text-muted-foreground">{t("schedule.responsible.hint")}</div>
                    </div>
                    <Switch
                      checked={form.caregiverResponsible}
                      onCheckedChange={v => setForm(f => ({ ...f, caregiverResponsible: v, responsibilityNote: v ? f.responsibilityNote : "" }))}
                      data-testid="caregiver-responsible-toggle"
                    />
                  </div>
                  {!form.caregiverResponsible && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <UserX size={12} /> {t("schedule.responsible.noteLabel")} <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        value={form.responsibilityNote}
                        onChange={e => setForm(f => ({ ...f, responsibilityNote: e.target.value }))}
                        placeholder={t("schedule.responsible.notePlaceholder")}
                        rows={2}
                        data-testid="responsibility-note-input"
                      />
                    </div>
                  )}
                </div>
                <Button
                  className="w-full"
                  onClick={() => addMutation.mutate()}
                  disabled={!form.title || !form.scheduledAt || addMutation.isPending || (!form.caregiverResponsible && !form.responsibilityNote)}
                  data-testid="save-event-btn"
                >
                  {addMutation.isPending ? t("schedule.saving") : form.type === "appointment" ? "Save & Notify MC" : t("schedule.save")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* MC: Add Appointment */}
        {isFamilyPrimary && (
          <Dialog open={mcAddOpen} onOpenChange={setMcAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white" data-testid="mc-add-appointment-btn">
                <CalendarPlus size={16} /> Add Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90dvh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <CalendarPlus size={18} className="text-blue-600" /> Add Appointment
                </DialogTitle>
              </DialogHeader>
              {/* MC info banner */}
              <div className="flex-shrink-0 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                <span className="mt-0.5">⚠️</span>
                <span>Your caregiver will receive an <strong>urgent alert</strong> as soon as this appointment is saved.</span>
              </div>
              <div className="space-y-4 py-1 overflow-y-auto flex-1 pr-1">
                <div className="space-y-1.5">
                  <Label>Appointment Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={mcForm.title}
                    onChange={e => setMcForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Cardiology Follow-up"
                    data-testid="mc-appt-title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date &amp; Time <span className="text-red-500">*</span></Label>
                  <Input
                    type="datetime-local"
                    value={mcForm.scheduledAt}
                    onChange={e => setMcForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    max={maxDateOneYear()}
                    data-testid="mc-appt-datetime"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Doctor / Provider</Label>
                  <Input
                    value={mcForm.doctor}
                    onChange={e => setMcForm(f => ({ ...f, doctor: e.target.value }))}
                    placeholder="e.g. Dr. Sarah Chen"
                    data-testid="mc-appt-doctor"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input
                    value={mcForm.location}
                    onChange={e => setMcForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Dallas Medical Center, Suite 210"
                    data-testid="mc-appt-location"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={mcForm.priority} onValueChange={v => setMcForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger data-testid="mc-appt-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="red">🔴 Urgent</SelectItem>
                      <SelectItem value="yellow">🟡 Important</SelectItem>
                      <SelectItem value="green">🟢 Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes for Caregiver</Label>
                  <Textarea
                    value={mcForm.notes}
                    onChange={e => setMcForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="What should the caregiver know? Preparation instructions, what to bring, etc."
                    rows={3}
                    data-testid="mc-appt-notes"
                  />
                </div>
                {/* Alarm for MC */}
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {mcForm.alarmEnabled
                        ? <Bell size={15} className="text-teal-600 dark:text-teal-400 fill-current" />
                        : <Bell size={15} className="text-muted-foreground" />}
                      <div>
                        <div className="text-sm font-medium">Alarm reminder</div>
                        <div className="text-xs text-muted-foreground">
                          {mcForm.alarmEnabled ? "You'll be alerted before this appointment" : "No personal reminder set"}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={mcForm.alarmEnabled}
                      onCheckedChange={v => { setMcForm(f => ({ ...f, alarmEnabled: v })); setMcAlarmPickerOpen(v); }}
                      data-testid="mc-alarm-toggle"
                    />
                  </div>
                  {mcForm.alarmEnabled && (
                    mcAlarmPickerOpen ? (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {[{ value: 0, label: "At time" }, { value: 10, label: "10 min before" }, { value: 15, label: "15 min before" }, { value: 30, label: "30 min before" }, { value: 60, label: "1 hr before" }, { value: 120, label: "2 hrs before" }].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setMcForm(f => ({ ...f, reminderMinutes: opt.value })); setMcAlarmPickerOpen(false); }}
                            className={cn(
                              "py-2 px-3 rounded-lg text-xs text-left border transition-all",
                              mcForm.reminderMinutes === opt.value
                                ? "bg-primary text-primary-foreground border-primary font-medium"
                                : "bg-background border-border hover:bg-muted"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-medium text-foreground">
                          {[{ value: 0, label: "At time" }, { value: 10, label: "10 min before" }, { value: 15, label: "15 min before" }, { value: 30, label: "30 min before" }, { value: 60, label: "1 hr before" }, { value: 120, label: "2 hrs before" }].find(o => o.value === mcForm.reminderMinutes)?.label ?? "30 min before"}
                        </span>
                        <button type="button" onClick={() => setMcAlarmPickerOpen(true)} className="text-xs text-primary hover:underline">Change</button>
                      </div>
                    )
                  )}
                </div>
                <Button
                  className="w-full"
                  onClick={() => mcAddMutation.mutate()}
                  disabled={!mcForm.title || !mcForm.scheduledAt || mcAddMutation.isPending}
                  data-testid="mc-save-appt-btn"
                >
                  {mcAddMutation.isPending ? "Saving…" : "Save & Notify Caregiver"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>



      {/* Filter bar — scrollable on mobile */}
      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex gap-2 min-w-max">
          {["all", "medication", "appointment", "therapy", "task", "red", "yellow"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors border whitespace-nowrap",
                filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
              data-testid={`filter-${f}`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Events by Day */}
      {isLoading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : sortedDays.length === 0 && pastSortedDays.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">No events found</p>
          <p className="text-sm mt-1">{canEdit ? "Add an event to get started." : "No scheduled events yet."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Upcoming ── */}
          {sortedDays.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar size={32} className="mx-auto mb-2 opacity-25" />
              <p className="text-sm">No upcoming events{filter !== "all" ? " for this filter" : ""}.</p>
            </div>
          ) : (
            sortedDays.map(day => (
              <div key={day}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                    {formatDayLabel(day)}
                  </h2>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{grouped[day].filter(e => e.isCompleted).length}/{grouped[day].length} done</span>
                </div>
                <div className="space-y-2">
                  {grouped[day].map(event => renderEventCard(event))}
                </div>
              </div>
            ))
          )}

          {/* ── Past / History ── */}
          {pastSortedDays.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(h => !h)}
                className="flex items-center gap-2 w-full text-left py-2 group"
                data-testid="toggle-history"
              >
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5 px-1 whitespace-nowrap">
                  {showHistory ? "▲" : "▼"} {pastEvents.length} past event{pastEvents.length !== 1 ? "s" : ""}
                </span>
                <div className="flex-1 h-px bg-border" />
              </button>
              {showHistory && (
                <div className="space-y-6 mt-2 opacity-80">
                  {pastSortedDays.map(day => (
                    <div key={day}>
                      <div className="flex items-center gap-3 mb-3">
                        <h2 className="text-sm font-semibold text-muted-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                          {formatDayLabel(day)}
                        </h2>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">{pastGrouped[day].filter(e => e.isCompleted).length}/{pastGrouped[day].length} done</span>
                      </div>
                      <div className="space-y-2">
                        {pastGrouped[day].map(event => renderEventCard(event))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Excuse Flag Dialog */}
      {excuseOpen !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="font-semibold">Excuse Late Entry Flag</div>
            <p className="text-sm text-muted-foreground">Add a note explaining why this late entry should not count against the caregiver rating.</p>
            <Textarea
              value={excuseNote}
              onChange={e => setExcuseNote(e.target.value)}
              placeholder="e.g. Doctor rescheduled. Appointment moved to following week."
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setExcuseOpen(null); setExcuseNote(""); }}>Cancel</Button>
              <Button className="flex-1" onClick={() => {
                if (excuseOpen) setExcusedIds(prev => new Set([...prev, excuseOpen]));
                toast({ title: "Flag excused", description: "Note saved. This entry will not count against the caregiver rating." });
                setExcuseOpen(null);
                setExcuseNote("");
              }}>Save Note</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
