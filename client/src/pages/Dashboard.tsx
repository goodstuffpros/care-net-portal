import { useApp } from "@/App";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Client, ScheduleEvent, ActivityLog, Notification } from "@shared/schema";
import { PriorityBadge } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  AlertTriangle, Calendar, ClipboardCheck, Heart, MessageSquare,
  Activity, CheckCircle2, Clock, ChevronRight, User, Pill, Stethoscope, Dumbbell
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(isoString: string) {
  const d = new Date(isoString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return `Today ${formatTime(isoString)}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${formatTime(isoString)}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const TYPE_ICONS: Record<string, typeof Calendar> = {
  medication: Pill,
  appointment: Stethoscope,
  therapy: Dumbbell,
  task: ClipboardCheck,
  other: Calendar,
};

export default function DashboardPage() {
  const { activeUser, selectedClientId } = useApp();

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });

  const { data: scheduleEvents = [], isLoading: scheduleLoading } = useQuery<ScheduleEvent[]>({
    queryKey: ["/api/clients", selectedClientId, "schedule"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/schedule`).then(r => r.json()),
  });

  const { data: activityLogs = [], isLoading: activityLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/clients", selectedClientId, "activity"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/activity`).then(r => r.json()),
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/users", activeUser.id, "notifications"],
    queryFn: () => apiRequest("GET", `/api/users/${activeUser.id}/notifications`).then(r => r.json()),
  });

  const client = clients.find(c => c.id === selectedClientId);
  const today = new Date();
  const todayEvents = scheduleEvents.filter(e => {
    const d = new Date(e.scheduledAt);
    return d.toDateString() === today.toDateString();
  });
  const upcomingEvents = scheduleEvents.filter(e => new Date(e.scheduledAt) > today && !e.isCompleted).slice(0, 4);
  const recentActivity = activityLogs.slice(0, 5);
  const urgentItems = [...activityLogs, ...scheduleEvents].filter(i => (i as any).priority === "red").slice(0, 3);
  const completedToday = todayEvents.filter(e => e.isCompleted).length;
  const pendingToday = todayEvents.filter(e => !e.isCompleted).length;

  const canSeeFullView = activeUser.role === "caregiver" || activeUser.role === "primary_family";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {activeUser.name.split(" ")[0]}
          </h1>
          {client ? (
            <p className="text-muted-foreground text-sm mt-1">
              Viewing care updates for <span className="text-foreground font-medium">{client.name}</span>
            </p>
          ) : (
            <p className="text-muted-foreground text-sm mt-1">Care Net Portal — {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
          )}
        </div>
        <div className="text-sm text-muted-foreground hidden sm:block">
          {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {scheduleLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <Card className="border-border bg-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                    <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{completedToday}</div>
                    <div className="text-xs text-muted-foreground">Done Today</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                    <Clock size={18} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{pendingToday}</div>
                    <div className="text-xs text-muted-foreground">Pending Today</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{urgentItems.length}</div>
                    <div className="text-xs text-muted-foreground">Urgent Flags</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Activity size={18} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{activityLogs.length}</div>
                    <div className="text-xs text-muted-foreground">Log Entries</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <span className="flex items-center gap-2"><Calendar size={16} /> Upcoming Schedule</span>
              <Link href="/schedule"><a className="text-xs text-primary hover:underline font-normal">View all</a></Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scheduleLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
            ) : upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                <p>No upcoming events</p>
              </div>
            ) : upcomingEvents.map(event => {
              const Icon = TYPE_ICONS[event.type] || Calendar;
              return (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", event.priority === "red" ? "bg-red-100 dark:bg-red-950/40" : event.priority === "yellow" ? "bg-amber-100 dark:bg-amber-950/40" : "bg-emerald-100 dark:bg-emerald-950/40")}>
                    <Icon size={14} className={event.priority === "red" ? "text-red-600" : event.priority === "yellow" ? "text-amber-600" : "text-emerald-600"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{event.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(event.scheduledAt)}</div>
                  </div>
                  <PriorityBadge priority={event.priority} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <span className="flex items-center gap-2"><ClipboardCheck size={16} /> Recent Activity</span>
              <Link href="/activity"><a className="text-xs text-primary hover:underline font-normal">View all</a></Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activityLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <ClipboardCheck size={32} className="mx-auto mb-2 opacity-30" />
                <p>No activity logged yet</p>
              </div>
            ) : recentActivity.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", log.priority === "red" ? "bg-red-500" : log.priority === "yellow" ? "bg-amber-500" : "bg-emerald-500")} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{log.title}</div>
                  {log.description && <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{log.description}</div>}
                  <div className="text-xs text-muted-foreground mt-0.5">{formatTime(log.loggedAt)}</div>
                </div>
                <PriorityBadge priority={log.priority} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Urgent Flags */}
        {urgentItems.length > 0 && (
          <Card className="border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10 md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                <AlertTriangle size={16} />
                Urgent Flags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {urgentItems.map((item: any, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/60">
                  <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    {item.description && <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Client Quick Info */}
        {client && canSeeFullView && (
          <Card className="border-border md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                <span className="flex items-center gap-2"><User size={16} /> {client.name}</span>
                <Link href="/portal"><a className="text-xs text-primary hover:underline font-normal flex items-center gap-1">Full profile <ChevronRight size={12} /></a></Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {client.primaryCondition && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Primary Condition</div>
                    <div className="text-sm">{client.primaryCondition}</div>
                  </div>
                )}
                {client.allergies && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Allergies</div>
                    <div className="flex flex-wrap gap-1">
                      {JSON.parse(client.allergies).map((a: string) => (
                        <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {client.notes && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Care Notes</div>
                    <div className="text-sm text-muted-foreground">{client.notes}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
