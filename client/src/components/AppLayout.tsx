import { useApp, type ActiveUser, isCaregiverRole, type ColorTheme } from "@/App";
import HelpDesk from "@/components/HelpDesk";
import { useLang } from "@/lib/useLang";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Shift } from "@shared/schema";
import type { Notification } from "@shared/schema";
import {
  LayoutDashboard, Calendar, ClipboardList, MessageSquare, MessageCircleHeart,
  Image, Archive, User, Bell, Sun, Moon, ChevronDown,
  Menu, X, Users, Shield, Eye, Mic, UserPlus, Heart,
  Sparkles, Lock, StickyNote, MicOff, ClipboardSignature,
  TrendingUp, ShieldAlert, FolderOpen, MapPin, Palette,
  Timer, LogIn, LogOut, Radio, Activity, Pill, Award, BookHeart, BookOpen, SlidersHorizontal,
  NotebookPen, CalendarDays, GraduationCap, Link2, Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuGroup
} from "@/components/ui/dropdown-menu";
import TTSBar from "@/components/TTSBar";
import DailyNudge from "@/components/DailyNudge";
import {
  isVoiceSupported,
  createVoiceRecognizer,
  type VoiceCommandStatus,
  type VoiceCommandResult,
} from "@/lib/voiceCommands";
import VoiceCommandModal, { type VoiceCommandConfirmState } from "@/components/VoiceCommandModal";
import { speakText } from "@/lib/ttsUtils";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import type { TranslationKey } from "@/lib/i18n";

import NavOverlay, { NAV_COLORS } from "@/components/NavOverlay";
import { WellbeingModal, ProactiveNudgeBanner } from "@/components/WellbeingModal";

