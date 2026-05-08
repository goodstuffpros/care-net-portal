import { useApp, isCaregiverRole } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ScheduleEvent, ActivityLog, MiscNote, Client } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import {
  ClipboardSignature, Pill, AlertTriangle, Heart, Clock,
  FileText, CheckCircle2, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LessonLauncher } from "@/components/LessonLauncher";

export default function HandoffPage() {
  const { selectedClientId, activeUser } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const [generated, setGenerated] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState("");
  const [handedOff, setHandedOff] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [handoffTime, setHandoffTime] = useState<string>("");

  const { data: events = [] } = useQuery<ScheduleEvent[]>({
    queryKey: ["/api/clients", selectedClientId, "schedule"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/schedule`).then(r => r.json()),
  });

  const { data: activityLogs = [] } = useQuery<ActivityLog[]>({
    queryKey: ["/api/clients", selectedClientId, "activity"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/activity`).then(r => r.json()),
  });

  const { data: notes = [] } = useQuery<MiscNote[]>({
    queryKey: ["/api/clients", selectedClientId, "notes"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/notes`).then(r => r.json()),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });
  const client = clients.find(c => c.id === selectedClientId);

  const today = new Date();
  const todayMeds = events.filter(e =>
    e.type === "medication" &&
    new Date(e.scheduledAt).toDateString() === today.toDateString() &&
    e.isCompleted
  );
  const incidents = activityLogs.filter(l => l.priority === "red" || l.priority === "yellow").slice(0, 5);
  const moodLogs = activityLogs.filter(l => l.category === "mood" || l.category === "general").slice(0, 3);
  const upcoming = events.filter(e => new Date(e.scheduledAt) > today && !e.isCompleted).slice(0, 4);
  const openNotes = notes.filter(n => !n.isResolved).slice(0, 5);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 w-full overflow-x-hidden" data-testid="handoff-page">
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center flex-shrink-0">
            <ClipboardSignature size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("handoff.title")}</h1>
            <p className="text-xs text-muted-foreground truncate">{client?.name} · {today.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</p>
          </div>
          <LessonLauncher pageKey="handoff" />
        </div>
        <Button
          size="sm"
          onClick={() => setGenerated(true)}
          className="gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white"
          data-testid="generate-report-btn"
        >
          <RefreshCw size={15} /> {t("handoff.submit")}
        </Button>
      </div>

      {!generated ? (
        <div className="text-center py-20 text-muted-foreground">
          <ClipboardSignature size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium text-base">Click "Generate Report" to build the shift handoff</p>
          <p className="text-sm mt-1">Pulls today's medications, incidents, mood notes, and upcoming events</p>
        </div>
      ) : (
        <div className="space-y-4 print:space-y-4">
          {/* Today's Medications */}
          <Card className="border-border" data-testid="handoff-medications">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                <Pill size={16} className="text-purple-600" /> Today's Medications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayMeds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No medications marked complete today.</p>
              ) : (
                <div className="space-y-2">
                  {todayMeds.map(med => (
                    <div key={med.id} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                      <span className="font-medium">{med.title}</span>
                      <span className="text-muted-foreground">
                        {new Date(med.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                      {med.notes && <span className="text-muted-foreground text-xs">— {med.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Incidents & Alerts */}
          <Card className={cn("border-border", incidents.length > 0 && "border-amber-200 dark:border-amber-900")} data-testid="handoff-incidents">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                <AlertTriangle size={16} className="text-amber-500" /> Incidents & Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No incidents or alerts today. ✓</p>
              ) : (
                <div className="space-y-2">
                  {incidents.map(log => (
                    <div key={log.id} className="flex items-start gap-3 text-sm p-2 rounded-lg bg-muted/40">
                      <span className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", log.priority === "red" ? "bg-red-500" : "bg-amber-500")} />
                      <div>
                        <div className="font-medium">{log.title}</div>
                        {log.description && <div className="text-xs text-muted-foreground mt-0.5">{log.description}</div>}
                        <div className="text-xs text-muted-foreground mt-0.5">{new Date(log.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mood & Wellbeing */}
          <Card className="border-border" data-testid="handoff-mood">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                <Heart size={16} className="text-pink-500" /> Mood & Wellbeing
              </CardTitle>
            </CardHeader>
            <CardContent>
              {moodLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No mood or general notes logged today.</p>
              ) : (
                <div className="space-y-2">
                  {moodLogs.map(log => (
                    <div key={log.id} className="text-sm">
                      <span className="font-medium">{log.title}</span>
                      {log.description && <p className="text-muted-foreground mt-0.5 text-xs">{log.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Next 24hrs */}
          <Card className="border-border" data-testid="handoff-upcoming">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                <Clock size={16} className="text-blue-500" /> Upcoming (Next 24hrs)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events in the next 24 hours.</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(ev => (
                    <div key={ev.id} className="flex items-center gap-3 text-sm">
                      <Clock size={13} className="text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{ev.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(ev.scheduledAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Open Notes */}
          <Card className="border-border" data-testid="handoff-notes">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                <FileText size={16} className="text-slate-500" /> Open Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {openNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open notes.</p>
              ) : (
                <div className="space-y-2">
                  {openNotes.map(note => (
                    <div key={note.id} className="text-sm">
                      <span className="font-medium">{note.title}</span>
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{note.category}</span>
                      {note.body && <p className="text-muted-foreground mt-0.5 text-xs">{note.body}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Handoff Message */}
          <Card className="border-border" data-testid="handoff-message">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                <ClipboardSignature size={16} className="text-primary" /> Handoff Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Add any additional notes for the incoming caregiver..."
                value={handoffMessage}
                onChange={e => setHandoffMessage(e.target.value)}
                rows={4}
                data-testid="handoff-message-input"
              />
              <div className="flex gap-3">
                {!handedOff ? (
                  <Button
                    onClick={() => {
                      setHandedOff(true);
                      setHandoffTime(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
                      toast({ title: "Shift handed off", description: "Handoff recorded successfully." });
                    }}
                    className="gap-2"
                    data-testid="mark-handoff-btn"
                  >
                    <CheckCircle2 size={15} /> Mark as Handed Off
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 text-sm font-medium">
                    <CheckCircle2 size={15} /> Handed off at {handoffTime}
                  </div>
                )}

                {handedOff && !acknowledged && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAcknowledged(true);
                      toast({ title: "Receipt acknowledged", description: "Incoming caregiver has acknowledged the handoff." });
                    }}
                    className="gap-2"
                    data-testid="acknowledge-btn"
                  >
                    Acknowledge Receipt
                  </Button>
                )}
                {acknowledged && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 text-sm font-medium">
                    <CheckCircle2 size={15} /> Receipt Acknowledged
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
