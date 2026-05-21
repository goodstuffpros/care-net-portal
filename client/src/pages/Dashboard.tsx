import { useState, useEffect } from "react";
import { useApp, isCaregiverRole } from "@/App";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Client, ScheduleEvent, ActivityLog, Notification } from "@shared/schema";
import { PriorityBadge } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle, Rocket, Calendar, ClipboardCheck, Heart, MessageSquare, X,
  Activity, CheckCircle2, Clock, ChevronRight, User, Pill, Stethoscope, Dumbbell, Volume2,
  Trophy, Star, BookOpen, Users, UserPlus, Bell, LayoutDashboard, NotebookPen, CalendarDays,
  Home, Plus, UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { speakBecky } from "@/lib/ttsUtils";
import { SampleClientModal } from "@/components/SampleClientModal";

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

const ALL_BADGES = [
  { id: "med-streak", icon: "🏆", label: "7-Day Med Streak", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900", desc: "Medications logged on time 7 days in a row", earned: "Apr 20, 2026" },
  { id: "zero-missed", icon: "✅", label: "Zero Missed Entries", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900", desc: "No missed daily logs this week", earned: "Apr 21, 2026" },
  { id: "perfect-week", icon: "⭐", label: "Perfect Week", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900", desc: "All tasks completed for 7 consecutive days", earned: "Apr 22, 2026" },
  { id: "detailed-logger", icon: "📋", label: "Detailed Logger", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900", desc: "Added notes to 20+ activity entries", earned: "Apr 18, 2026" },
  { id: "team-player", icon: "🤝", label: "Team Player", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900", desc: "Responded to 10+ family messages", earned: "Apr 19, 2026" },
  { id: "on-time", icon: "🔔", label: "Always On Time", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900", desc: "All medications logged within 15 min of scheduled time", earned: "Apr 23, 2026" },
];

// Badges earned per user id
const USER_BADGES: Record<number, string[]> = {
  1: ["med-streak", "zero-missed", "perfect-week", "detailed-logger", "team-player", "on-time"], // Becky — all 6
  2: ["med-streak", "zero-missed", "detailed-logger"], // Marcus — 3
  3: ["zero-missed"], // Diana — 1
};

export default function DashboardPage() {
  const { activeUser, selectedClientId, portalMode, isRealSession, isPracticeClient, sampleClientId, isPreConnection, hasMultiplePortals, returnToCareHome, multiPortalNudgeSnoozedUntil, isTemporarilyElevated, isClientPortal, clientPermissionLevel, hasSeenMcInvitePrompt, setHasSeenMcInvitePrompt } = useApp();
  const isFamilyPortal = portalMode === "family";
  const { t } = useLang();

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

  const [, navigate] = useLocation();
  const [sampleNudgeDismissed, setSampleNudgeDismissed] = useState(false);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [multiPortalNudgeDismissedLocal, setMultiPortalNudgeDismissedLocal] = useState(false);
  const [mcInviteModalOpen, setMcInviteModalOpen] = useState(false);

  // Show MC invite popup once for self_care users who have not yet seen it and have no MC
  useEffect(() => {
    if (isClientPortal && clientPermissionLevel === "self_care_mc" && !hasSeenMcInvitePrompt) {
      // Strip query string immediately (e.g. ?verified=1 from email verification link)
      if (window.location.search) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      const t = setTimeout(() => {
        // Double-check and strip again in case of race condition
        if (window.location.search) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        setMcInviteModalOpen(true);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [isClientPortal, clientPermissionLevel, hasSeenMcInvitePrompt]);

  const seenMcInviteMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/users/me/seen-mc-invite"),
    onSuccess: () => setHasSeenMcInvitePrompt(true),
  });

  function dismissMcInviteModal() {
    setMcInviteModalOpen(false);
    seenMcInviteMutation.mutate();
  }

  // Nudge: show for CGs who have no sample and no real client
  const showSampleNudge =
    isCaregiverRole(activeUser.role) &&
    !sampleClientId &&
    isPreConnection &&
    !sampleNudgeDismissed;

  // Multi-portal nudge: show for MC users who don't already have multiple portals
  // Only show if snooze has expired (or was never set), and not already dismissed this session
  const nudgeSnoozedUntilDate = multiPortalNudgeSnoozedUntil ? new Date(multiPortalNudgeSnoozedUntil) : null;
  const nudgeSnoozed = nudgeSnoozedUntilDate ? nudgeSnoozedUntilDate > new Date() : false;
  const showMultiPortalNudge =
    (activeUser.role === "primary_family" || isTemporarilyElevated) &&
    !hasMultiplePortals &&
    !nudgeSnoozed &&
    !multiPortalNudgeDismissedLocal &&
    isRealSession &&
    activeUser.id > 0;

  const snoozeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/me/nudge-snooze"),
    onSuccess: () => setMultiPortalNudgeDismissedLocal(true),
  });
  const canSeeFullView = activeUser.role === "caregiver" || activeUser.role === "primary_family" || isTemporarilyElevated;
  const showBadges = activeUser.role === "caregiver" || activeUser.role === "multi_caregiver" || activeUser.role === "temp_caregiver";
  // Guard: hardcoded USER_BADGES are demo-only. Real users start with no earned badges.
  const earnedBadgeIds = isRealSession ? [] : (USER_BADGES[activeUser.id] || []);
  const earnedBadges = ALL_BADGES.filter(b => earnedBadgeIds.includes(b.id));
  const inProgressBadges = ALL_BADGES.filter(b => !earnedBadgeIds.includes(b.id));

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6 w-full overflow-x-hidden">
      {/* Sample Portal nudge — shown to CGs without a sample client yet */}
      {showSampleNudge && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Rocket size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber-900 dark:text-amber-200 text-sm font-semibold leading-tight">Take the portal for a ride</p>
            <p className="text-amber-700/80 dark:text-amber-400/80 text-xs mt-0.5 leading-relaxed">
              Create a sample client and explore everything the portal can do — no real data needed. You can showcase it to potential families.
            </p>
            <button
              onClick={() => setSampleModalOpen(true)}
              className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300 underline underline-offset-2"
              data-testid="dashboard-sample-nudge-cta"
            >
              Set up my sample portal →
            </button>
          </div>
          <button
            onClick={() => setSampleNudgeDismissed(true)}
            className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors mt-0.5"
            aria-label="Dismiss"
            data-testid="dashboard-sample-nudge-dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <LayoutDashboard size={20} className="text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            {new Date().getHours() < 12 ? t("dashboard.greeting.morning", { name: activeUser.name.split(" ")[0] }) : new Date().getHours() < 17 ? t("dashboard.greeting.afternoon", { name: activeUser.name.split(" ")[0] }) : t("dashboard.greeting.evening", { name: activeUser.name.split(" ")[0] })}
          </h1>
          {client ? (
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2 flex-wrap">
              {t("dashboard.viewing")} <span className="text-foreground font-medium">{client.name}</span>
              {isPracticeClient && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 font-medium">Sample</span>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm mt-1">Care Net Portal — {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
          </div>
          <button
            onClick={() => {
              const summaryText = `Today's overview for ${client?.name || "your client"}. You have ${pendingToday} pending and ${completedToday} completed items today. ${urgentItems.length > 0 ? `There are ${urgentItems.length} urgent items requiring attention.` : "No urgent items at this time."} ${recentActivity.length > 0 ? `Recent activity: ${recentActivity[0]?.title}.` : ""}`;
              speakBecky(summaryText);
            }}
            data-testid="dashboard-listen"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5"
          >
            <Volume2 size={13} /> {t("dashboard.listen")}
          </button>
        </div>
      </div>

      {/* FCP connect prompt — shown when MC has no caregiver connected yet */}
      {isFamilyPortal && !activityLoading && !client?.caregiverId && activityLogs.length === 0 && scheduleEvents.length === 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Users size={17} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Connect your care circle</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Invite your caregiver to link portals. Once connected, you'll see their schedule, care log entries, and updates here in real time.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link href="/caregivers">
                <button className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
                  <UserPlus size={13} /> Invite Caregiver
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Multi-portal nudge — shown to single-portal MC users once snooze expires */}
      {showMultiPortalNudge && (
        <div className="rounded-xl border border-teal-300/50 dark:border-teal-700/40 bg-teal-50 dark:bg-teal-950/30 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Home size={17} className="text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Caring for more than one person?</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Care Net Portal supports multiple portals under one account. Each loved one gets their own color-coded space — you choose who to enter each time.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={returnToCareHome}
                className="flex items-center gap-1.5 text-xs font-medium bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors"
                data-testid="multi-portal-nudge-yes"
              >
                <Plus size={13} /> Add another loved one
              </button>
              <button
                onClick={() => snoozeMutation.mutate()}
                disabled={snoozeMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:border-foreground/30 transition-colors"
                data-testid="multi-portal-nudge-snooze"
              >
                Remind me later
              </button>
            </div>
          </div>
          <button
            onClick={() => setMultiPortalNudgeDismissedLocal(true)}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0 mt-0.5"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stats Row — 4 across, compact portrait tiles */}
      <div className="grid grid-cols-4 gap-1.5">
        {scheduleLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            {[
              { href: "/schedule",  icon: CheckCircle2,  iconBg: "bg-emerald-50 dark:bg-emerald-950/30", iconColor: "text-emerald-600 dark:text-emerald-400", value: completedToday,                                          label: t("dashboard.doneToday") },
              { href: "/schedule",  icon: CalendarDays,  iconBg: "bg-amber-50 dark:bg-amber-950/30",    iconColor: "text-amber-600 dark:text-amber-400",   value: pendingToday,                                            label: t("dashboard.pendingToday") },
              ...(!isFamilyPortal ? [{ href: "/activity",  icon: AlertTriangle, iconBg: "bg-red-50 dark:bg-red-950/30",     iconColor: "text-red-600 dark:text-red-400",      value: urgentItems.length,                          label: t("dashboard.urgentFlags") }] : [{ href: "/messages", icon: MessageSquare, iconBg: "bg-primary/10", iconColor: "text-primary", value: recentActivity.filter(l => l.isEmergency).length, label: "Messages" }]),
              { href: "/activity", icon: NotebookPen,   iconBg: "bg-primary/10",                       iconColor: "text-primary",                         value: activityLogs.length,                                     label: t("dashboard.logEntries") },
            ].map(({ href, icon: Icon, iconBg, iconColor, value, label }) => (
              <button
                key={label}
                onClick={() => navigate(href)}
                className="flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all group text-center"
                data-testid={`stat-card-${href.replace("/", "")}`}
              >
                <Icon size={16} className={iconColor} />
                <div className="text-xl font-bold leading-none" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{value}</div>
                <div className="text-[10px] font-medium text-muted-foreground leading-tight">{label}</div>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <span className="flex items-center gap-2"><Calendar size={16} /> {t("dashboard.upcomingSchedule")}</span>
              <Link href="/schedule" className="text-xs text-primary hover:underline font-normal">{t("dashboard.viewAll")}</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scheduleLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
            ) : upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                <p>{t("dashboard.noUpcoming")}</p>
              </div>
            ) : upcomingEvents.map(event => {
              const Icon = TYPE_ICONS[event.type] || Calendar;
              return (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", event.priority === "red" ? "bg-red-100 dark:bg-red-950/40" : event.priority === "yellow" ? "bg-amber-100 dark:bg-amber-950/40" : "bg-emerald-100 dark:bg-emerald-950/40")}>
                    <Icon size={14} className={event.priority === "red" ? "text-red-600" : event.priority === "yellow" ? "text-amber-600" : "text-emerald-600"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-medium">{event.title}</div>
                      <PriorityBadge priority={event.priority} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatDate(event.scheduledAt)}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <span className="flex items-center gap-2"><ClipboardCheck size={16} /> {t("dashboard.recentActivity")}</span>
              <Link href="/activity" className="text-xs text-primary hover:underline font-normal">{t("dashboard.viewAll")}</Link>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-medium">{log.title}</div>
                    <PriorityBadge priority={log.priority} />
                  </div>
                  {log.description && <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">{log.description}</div>}
                  <div className="text-xs text-muted-foreground mt-0.5">{formatTime(log.loggedAt)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Urgent Flags — hidden in Family Care Portal */}
        {urgentItems.length > 0 && !isFamilyPortal && (
          <Card className="border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10 md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                <AlertTriangle size={16} />
                {t("dashboard.urgentFlags")}
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
                <Link href="/portal" className="text-xs text-primary hover:underline font-normal flex items-center gap-1">Full profile <ChevronRight size={12} /></Link>
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
                      {JSON.parse(client.allergies).map((a: any, i: number) => {
                        const label = typeof a === "string" ? a : a?.name ?? "";
                        return <span key={label + i} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900">{label}</span>;
                      })}
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

      {/* Care Quality Badges */}
      {showBadges && (
        <Card className="border-border" data-testid="achievements-widget">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <Trophy size={16} className="text-amber-500" /> Your Achievements
              <span className="ml-auto text-xs font-normal text-muted-foreground">{earnedBadges.length}/{ALL_BADGES.length} earned</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {earnedBadges.map(badge => (
                <div
                  key={badge.id}
                  className={cn("flex-shrink-0 w-44 p-3 rounded-xl border", badge.bg)}
                  data-testid={`badge-${badge.id}`}
                >
                  <div className="text-2xl mb-1">{badge.icon}</div>
                  <div className={cn("text-xs font-bold", badge.color)}>{badge.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{badge.desc}</div>
                  <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={10} className="text-emerald-500" /> Earned {badge.earned}
                  </div>
                </div>
              ))}
              {inProgressBadges.map(badge => (
                <div
                  key={badge.id}
                  className="flex-shrink-0 w-44 p-3 rounded-xl border border-border bg-muted/30 opacity-50"
                  data-testid={`badge-pending-${badge.id}`}
                >
                  <div className="text-2xl mb-1 grayscale">{badge.icon}</div>
                  <div className="text-xs font-bold text-muted-foreground">{badge.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{badge.desc}</div>
                  <div className="text-xs text-muted-foreground mt-1.5">In progress...</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample Client creation modal — triggered from the dashboard nudge */}
      <SampleClientModal
        open={sampleModalOpen}
        onOpenChange={setSampleModalOpen}
        onCreated={() => {
          setSampleModalOpen(false);
          setSampleNudgeDismissed(true);
          window.location.reload();
        }}
      />

      {/* ── Self-care MC invite popup — one-time, post-signup ── */}
      <Dialog open={mcInviteModalOpen} onOpenChange={(open) => { if (!open) dismissMcInviteModal(); }}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden" data-testid="dialog-mc-invite">
          {/* Header */}
          <div className="bg-teal-600 px-6 pt-6 pb-5 text-white">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-base font-semibold leading-snug">Want someone to help coordinate or monitor your care?</h2>
            <p className="text-sm text-teal-100 mt-1 leading-relaxed">A Main Contact can stay informed, communicate with your caregivers, and step in when you need them.</p>
          </div>

          {/* Options */}
          <div className="px-5 py-5 space-y-3">
            <button
              onClick={() => { dismissMcInviteModal(); navigate("/client-profile"); }}
              data-testid="btn-mc-invite-yes"
              className="w-full text-left rounded-xl border-2 border-teal-500 bg-teal-50 dark:bg-teal-950/30 dark:border-teal-700 px-4 py-3.5 transition-colors hover:bg-teal-100 dark:hover:bg-teal-950/50"
            >
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Yes, invite someone now</p>
              <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">Takes you to your Client Profile to send the invite.</p>
            </button>

            <button
              onClick={dismissMcInviteModal}
              data-testid="btn-mc-invite-skip"
              className="w-full text-left rounded-xl border border-border bg-muted/30 px-4 py-3.5 transition-colors hover:bg-muted/60"
            >
              <p className="text-sm font-semibold text-foreground">I've got this for now</p>
              <p className="text-xs text-muted-foreground mt-0.5">You can always invite a Main Contact later from your Client Profile.</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