const NAV_ITEMS_CAREGIVER: { path: string; labelKey: TranslationKey; icon: any; emergency?: boolean }[] = [
  { path: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { path: "/schedule", labelKey: "nav.schedule", icon: CalendarDays },
  { path: "/activity", labelKey: "nav.activity", icon: NotebookPen },
  { path: "/notes", labelKey: "nav.notes", icon: StickyNote },
  { path: "/messages", labelKey: "nav.messages", icon: MessageSquare },
  { path: "/media", labelKey: "nav.media", icon: Image },
  { path: "/outings", labelKey: "nav.outings", icon: MapPin },
  { path: "/archive", labelKey: "nav.archive", icon: Archive },
  { path: "/medications", labelKey: "nav.medications", icon: Pill },
  { path: "/vitals", labelKey: "nav.vitals", icon: Activity },
  { path: "/badges", labelKey: "nav.badges", icon: Award },
  { path: "/thoughts", labelKey: "nav.thoughts", icon: BookHeart },
  { path: "/wellbeing", labelKey: "nav.wellbeing", icon: MessageCircleHeart },
  { path: "/my-profile", labelKey: "nav.myProfile", icon: UserPlus },
  { path: "/trends", labelKey: "nav.trends", icon: TrendingUp },
  { path: "/handoff", labelKey: "nav.handoff", icon: ClipboardSignature },
  { path: "/caregivers", labelKey: "nav.caregivers", icon: Users },
  { path: "/portal", labelKey: "nav.portal", icon: User },
  { path: "/documents", labelKey: "nav.documents", icon: FolderOpen },
  { path: "/care-scope", labelKey: "nav.careScope", icon: SlidersHorizontal },
  { path: "/university", labelKey: "nav.university", icon: GraduationCap },
  { path: "/patterns", labelKey: "nav.patterns", icon: Sparkles },
  { path: "/emergency", labelKey: "nav.emergency", icon: ShieldAlert, emergency: true },
];

const NAV_ITEMS_PRECARE: { path: string; labelKey: TranslationKey; icon: any; emergency?: boolean }[] = [
  { path: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { path: "/schedule", labelKey: "nav.schedule", icon: CalendarDays },
  { path: "/activity", labelKey: "nav.activity", icon: NotebookPen },
  { path: "/notes", labelKey: "nav.notes", icon: StickyNote },
  { path: "/messages", labelKey: "nav.messages", icon: MessageSquare },
  { path: "/media", labelKey: "nav.media", icon: Image },
  { path: "/outings", labelKey: "nav.outings", icon: MapPin },
  { path: "/archive", labelKey: "nav.archive", icon: Archive },
  { path: "/medications", labelKey: "nav.medications", icon: Pill },
  { path: "/vitals", labelKey: "nav.vitals", icon: Activity },
  { path: "/badges", labelKey: "nav.badges", icon: Award },
  { path: "/thoughts", labelKey: "nav.thoughts", icon: BookHeart },
  { path: "/trends", labelKey: "nav.trends", icon: TrendingUp },
  { path: "/documents", labelKey: "nav.documents", icon: FolderOpen },
  { path: "/care-scope", labelKey: "nav.careScope", icon: SlidersHorizontal },
  { path: "/emergency", labelKey: "nav.emergency", icon: ShieldAlert, emergency: true },
  { path: "/portal", labelKey: "nav.portal", icon: User },
];

export const ROLE_LABELS: Record<string, string> = {
  caregiver: "Primary Caregiver",
  multi_caregiver: "Caregiver",
  temp_caregiver: "Temp Caregiver",
  primary_family: "Main Contact",
  secondary_family: "Family Member",
};

const ROLE_GROUPS = [
  {
    label: "Caregivers",
    roles: ["caregiver", "multi_caregiver", "temp_caregiver"],
  },
  {
    label: "Family",
    roles: ["primary_family", "secondary_family"],
  },
];

export function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    red: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
    yellow: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
    green: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
  };
  const labels = { red: "Urgent", yellow: "Important", green: "Normal" };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap", colors[priority as keyof typeof colors] || colors.green)}>
      {labels[priority as keyof typeof labels] || "Normal"}
    </span>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { activeUser, setActiveUser, demoUsers, selectedClientId, setSelectedClientId, theme, toggleTheme, appMode, colorTheme, setColorTheme, triggerOnboarding, portalMode, isRealSession, isPreConnection } = useApp();
  const isFamilyPortal = portalMode === "family";
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navOverlayOpen, setNavOverlayOpen] = useState(false);
  const [navOrder, setNavOrder] = useState<string[] | null>(null);
  const { t, lang, setLang } = useLang();
  const { toast } = useToast();

  // ── Pre-connection demo banner ─────────────────────────────────────────────
  const [preConnBannerDismissed, setPreConnBannerDismissed] = useState(false);
  const [preConnInviteLink, setPreConnInviteLink] = useState("");
  const [preConnCopied, setPreConnCopied] = useState(false);
  const showPreConnBanner = isPreConnection && !preConnBannerDismissed;

  const preConnInviteMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/invite/create", { inviteType: "caregiver_to_mc" }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.token) {
        const link = `${window.location.origin}/#/invite/${data.token}`;
        setPreConnInviteLink(link);
        navigator.clipboard.writeText(link).then(() => {
          setPreConnCopied(true);
          toast({ title: "Invite link copied!", description: "Share it with your family contact to get started." });
          setTimeout(() => setPreConnCopied(false), 3000);
        });
      }
    },
    onError: () => toast({ title: "Could not generate invite", description: "Please try again.", variant: "destructive" }),
  });

  function handlePreConnInvite() {
    if (preConnInviteLink) {
      navigator.clipboard.writeText(preConnInviteLink).then(() => {
        setPreConnCopied(true);
        toast({ title: "Link copied!", description: "Share it with your family contact." });
        setTimeout(() => setPreConnCopied(false), 3000);
      });
    } else {
      preConnInviteMutation.mutate();
    }
  }

  // ── Wellbeing state ──────────────────────────────────────────────────────────
  const [wellbeingOpen, setWellbeingOpen] = useState(false);
  const [proactiveNudgeDismissed, setProactiveNudgeDismissed] = useState(false);
  const [wellbeingTriggerType, setWellbeingTriggerType] = useState<"manual" | "proactive_shift_end" | "proactive_trend">("manual");

  // Check for proactive nudge (high urgency in last 72h) — caregiver roles only
  const { data: nudgeData } = useQuery<{ shouldNudge: boolean; urgentCount: number }>({
    queryKey: ["/api/wellbeing/nudge", activeUser.id, selectedClientId],
    queryFn: () => apiRequest("GET", `/api/wellbeing/nudge/${activeUser.id}/client/${selectedClientId}`).then(r => r.json()),
    enabled: isCaregiverRole(activeUser.role) && !proactiveNudgeDismissed,
    refetchInterval: 15 * 60 * 1000,
  });

  const showProactiveNudge = !!(nudgeData?.shouldNudge && !proactiveNudgeDismissed && !wellbeingOpen && isCaregiverRole(activeUser.role) && portalMode !== "family");

  function openWellbeing(type: typeof wellbeingTriggerType = "manual") {
    setWellbeingTriggerType(type);
    setWellbeingOpen(true);
  }

  // ── Voice state ──────────────────────────────────────────────────────────────
  const [voiceStatus, setVoiceStatus] = useState<VoiceCommandStatus>("idle");
  const [hfmActive, setHfmActive] = useState(false);
  const [voiceConfirm, setVoiceConfirm] = useState<VoiceCommandConfirmState | null>(null);
  const [lastConfirmed, setLastConfirmed] = useState<{ type: string; text?: string } | null>(null);
  const [isSubmittingVoice, setIsSubmittingVoice] = useState(false);

  // Fetch threads for message routing — needed by voice send_message handler
  const { data: threads = [] } = useQuery<any[]>({
    queryKey: ["/api/clients", selectedClientId, "threads"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/threads`).then(r => r.json()),
  });

  // The recognizer is kept in a ref so it survives re-renders without recreation
  const recognizerRef = useRef<ReturnType<typeof createVoiceRecognizer>>(null);

  // Handler called by recognizer when a fully-parsed command arrives
  const handleVoiceResult = useCallback((result: VoiceCommandResult) => {
    if (result.type === "navigate" && result.route) {
      window.location.hash = "#" + result.route;
      return;
    }
    if (result.type === "read_summary") {
      speakText(t("archive.title"));
      window.location.hash = "#/archive";
      return;
    }
    // open_log: navigate to care log and signal it to open the new entry form
    if (result.type === "open_log") {
      window.location.hash = "#/activity";
      // Small delay so the page mounts, then dispatch custom event to open form
      setTimeout(() => window.dispatchEvent(new CustomEvent("voice:open-log")), 350);
      speakText("Opening new care log entry");
      return;
    }
    // open_message: navigate to messages and signal which thread to open
    if (result.type === "open_message") {
      window.location.hash = "#/messages";
      // Find best-matching thread by recipient name (fuzzy: does thread name include spoken name words?)
      const recipientLower = (result.recipient || "").toLowerCase();
      const recipientWords = recipientLower.split(/\s+/).filter(w => w.length > 2);
      const matchedThread = threads.find(th => {
        const nameLower = (th.name || "").toLowerCase();
        return recipientWords.some(w => nameLower.includes(w));
      });
      setTimeout(() => window.dispatchEvent(new CustomEvent("voice:open-message", {
        detail: { threadId: matchedThread?.id ?? null, recipient: result.recipient }
      })), 350);
      speakText(matchedThread ? `Opening message to ${matchedThread.name}` : "Opening messages");
      return;
    }
    if (result.type === "unknown") {
      toast({ title: t("voice.tap.label"), description: t("voice.unknown"), variant: "destructive" });
      speakText(t("voice.unknown"));
      return;
    }
    if (result.type === "log_activity" || result.type === "send_message") {
      // Show confirm/edit modal before writing to DB
      setVoiceConfirm({
        result,
        onCancel: () => setVoiceConfirm(null),
        onConfirm: async ({ text, category, priority }) => {
          setIsSubmittingVoice(true);
          try {
            if (result.type === "log_activity") {
              await apiRequest("POST", `/api/clients/${selectedClientId}/activity`, {
                title: text.slice(0, 80),
                description: text,
                category,
                priority,
                loggedAt: new Date().toISOString(),
                caregiverId: activeUser.id,
              });
              queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "activity"] });
              setLastConfirmed({ type: "log_activity", text });
              speakText(t("voice.logged"));
            } else {
              // Send message — try to match thread by recipient name, fall back to threads[0]
              const recipientLower = (result.recipient || result.thread || "").toLowerCase();
              const recipientWords = recipientLower.split(/\s+/).filter(w => w.length > 2);
              const targetThread = recipientWords.length
                ? threads.find(th => {
                    const nameLower = (th.name || "").toLowerCase();
                    return recipientWords.some(w => nameLower.includes(w));
                  }) ?? threads[0]
                : threads[0];
              if (targetThread) {
                await apiRequest("POST", `/api/threads/${targetThread.id}/messages`, {
                  senderId: activeUser.id,
                  content: text,
                  priority,
                });
                queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
                setLastConfirmed({ type: "send_message", text });
                speakText(t("voice.sent"));
              }
            }
          } catch (e) {
            toast({ title: t("common.error"), variant: "destructive" });
          } finally {
            setIsSubmittingVoice(false);
            setVoiceConfirm(null);
          }
        },
      });
    }
  }, [selectedClientId, activeUser.id, threads, t, toast]);

  // Build recognizer once, keep in sync with lang
  useEffect(() => {
    if (!isVoiceSupported()) return;
    recognizerRef.current = createVoiceRecognizer(
      handleVoiceResult,
      setVoiceStatus,
      () => {
        // Wake word callback — brief audio cue
        speakText(lang === "es" ? "Escuchando" : "Listening");
      },
      lang
    );
    // If HFM was active, restart it with the new recognizer
    if (hfmActive) {
      recognizerRef.current?.startHFM();
    }
    return () => {
      recognizerRef.current?.stopHFM();
      recognizerRef.current?.stopTap();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Keep recognizer lang in sync when lang changes (without full rebuild)
  useEffect(() => {
    recognizerRef.current?.setLang(lang);
  }, [lang]);

  // HFM toggle handler
  const handleToggleHFM = useCallback(() => {
    if (!isVoiceSupported()) {
      toast({ title: t("voice.tap.label"), description: t("voice.unsupported"), variant: "destructive" });
      return;
    }
    if (hfmActive) {
      recognizerRef.current?.stopHFM();
      setHfmActive(false);
      toast({ title: t("voice.hfm.toast.off") });
    } else {
      if (!recognizerRef.current) {
        recognizerRef.current = createVoiceRecognizer(
          handleVoiceResult, setVoiceStatus,
          () => speakText(lang === "es" ? "Escuchando" : "Listening"),
          lang
        );
      }
      recognizerRef.current?.startHFM();
      setHfmActive(true);
      toast({
        title: t("voice.hfm.toast.on"),
        description: t("voice.hfm.toast.on.desc"),
      });
    }
  }, [hfmActive, lang, t, toast, handleVoiceResult]);

  // Tap-mode mic handler
  const handleVoiceMic = useCallback(() => {
    if (!isVoiceSupported()) {
      toast({ title: t("voice.tap.label"), description: t("voice.unsupported"), variant: "destructive" });
      return;
    }
    if (hfmActive) {
      // In HFM, tap mic just shows status — don't interfere
      return;
    }
    if (!recognizerRef.current) {
      recognizerRef.current = createVoiceRecognizer(
        handleVoiceResult, setVoiceStatus,
        () => speakText(lang === "es" ? "Escuchando" : "Listening"),
        lang
      );
    }
    if (voiceStatus === "listening") {
      recognizerRef.current?.stopTap();
    } else {
      recognizerRef.current?.startTap();
    }
  }, [voiceStatus, hfmActive, lang, t, toast, handleVoiceResult]);

  // ── Shift timer ──────────────────────────────────────────────────────────────
  const shiftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [shiftElapsed, setShiftElapsed] = useState(0); // seconds

  // Active shift query — only for caregiver roles
  const { data: activeShift } = useQuery<Shift | null>({
    queryKey: ["/api/shifts/active", activeUser.id, selectedClientId],
    queryFn: () => isCaregiverRole(activeUser.role)
      ? apiRequest("GET", `/api/caregivers/${activeUser.id}/clients/${selectedClientId}/shift/active`).then(r => r.json())
      : Promise.resolve(null),
    enabled: isCaregiverRole(activeUser.role),
    refetchInterval: 60000,
  });

  // Tick elapsed time every second while on shift
  useEffect(() => {
    if (activeShift?.clockedInAt) {
      const update = () => {
        const diff = Math.floor((Date.now() - new Date(activeShift.clockedInAt!).getTime()) / 1000);
        setShiftElapsed(diff);
      };
      update();
      shiftTimerRef.current = setInterval(update, 1000);
    } else {
      setShiftElapsed(0);
      if (shiftTimerRef.current) clearInterval(shiftTimerRef.current);
    }
    return () => { if (shiftTimerRef.current) clearInterval(shiftTimerRef.current); };
  }, [activeShift?.id, activeShift?.clockedInAt]);

  const clockInMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/caregivers/${activeUser.id}/clients/${selectedClientId}/shift/clockin`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/active", activeUser.id, selectedClientId] });
      toast({ title: t("shift.clockedIn.title"), description: t("shift.clockedIn.desc") });
    },
    onError: (err: any) => {
      toast({ title: "Already clocked in", description: "An active shift is already running.", variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: (shiftId: number) => apiRequest("POST", `/api/shifts/${shiftId}/clockout`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/active", activeUser.id, selectedClientId] });
      toast({ title: t("shift.clockedOut.title"), description: t("shift.clockedOut.desc") });
    },
  });

  function formatElapsed(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/users", activeUser.id, "notifications"],
    queryFn: () => apiRequest("GET", `/api/users/${activeUser.id}/notifications`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const isPreCare = appMode === "precare";
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";
  const rawNavItems = isPreCare ? NAV_ITEMS_PRECARE : NAV_ITEMS_CAREGIVER;
  // Family never sees Thoughts or My Profile in nav
  // Family portal hides Badges and CareScope (scoring-only features)
  const NAV_ITEMS = (() => {
    let items = rawNavItems;
    if (isFamily) items = items.filter(n => n.path !== "/thoughts" && n.path !== "/my-profile");
    if (isFamilyPortal) items = items.filter(n => n.path !== "/badges" && n.path !== "/care-scope" && n.path !== "/my-profile" && n.path !== "/patterns" && n.path !== "/archive");
    // University always visible to caregiver + MC; ensure it's in family nav
    const hasUniversity = items.some(n => n.path === "/university");
    if (!hasUniversity && (isFamily || isFamilyPortal)) {
      const emergencyIdx = items.findIndex(n => n.path === "/emergency");
      const uniItem = { path: "/university", labelKey: "nav.university" as TranslationKey, icon: GraduationCap };
      if (emergencyIdx > -1) items = [...items.slice(0, emergencyIdx), uniItem, ...items.slice(emergencyIdx)];
      else items = [...items, uniItem];
    }
    return items;
  })();

  // Group demo users for the switcher
  const client1Users = demoUsers.filter(u => u.clientId === 1);
  const client2Users = demoUsers.filter(u => u.clientId === 2);
  const client3Users = demoUsers.filter(u => u.clientId === 3);

  const Sidebar = () => (
    <aside className={cn(
      "relative flex flex-col h-full text-sidebar-foreground",
      isPreCare ? "bg-gradient-to-b from-teal-900 to-slate-900" : "bg-sidebar"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex-shrink-0">
          {isPreCare ? (
            <div className="w-8 h-8 rounded-lg bg-teal-500/30 flex items-center justify-center">
              <Heart size={16} className="text-teal-300" />
            </div>
          ) : isFamilyPortal ? (
            // Rose/mauve logo for family portal
            <svg aria-label="Family Care Portal" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="hsl(345, 52%, 36%)"/>
              <path d="M16 9c1.5-2 4.5-2.5 6 0s1 5-1.5 7.5L16 22l-4.5-5.5C9 14 8.5 11 10 9s4.5-2 6 0z" fill="white" opacity="0.95"/>
            </svg>
          ) : (
            <svg aria-label="Care Net Portal" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="hsl(175, 55%, 28%)"/>
              <path d="M16 8a5 5 0 0 1 5 5c0 4-5 11-5 11S11 17 11 13a5 5 0 0 1 5-5z" fill="white"/>
              <circle cx="16" cy="13" r="2" fill="hsl(175, 55%, 28%)"/>
            </svg>
          )}
        </div>
        <div>
          <div className="font-bold text-sm text-sidebar-foreground leading-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            {isFamilyPortal ? "Family Care" : "Care Net"}
          </div>
          <div className={cn("text-xs", isPreCare ? "text-teal-400" : "text-sidebar-foreground/50")}>
            {isPreCare ? "Pre-Care Mode" : isFamilyPortal ? "Portal" : "Portal"}
          </div>
        </div>
        {isPreCare && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-medium">PRE-CARE</span>
        )}
        {isFamilyPortal && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "hsl(345 52% 36% / 0.2)", color: "hsl(345 52% 72%)", border: "1px solid hsl(345 52% 36% / 0.3)" }}>FAMILY</span>
        )}
      </div>

      {/* Client Selector (caregiver/facilitator roles) */}
      {isCaregiverRole(activeUser.role) && (
        <div className="px-3 py-3 border-b border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/40 uppercase tracking-wider mb-2 px-2">Active Client</div>
          <div className="flex flex-col gap-1">
            {[
              { id: 1, label: "Robert J.", mode: "caregiver" },
              { id: 2, label: "Eleanor W.", mode: "caregiver" },
              { id: 3, label: "Frank G.", mode: "precare", badge: "Pre-Care" },
            ].filter(c => c.id !== 3).map(c => (
              <button
                key={c.id}
                data-testid={`client-selector-${c.id}`}
                onClick={() => setSelectedClientId(c.id)}
                className={cn("flex items-center justify-between text-xs py-2 px-3 rounded-md transition-all", selectedClientId === c.id ? "bg-sidebar-primary/20 text-sidebar-primary border border-sidebar-primary/30" : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground")}
              >
                <span>{c.label}</span>
                {c.badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400">{c.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clock In / Clock Out — caregiver roles only */}
      {isCaregiverRole(activeUser.role) && (
        <div className="px-3 py-3 border-b border-sidebar-border">
          {activeShift ? (
            // ON SHIFT
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="text-xs font-medium text-emerald-400">{t("shift.onShift")}</span>
                <span className="ml-auto text-xs font-mono text-emerald-300">{formatElapsed(shiftElapsed)}</span>
              </div>
              <button
                data-testid="clock-out-btn"
                onClick={() => clockOutMutation.mutate(activeShift.id)}
                disabled={clockOutMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-medium transition-colors"
              >
                <LogOut size={13} />
                {clockOutMutation.isPending ? t("shift.clockingOut") : t("shift.clockOut")}
              </button>
            </div>
          ) : (
            // OFF SHIFT
            <button
              data-testid="clock-in-btn"
              onClick={() => clockInMutation.mutate()}
              disabled={clockInMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors"
            >
              <LogIn size={13} />
              {clockInMutation.isPending ? t("shift.clockingIn") : t("shift.clockIn")}
            </button>
          )}
        </div>
      )}

      {/* Pre-Care upgrade banner */}
      {isPreCare && isCaregiverRole(activeUser.role) && (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-teal-500/10 border border-teal-500/30">
          <div className="text-xs text-teal-300 font-medium mb-1 flex items-center gap-1.5">
            <Sparkles size={11} /> Pre-Care Mode Active
          </div>
          <p className="text-xs text-sidebar-foreground/50 leading-relaxed">Managing care as a family. When ready, add a dedicated caregiver.</p>
          <button className="mt-2 text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium">
            <Lock size={10} /> Upgrade to Full Care
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ path, labelKey, icon: Icon, ...rest }) => {
          const isEmergency = (rest as any).emergency;
          const isActive = path === "/" ? location === "/" : location.startsWith(path);
          const label = t(labelKey);
          return (
            <Link key={path} href={path} onClick={() => setMobileOpen(false)}>
              <a className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-primary/20 text-sidebar-primary"
                  : isEmergency
                  ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )} data-testid={`nav-${path.replace(/\//g, '') || 'dashboard'}`}>
                <Icon size={18} className={cn("flex-shrink-0", isEmergency && !isActive && "text-red-400")} />
                {label}
                {path === "/messages" && unreadCount > 0 && (
                  <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Voice hint — shows HFM status or tip */}
      {isCaregiverRole(activeUser.role) && isVoiceSupported() && (
        <div className={cn(
          "mx-3 mb-2 px-3 py-2 rounded-lg flex items-center gap-2 text-xs transition-all",
          hfmActive
            ? voiceStatus === "hfm_triggered"
              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
              : "bg-primary/10 border border-primary/30 text-primary/80"
            : "text-sidebar-foreground/40"
        )}>
          {hfmActive ? (
            <>
              <span className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                voiceStatus === "hfm_triggered" ? "bg-emerald-400 animate-pulse" : "bg-primary/60 animate-pulse"
              )} />
              <span className="leading-tight">
                {voiceStatus === "hfm_triggered" ? t("voice.hfm.triggered") : t("voice.hfm.armed")}
              </span>
            </>
          ) : (
            <>
              <Mic size={11} />
              <span>{t("voice.hint")}</span>
            </>
          )}
        </div>
      )}

      {/* Theme + Language — sidebar row (always visible, key for mobile) */}
      <div className="px-3 py-2 border-t border-sidebar-border flex items-center gap-2">
        <button
          onClick={toggleTheme}
          data-testid="theme-toggle-sidebar"
          aria-label="Toggle theme"
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
        <div className="w-px h-5 bg-sidebar-border" />
        <button
          onClick={() => setLang(lang === "en" ? "es" : "en")}
          data-testid="lang-toggle-sidebar"
          aria-label="Toggle language"
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-xs font-semibold text-sidebar-foreground/60 hover:text-sidebar-foreground"
        >
          {lang === "en" ? "ES" : "EN"}
        </button>
        {isCaregiverRole(activeUser.role) && !isFamilyPortal && (
          <>
            <div className="w-px h-5 bg-sidebar-border" />
            <a
              href={`${"__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__"}/becky-admin`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="becky-admin-link"
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
              title="Becky's Response Library"
            >
              <BookHeart size={13} />
            </a>
          </>
        )}
        {showThemePicker && (
          <div className="absolute left-3 bottom-32 z-50 bg-white dark:bg-zinc-900 border border-border rounded-lg shadow-2xl p-3 flex gap-2">
            {([
              { key: "teal", color: "#2a8c7a", label: "Teal" },
              { key: "sand", color: "#7a4a1f", label: "Sand" },
              { key: "navy", color: "#2a4a9a", label: "Navy" },
              { key: "lavender", color: "#6a3a9a", label: "Lavender" },
            ] as { key: ColorTheme; color: string; label: string }[]).map(({ key, color, label }) => (
              <button
                key={key}
                onClick={() => { setColorTheme(key); setShowThemePicker(false); }}
                className={cn("w-7 h-7 rounded-full border-2 transition-all", colorTheme === key ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                style={{ backgroundColor: color }}
                title={label}
                data-testid={`theme-color-sidebar-${key}`}
              />
            ))}
          </div>
        )}
        <button
          onClick={() => setShowThemePicker(p => !p)}
          className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground"
          aria-label="Color theme picker"
          data-testid="color-theme-btn-sidebar"
        >
          <Palette size={14} />
        </button>
      </div>

      {/* Help Desk — always visible */}
      <div className="px-3 py-2">
        <a
          href="mailto:portal@carenetportal.com"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          data-testid="help-desk-btn"
        >
          <MessageCircleHeart size={14} className="flex-shrink-0" />
          <span>Need help? Contact support</span>
        </a>
        <Link
          href="/notification-prefs"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          data-testid="notification-prefs-btn"
        >
          <Bell size={14} className="flex-shrink-0" />
          <span>Notification preferences</span>
        </Link>
      </div>

      {/* User Profile / Role Switcher */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left" data-testid="user-menu-trigger">
              <div className="w-8 h-8 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-sidebar-primary text-xs font-bold flex-shrink-0">
                {activeUser.avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-sidebar-foreground truncate">{activeUser.name}</div>
                <div className="text-xs text-sidebar-foreground/50">{ROLE_LABELS[activeUser.role]}</div>
              </div>
              <ChevronDown size={14} className="text-sidebar-foreground/40 flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64 bg-white dark:bg-zinc-900 border border-border shadow-2xl">
            {!isRealSession && <><DropdownMenuLabel>Switch Role (Demo)</DropdownMenuLabel>
            <DropdownMenuSeparator /></>}

            {!isRealSession && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1">Client 1 — Robert Johnson</DropdownMenuLabel>
                  {client1Users.map(user => (
                    <DropdownMenuItem key={user.id} onClick={() => setActiveUser(user)} className="cursor-pointer" data-testid={`role-switch-${user.id}`}>
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold mr-2 flex-shrink-0">{user.avatarInitials}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
                      </div>
                      {user.role === "temp_caregiver" && <span className="text-[10px] px-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 ml-1">Temp</span>}
                      {activeUser.id === user.id && <span className="ml-1 text-primary text-xs">●</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1">Client 2 — Eleanor Williams</DropdownMenuLabel>
                  {client2Users.map(user => (
                    <DropdownMenuItem key={user.id} onClick={() => setActiveUser(user)} className="cursor-pointer" data-testid={`role-switch-${user.id}`}>
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold mr-2 flex-shrink-0">{user.avatarInitials}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
                      </div>
                      {activeUser.id === user.id && <span className="ml-1 text-primary text-xs">●</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1">Client 3 — Frank Garcia (Pre-Care)</DropdownMenuLabel>
                  {client3Users.map(user => (
                    <DropdownMenuItem key={user.id} onClick={() => setActiveUser(user)} className="cursor-pointer" data-testid={`role-switch-${user.id}`}>
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold mr-2 flex-shrink-0">{user.avatarInitials}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
                      </div>
                      <span className="text-[10px] px-1.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 ml-1">Pre-Care</span>
                      {activeUser.id === user.id && <span className="ml-1 text-primary text-xs">●</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Real user info */}
            {isRealSession && (
              <>
                <div className="px-2 py-2">
                  <div className="text-xs text-muted-foreground">Signed in as</div>
                  <div className="text-sm font-medium text-foreground truncate">{activeUser.name}</div>
                  <div className="text-xs text-muted-foreground">{ROLE_LABELS[activeUser.role]}</div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuSeparator className={isRealSession ? "hidden" : ""} />
            <DropdownMenuItem
              onClick={() => navigate("/pricing")}
              className="cursor-pointer text-muted-foreground"
              data-testid="nav-pricing"
            >
              <Sparkles size={14} className="mr-2" />
              Pricing
            </DropdownMenuItem>
            {!isRealSession && isCaregiverRole(activeUser.role) && (
              <DropdownMenuItem
                onClick={triggerOnboarding}
                className="cursor-pointer text-muted-foreground"
                data-testid="replay-onboarding"
              >
                <BookOpen size={14} className="mr-2" />
                Replay Introduction
              </DropdownMenuItem>
            )}
            {isRealSession && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    fetch("/api/auth/logout", { method: "POST", credentials: "include" })
                      .finally(() => { window.location.href = "/#/login"; });
                  }}
                  className="cursor-pointer text-red-500 dark:text-red-400"
                  data-testid="sign-out-btn"
                >
                  <LogOut size={14} className="mr-2" />
                  Sign out
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-60 flex-shrink-0 border-r border-border">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-sidebar shadow-2xl">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className={cn(
            "flex items-center gap-3 px-4 py-3 border-b backdrop-blur-sm flex-shrink-0",
            isFamilyPortal
              ? "bg-sidebar border-sidebar-border"
              : "bg-background/80 border-border"
          )}>
          <button
            className={cn("p-2 rounded-lg transition-colors", isFamilyPortal ? "text-sidebar-foreground hover:bg-sidebar-accent" : "hover:bg-muted")}
            onClick={() => setNavOverlayOpen(true)}
            data-testid="nav-overlay-toggle"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          {/* Mode/Role indicator */}
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
            isFamilyPortal ? "bg-sidebar-accent text-sidebar-foreground/80 border border-sidebar-border"
            : isPreCare ? "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border border-teal-200 dark:border-teal-800"
            : "bg-muted text-muted-foreground")}>
            {isFamilyPortal ? <Heart size={12} /> : isPreCare ? <Heart size={12} /> : <Shield size={12} />}
            <span>{isFamilyPortal ? "Family Care" : isPreCare ? "Pre-Care Mode" : ROLE_LABELS[activeUser.role]}</span>
          </div>

          {/* Temp caregiver expiry badge */}
          {activeUser.role === "temp_caregiver" && activeUser.tempAccessEnd && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 text-xs border border-amber-200 dark:border-amber-900">
              <span>Temp access until {new Date(activeUser.tempAccessEnd).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
            </div>
          )}

          <div className="flex-1" />

          {/* Need a Friend — caregiver roles only, hidden in FCP */}
          {isCaregiverRole(activeUser.role) && portalMode !== "family" && (
            <button
              onClick={() => openWellbeing("manual")}
              data-testid="need-a-friend-btn"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all bg-rose-600/10 hover:bg-rose-600/20 border border-rose-600/25 hover:border-rose-500/40 text-rose-400 hover:text-rose-300"
            >
              <Heart size={11} className="fill-rose-400" />
              <span className="hidden sm:inline">Need a friend</span>
            </button>
          )}

          {/* Notification Bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("relative p-2 rounded-lg transition-colors", isFamilyPortal ? "text-sidebar-foreground hover:bg-sidebar-accent" : "hover:bg-muted")} data-testid="notifications-bell">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-zinc-900 border border-border shadow-2xl">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
              ) : notifications.slice(0, 6).map(n => (
                <DropdownMenuItem key={n.id} className={cn("flex flex-col items-start gap-1 py-3 cursor-pointer", !n.isRead && "bg-accent/30")}>
                  <div className="flex items-center gap-2 w-full">
                    <PriorityBadge priority={n.priority || "green"} />
                    {!n.isRead && <span className="ml-auto w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.body}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Voice Controls — caregiver roles only */}
          {isVoiceSupported() && isCaregiverRole(activeUser.role) && (
            <div className="flex items-center gap-1">
              {/* HFM toggle button */}
              <button
                onClick={handleToggleHFM}
                data-testid="hfm-toggle-button"
                aria-label={hfmActive ? t("voice.hfm.deactivate") : t("voice.hfm.activate")}
                title={hfmActive ? t("voice.hfm.deactivate") : t("voice.hfm.activate")}
                className={cn(
                  "relative p-2 rounded-lg transition-all",
                  hfmActive
                    ? "bg-primary/15 text-primary hover:bg-primary/25 ring-1 ring-primary/40"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                <Radio size={18} className={cn(hfmActive && "animate-pulse")} />
                {hfmActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
                )}
              </button>

              {/* Tap mic — disabled while HFM is on */}
              {!hfmActive && (
                <button
                  onClick={handleVoiceMic}
                  data-testid="voice-mic-button"
                  aria-label={voiceStatus === "listening" ? t("voice.tap.cancel") : t("voice.tap.label")}
                  className={cn(
                    "relative p-2 rounded-lg transition-colors",
                    voiceStatus === "listening"
                      ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-200"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <Mic size={18} className={cn(voiceStatus === "listening" && "animate-pulse")} />
                  {voiceStatus === "listening" && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              )}
            </div>
          )}

          {/* Color Theme Picker — desktop only, hidden in family portal */}
          <div className={cn("relative", isFamilyPortal ? "hidden" : "hidden md:block")}>
            <button
              onClick={() => setShowThemePicker(p => !p)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Color theme picker"
              data-testid="color-theme-btn"
            >
              <Palette size={18} />
            </button>
            {showThemePicker && (
              <div className="absolute right-0 top-10 z-50 bg-white dark:bg-zinc-900 border border-border rounded-lg shadow-2xl p-3 flex gap-2">
                {([
                  { key: "teal", color: "#2a8c7a", label: "Teal" },
                  { key: "sand", color: "#7a4a1f", label: "Sand" },
                  { key: "navy", color: "#2a4a9a", label: "Navy" },
                  { key: "lavender", color: "#6a3a9a", label: "Lavender" },
                ] as { key: ColorTheme; color: string; label: string }[]).map(({ key, color, label }) => (
                  <button
                    key={key}
                    onClick={() => { setColorTheme(key); setShowThemePicker(false); }}
                    className={cn("w-7 h-7 rounded-full border-2 transition-all", colorTheme === key ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                    style={{ backgroundColor: color }}
                    title={label}
                    data-testid={`theme-color-${key}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Language Toggle — desktop only (mobile uses sidebar) */}
          <button
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            className={cn("hidden md:block px-2.5 py-1.5 rounded-lg transition-colors text-xs font-semibold tracking-wide",
              isFamilyPortal ? "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              : "hover:bg-muted text-muted-foreground hover:text-foreground")}
            aria-label="Toggle language"
            data-testid="lang-toggle"
            title={lang === "en" ? "Cambiar a Español" : "Switch to English"}
          >
            {lang === "en" ? "ES" : "EN"}
          </button>

          {/* Theme Toggle — desktop only (mobile uses sidebar) */}
          <button onClick={toggleTheme}
            className={cn("hidden md:block p-2 rounded-lg transition-colors",
              isFamilyPortal ? "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              : "hover:bg-muted")}
            aria-label="Toggle theme" data-testid="theme-toggle">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16">
          <DailyNudge />
          {/* Proactive wellbeing nudge banner */}
          {showProactiveNudge && (
            <ProactiveNudgeBanner
              onOpen={() => { setProactiveNudgeDismissed(true); openWellbeing("proactive_shift_end"); }}
              onDismiss={() => setProactiveNudgeDismissed(true)}
            />
          )}
          {/* Pre-connection demo mode banner */}
          {showPreConnBanner && (
            <div className="mx-4 mt-4 rounded-xl border border-teal-400/40 bg-teal-50 dark:bg-teal-950/40 px-4 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <GraduationCap size={15} className="text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-teal-800 dark:text-teal-200 text-sm font-semibold leading-tight">You're in demo mode</p>
                <p className="text-teal-700/80 dark:text-teal-400/80 text-xs mt-0.5 leading-relaxed">
                  Everything unlocks once a client portal is created. Explore freely — this is live demo data.
                </p>
                <button
                  onClick={handlePreConnInvite}
                  disabled={preConnInviteMutation.isPending}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-300 hover:text-teal-900 dark:hover:text-white transition-colors"
                >
                  {preConnCopied
                    ? <><Check size={12} className="text-green-600 dark:text-green-400" /> Link copied — send it to your family contact</>  
                    : <><Link2 size={12} /> {preConnInviteMutation.isPending ? "Generating link..." : "Copy invite link for family contact"}</>
                  }
                </button>
              </div>
              <button
                onClick={() => setPreConnBannerDismissed(true)}
                className="text-teal-400/60 hover:text-teal-600 dark:hover:text-teal-300 transition-colors flex-shrink-0 mt-0.5"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Global TTS Playback Bar */}
      <TTSBar />

      {/* Wellbeing Modal — global, caregiver only */}
      <WellbeingModal
        open={wellbeingOpen}
        onClose={() => setWellbeingOpen(false)}
        triggerType={wellbeingTriggerType}
        proactiveIntro={wellbeingTriggerType === "proactive_shift_end"
          ? "Wow... it looks like things have been intense lately. I know you're pushing through — that's what you do. But I know I'd be stressed too. I just want you to know: what you do matters. And you matter. If you need to talk, I'm right here."
          : undefined
        }
      />

      {/* Tap-mode listening overlay */}
      {voiceStatus === "listening" && !hfmActive && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 py-4 bg-red-600 text-white">
          <Mic size={18} className="animate-pulse" />
          <span className="text-sm font-medium">{t("voice.tap.listening")}</span>
          <button
            onClick={handleVoiceMic}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
          >
            {t("voice.tap.cancel")}
          </button>
        </div>
      )}

      {/* HFM persistent status bar — shown when armed or triggered */}
      {hfmActive && (
        <div className={cn(
          "fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 py-2.5 text-sm transition-all",
          voiceStatus === "hfm_triggered"
            ? "bg-emerald-600 text-white"
            : "bg-sidebar/95 backdrop-blur-sm border-t border-border text-primary"
        )}>
          <span className={cn(
            "w-2 h-2 rounded-full flex-shrink-0",
            voiceStatus === "hfm_triggered" ? "bg-white animate-ping" : "bg-primary animate-pulse"
          )} />
          <span className="font-medium">
            {voiceStatus === "hfm_triggered" ? t("voice.hfm.triggered") : t("voice.hfm.armed")}
          </span>
          <button
            onClick={handleToggleHFM}
            className={cn(
              "text-xs px-3 py-1 rounded-full transition-colors ml-2",
              voiceStatus === "hfm_triggered"
                ? "bg-white/20 hover:bg-white/30"
                : "bg-primary/15 hover:bg-primary/25"
            )}
          >
            {t("voice.hfm.deactivate")}
          </button>
        </div>
      )}

      {/* Voice confirm modal + success toast */}
      <VoiceCommandModal
        confirmState={voiceConfirm}
        isSubmitting={isSubmittingVoice}
        lastConfirmed={lastConfirmed}
      />

      {/* Full-screen nav overlay */}
      <NavOverlay
        isOpen={navOverlayOpen}
        onClose={() => setNavOverlayOpen(false)}
        navItems={NAV_ITEMS.map(item => ({
          ...item,
          color: NAV_COLORS[item.path]?.color ?? "text-foreground",
          bg: NAV_COLORS[item.path]?.bg ?? "bg-muted border-border",
        }))}
        userId={activeUser.id}
        savedOrder={navOrder}
        onOrderSave={(paths) => setNavOrder(paths)}
      />

      {/* AI Help Desk — floating, always visible */}
      <HelpDesk />
    </div>
  );
}
