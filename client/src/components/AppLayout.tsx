import { useApp, type ActiveUser, isCaregiverRole, type ColorTheme } from "@/App";
import HelpDesk from "@/components/HelpDesk";
import { useLang } from "@/lib/useLang";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, clearAuthToken } from "@/lib/queryClient";
import type { Shift } from "@shared/schema";
import type { Notification } from "@shared/schema";
import {
  LayoutDashboard, LayoutGrid, Calendar, ClipboardList, MessageSquare, MessageCircleHeart,
  Image, Archive, User, Bell, Sun, Moon, ChevronDown,
  Menu, X, Users, Shield, Eye, Mic, UserPlus, Heart,
  Sparkles, Lock, StickyNote, MicOff, ClipboardSignature,
  TrendingUp, ShieldAlert, FolderOpen, MapPin,
  Timer, LogIn, LogOut, Radio, Activity, Pill, Award, BookHeart, BookOpen, SlidersHorizontal,
  NotebookPen, CalendarDays, GraduationCap, Link2, Copy, Check, Share2, Gift, Send,
  Megaphone, Globe, ChevronRight, Search, ArrowRightCircle, AlertCircle, Siren, MessageSquare, Home
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
import { NeedAMomentModal } from "@/components/NeedAMomentModal";
import DemoBanner from "@/components/DemoBanner";
import DemoApplyCTA from "@/components/DemoApplyCTA";

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
  // { path: "/wellbeing", labelKey: "nav.wellbeing", icon: MessageCircleHeart }, // DISABLED — not enough content yet
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
  const colors: Record<string, string> = {
    emergency: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
    urgent:    "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
    important: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
    normal:    "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
    // legacy color aliases
    red:    "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
    yellow: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
    green:  "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
  };
  const labels: Record<string, string> = {
    emergency: "Emergency",
    urgent: "Urgent",
    important: "Important",
    normal: "Normal",
    red: "Urgent", yellow: "Important", green: "Normal",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap", colors[priority] ?? colors.normal)}>
      {labels[priority] ?? "Normal"}
    </span>
  );
}

// ─── Timezone list (IANA, sorted US-first then globally) ─────────────────────────
// Each entry: { value: IANA string, label: friendly display name }
const TIMEZONES = [
  // ─ United States ─
  { value: "America/New_York",      label: "Eastern Time (ET)" },
  { value: "America/Chicago",       label: "Central Time (CT)" },
  { value: "America/Denver",        label: "Mountain Time (MT)" },
  { value: "America/Phoenix",       label: "Mountain Time – Arizona (no DST)" },
  { value: "America/Los_Angeles",   label: "Pacific Time (PT)" },
  { value: "America/Anchorage",     label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu",      label: "Hawaii Time (HT)" },
  // ─ Canada ─
  { value: "America/Halifax",       label: "Atlantic Time – Canada" },
  { value: "America/Toronto",       label: "Eastern Time – Toronto" },
  { value: "America/Winnipeg",      label: "Central Time – Winnipeg" },
  { value: "America/Edmonton",      label: "Mountain Time – Edmonton" },
  { value: "America/Vancouver",     label: "Pacific Time – Vancouver" },
  { value: "America/St_Johns",      label: "Newfoundland Time" },
  // ─ Latin America ─
  { value: "America/Mexico_City",   label: "Mexico City" },
  { value: "America/Bogota",        label: "Bogotá / Lima / Quito" },
  { value: "America/Sao_Paulo",     label: "São Paulo (BRT)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "America/Santiago",      label: "Santiago" },
  // ─ Europe ─
  { value: "Europe/London",         label: "London (GMT/BST)" },
  { value: "Europe/Paris",          label: "Paris / Madrid / Rome (CET)" },
  { value: "Europe/Berlin",         label: "Berlin / Amsterdam / Brussels" },
  { value: "Europe/Helsinki",       label: "Helsinki / Kyiv (EET)" },
  { value: "Europe/Moscow",         label: "Moscow (MSK)" },
  // ─ Africa ─
  { value: "Africa/Cairo",          label: "Cairo (EET)" },
  { value: "Africa/Johannesburg",   label: "Johannesburg (SAST)" },
  { value: "Africa/Lagos",          label: "Lagos / Nairobi (WAT/EAT)" },
  // ─ Middle East ─
  { value: "Asia/Dubai",            label: "Dubai / Abu Dhabi (GST)" },
  { value: "Asia/Riyadh",           label: "Riyadh / Kuwait (AST)" },
  // ─ Asia ─
  { value: "Asia/Kolkata",          label: "India (IST)" },
  { value: "Asia/Dhaka",            label: "Dhaka (BST)" },
  { value: "Asia/Bangkok",          label: "Bangkok / Jakarta (ICT)" },
  { value: "Asia/Singapore",        label: "Singapore / Kuala Lumpur (SGT)" },
  { value: "Asia/Shanghai",         label: "China / Hong Kong (CST)" },
  { value: "Asia/Tokyo",            label: "Tokyo (JST)" },
  { value: "Asia/Seoul",            label: "Seoul (KST)" },
  // ─ Oceania ─
  { value: "Australia/Sydney",      label: "Sydney / Melbourne (AEST)" },
  { value: "Australia/Brisbane",    label: "Brisbane (no DST)" },
  { value: "Australia/Adelaide",    label: "Adelaide (ACST)" },
  { value: "Australia/Perth",       label: "Perth (AWST)" },
  { value: "Pacific/Auckland",      label: "Auckland (NZST)" },
  // ─ UTC ─
  { value: "UTC",                   label: "UTC (Coordinated Universal Time)" },
] as const;

// Screenshot mode — suppresses all banners, popups, and overlays for clean CNU screenshots.
// Activated by appending ?screenshot=1 to any URL.
const SCREENSHOT_MODE = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("screenshot");

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { activeUser, setActiveUser, selectedClientId, setSelectedClientId, theme, toggleTheme, appMode, colorTheme, setColorTheme, triggerOnboarding, portalMode, isRealSession, isPreConnection, isPracticeClient, sampleClientId, isClientPortal, clientPermissionLevel, contributorWelcomeSeen, setContributorWelcomeSeen, navOverlayOpen, setNavOverlayOpen, realUserEmail, onLogout, hasMultiplePortals, activeClientName, returnToCareHome } = useApp();
  // Portal color stripe — solid color per theme for instant visual identification
  const PORTAL_COLORS: Record<string, string> = {
    teal: "#0d9488", sage: "#16a34a", slate: "#3b82f6",
    rose: "#e11d48", amber: "#d97706", client: "#059669",
  };
  const portalAccentColor = PORTAL_COLORS[colorTheme] ?? "#0d9488";
  const isDemo = realUserEmail === "cnpdemo@carenetportal.com";
  const isFamilyPortal = portalMode === "family";
  const isClientMode = portalMode === "client" || isClientPortal;
  const [showTzPicker, setShowTzPicker] = useState(false);   // timezone sub-panel
  const [tzSearch, setTzSearch] = useState("");              // search query in tz picker
  const [userTimezone, setUserTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  // navOverlayOpen lives in App context so ModuleIntro can suppress itself while nav is open

  // ── Load + save timezone from/to server (real users only) ──────────────────────
  useEffect(() => {
    if (!isRealSession) return;
    apiRequest("GET", `/api/users/${activeUser.id}`)
      .then(r => r.json())
      .then(u => { if (u?.timezone) setUserTimezone(u.timezone); })
      .catch(() => {});
  }, [activeUser.id, isRealSession]);

  function saveTimezone(tz: string) {
    setUserTimezone(tz);
    setShowTzPicker(false);
    setTzSearch("");
    if (isRealSession) {
      apiRequest("PATCH", `/api/users/${activeUser.id}`, { timezone: tz }).catch(() => {});
    }
  }

  const { t, lang, setLang } = useLang();
  const { toast } = useToast();

  // ── Referral / Invite a Friend ──────────────────────────────────────────────────────────────────────────────
  const REFERRAL_LINK = `${typeof window !== "undefined" ? window.location.origin : "https://care-net-portal-production.up.railway.app"}/#/apply`;
  // SOS Emergency Alert state
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosMessage, setSosMessage] = useState("");
  const [sosAlertCg, setSosAlertCg] = useState(true);
  const [sosSending, setSosSending] = useState(false);
  const [sosSent, setSosSent] = useState(false);

  const [referralSheetOpen, setReferralSheetOpen] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralEmail, setReferralEmail] = useState("");
  const [referralSending, setReferralSending] = useState(false);
  const [referralEmailSent, setReferralEmailSent] = useState(false);

  // Monthly referral popup — shows once per 30 days per real session user
  // Never shows within 24 hours of onboarding completion (don't interrupt new users)
  const REFERRAL_POPUP_KEY = `cnp_referral_popup_${isRealSession ? activeUser.id : "demo"}`;
  const [referralPopupOpen, setReferralPopupOpen] = useState(false);
  useEffect(() => {
    if (!isRealSession || SCREENSHOT_MODE) return;
    // Only show to family roles — never to caregivers
    if (!isFamily) return;
    // Skip if user just completed onboarding (within last 24 hours)
    if (activeUser.onboardingCompletedAt) {
      const completedAt = new Date(activeUser.onboardingCompletedAt);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (completedAt > oneDayAgo) return;
    }
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(REFERRAL_POPUP_KEY) : null;
    const lastShown = raw ? new Date(raw) : null;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (!lastShown || lastShown < thirtyDaysAgo) {
      const timer = setTimeout(() => setReferralPopupOpen(true), 4000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealSession]);

  function dismissReferralPopup() {
    setReferralPopupOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(REFERRAL_POPUP_KEY, new Date().toISOString());
    }
  }

  function copyReferralLink() {
    navigator.clipboard.writeText(REFERRAL_LINK).then(() => {
      setReferralCopied(true);
      toast({ title: "Link copied!", description: "Share it with anyone who could use this app." });
      setTimeout(() => setReferralCopied(false), 3000);
    });
  }

  async function sendReferralEmail() {
    if (!referralEmail.trim()) return;
    setReferralSending(true);
    try {
      await apiRequest("POST", "/api/invite/refer", { email: referralEmail.trim(), senderName: activeUser.name });
      setReferralEmailSent(true);
      setReferralEmail("");
      toast({ title: "Invitation sent!", description: `We sent a note to ${referralEmail.trim()}.` });
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setReferralSending(false);
    }
  }

  // ── Real portal ready modal (Option A) ───────────────────────────────────────
  // Fires once when a real client arrives while sampleClientId exists.
  const [realPortalReadyShown, setRealPortalReadyShown] = useState(false);
  const [showRealPortalModal, setShowRealPortalModal] = useState(false);
  const hasRealClientNow = !!activeUser.clientId && activeUser.clientId !== sampleClientId;

  useEffect(() => {
    if (
      !SCREENSHOT_MODE &&
      isCaregiverRole(activeUser.role) &&
      !!sampleClientId &&
      hasRealClientNow &&
      !isPracticeClient &&
      !realPortalReadyShown
    ) {
      setRealPortalReadyShown(true);
      setShowRealPortalModal(true);
    }
  }, [sampleClientId, hasRealClientNow, isPracticeClient, activeUser.role]);

  // ── Pre-connection demo banner ─────────────────────────────────────────────
  const [preConnBannerDismissed, setPreConnBannerDismissed] = useState(false);
  const [preConnInviteLink, setPreConnInviteLink] = useState("");
  const [preConnCopied, setPreConnCopied] = useState(false);
  const showPreConnBanner = isPreConnection && !preConnBannerDismissed && isCaregiverRole(activeUser.role);

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

  // ── Need a Moment state (family) ────────────────────────────────────────────
  const [needAMomentOpen, setNeedAMomentOpen] = useState(false);

  // ── Wellbeing state ──────────────────────────────────────────────────────────
  const [wellbeingOpen, setWellbeingOpen] = useState(false);
  const [proactiveNudgeDismissed, setProactiveNudgeDismissed] = useState(false);
  const [wellbeingTriggerType, setWellbeingTriggerType] = useState<"manual" | "proactive_shift_end" | "proactive_trend">("manual");

  // Phase 2 — Graduation banner dismiss mutation
  const dismissGraduationMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/users/me/contributor-welcome-seen"),
    onSuccess: () => setContributorWelcomeSeen(true),
  });

  // Check for proactive nudge (high urgency in last 72h) — caregiver roles only
  const { data: nudgeData } = useQuery<{ shouldNudge: boolean; urgentCount: number }>({
    queryKey: ["/api/wellbeing/nudge", activeUser.id, selectedClientId],
    queryFn: () => apiRequest("GET", `/api/wellbeing/nudge/${activeUser.id}/client/${selectedClientId}`).then(r => r.json()),
    enabled: isCaregiverRole(activeUser.role) && !proactiveNudgeDismissed,
    refetchInterval: 15 * 60 * 1000,
  });

  const showProactiveNudge = !!(nudgeData?.shouldNudge && !proactiveNudgeDismissed && !wellbeingOpen && isCaregiverRole(activeUser.role) && portalMode !== "family");

  function openWellbeing(type: typeof wellbeingTriggerType = "manual") {
    // COMING SOON — navigate to the coming soon page instead of opening the modal
    navigate("/wellbeing");
  }

  // ── Voice state ──────────────────────────────────────────────────────────────
  const [voiceStatus, setVoiceStatus] = useState<VoiceCommandStatus>("idle");
  const [hfmActive, setHfmActive] = useState(false);
  // "Hey CareNet" shift-only mode: if true, HFM auto-activates on clock-in and stops on clock-out
  const [hfmShiftOnly, setHfmShiftOnly] = useState(false);
  const [hfmMenuOpen, setHfmMenuOpen] = useState(false);
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

  // Auto-activate / deactivate HFM when shift-only mode is on
  useEffect(() => {
    if (!hfmShiftOnly) return;
    const onShift = !!activeShift?.clockedInAt;
    if (onShift && !hfmActive) {
      recognizerRef.current?.startHFM();
      setHfmActive(true);
    } else if (!onShift && hfmActive) {
      recognizerRef.current?.stopHFM();
      setHfmActive(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hfmShiftOnly, activeShift?.clockedInAt]);
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
  const hasEmergency = notifications.some(n => !n.isRead && n.priority === 'emergency');

  // SOS reminder check for MC — fires when they load the app after 2h
  useQuery({
    queryKey: ["/api/notifications/pending-sos-reminder", activeUser.id],
    queryFn: () => apiRequest("GET", "/api/notifications/pending-sos-reminder")
      .then(r => r.json())
      .then(d => {
        if (d.hasReminder) queryClient.invalidateQueries({ queryKey: ["/api/users", activeUser.id, "notifications"] });
        return d;
      }),
    enabled: isRealSession && activeUser.role === 'primary_family',
    refetchInterval: 30 * 60 * 1000, // check every 30 min
    staleTime: 10 * 60 * 1000,
  });
  const isPreCare = appMode === "precare";
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";
  const rawNavItems = isPreCare ? NAV_ITEMS_PRECARE : NAV_ITEMS_CAREGIVER;
  // Family never sees Thoughts or My Profile in nav
  // Family portal hides Badges and CareScope (scoring-only features)
  // Client portal nav — simplified view of their own record
  const CLIENT_NAV_ITEMS = [
    { path: "/", labelKey: "nav.dashboard" as TranslationKey, icon: LayoutDashboard },
    { path: "/schedule", labelKey: "nav.schedule" as TranslationKey, icon: CalendarDays },
    { path: "/vitals", labelKey: "nav.vitals" as TranslationKey, icon: Activity },
    { path: "/medications", labelKey: "nav.medications" as TranslationKey, icon: Pill },
    { path: "/activity", labelKey: "nav.activity" as TranslationKey, icon: NotebookPen },
    { path: "/documents", labelKey: "nav.documents" as TranslationKey, icon: FolderOpen },
  ];

  const NAV_ITEMS = (() => {
    if (isClientMode) return CLIENT_NAV_ITEMS;
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
          ) : isClientMode ? (
            // Emerald logo for client portal
            <svg aria-label="My Care Portal" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="hsl(160, 60%, 28%)"/>
              <circle cx="16" cy="13" r="5" stroke="white" strokeWidth="2" fill="none"/>
              <path d="M16 20v4M13 23h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
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
            {isClientMode ? "My Care" : isFamilyPortal ? "Family Care" : "Care Net"}
          </div>
          <div className={cn("text-xs", isPreCare ? "text-teal-400" : "text-sidebar-foreground/50")}>
            {isPreCare ? "Pre-Care Mode" : isClientMode ? "Record" : isFamilyPortal ? "Portal" : "Portal"}
          </div>
        </div>
        {isPreCare && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-medium">PRE-CARE</span>
        )}
        {isClientMode && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "hsl(160 60% 28% / 0.2)", color: "hsl(160 60% 65%)", border: "1px solid hsl(160 60% 28% / 0.3)" }}>
            {clientPermissionLevel === "contributor" ? "CONTRIBUTOR" : clientPermissionLevel === "self_care_mc" ? "SELF-CARE" : "OBSERVER"}
          </span>
        )}
        {!isClientMode && isFamilyPortal && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "hsl(345 52% 36% / 0.2)", color: "hsl(345 52% 72%)", border: "1px solid hsl(345 52% 36% / 0.3)" }}>FAMILY</span>
        )}
      </div>

      {/* Client Selector (caregiver/facilitator roles) */}
      {isCaregiverRole(activeUser.role) && (
        <div className="px-3 py-3 border-b border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/40 uppercase tracking-wider mb-2 px-2">Active Client</div>
          <div className="flex flex-col gap-1">
            {/* Real client selector — populated from activeUser.clientId (single client per CG for now) */}
            {activeUser.clientId ? (
              <button
                data-testid={`client-selector-${activeUser.clientId}`}
                onClick={() => setSelectedClientId(activeUser.clientId!)}
                className={cn("flex items-center justify-between text-xs py-2 px-3 rounded-md transition-all", "bg-sidebar-primary/20 text-sidebar-primary border border-sidebar-primary/30")}
              >
                <span>My Client</span>
              </button>
            ) : (
              <div className="text-xs text-sidebar-foreground/40 px-2">No client connected</div>
            )}
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
      {(isCaregiverRole(activeUser.role) || isFamily) && isVoiceSupported() && (
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

      {/* Invite a Friend — all real users */}
      {isRealSession && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setReferralSheetOpen(true)}
            data-testid="invite-friend-btn"
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors text-left text-xs font-medium",
              isFamilyPortal
                ? "border-sidebar-border/60 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                : "border-sidebar-border/60 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Gift size={14} className="flex-shrink-0 text-primary" />
            <span>Invite a Friend</span>
          </button>
        </div>
      )}

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
            {/* User info */}
            <div className="px-2 py-2">
              <div className="text-xs text-muted-foreground">Signed in as</div>
              <div className="text-sm font-medium text-foreground truncate">{activeUser.name}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABELS[activeUser.role]}</div>
            </div>
            <DropdownMenuSeparator />
            {/* Return to Care Home — only shown for multi-portal users */}
            {hasMultiplePortals && (
              <DropdownMenuItem
                onClick={returnToCareHome}
                className="cursor-pointer text-primary font-medium"
                data-testid="nav-care-home"
              >
                <Home size={14} className="mr-2" />
                Care Home
              </DropdownMenuItem>
            )}
            {/* Profile page — role-aware */}
            <DropdownMenuItem
              onClick={() => navigate(isFamily ? "/my-profile-family" : "/my-profile")}
              className="cursor-pointer text-muted-foreground"
              data-testid="nav-my-profile"
            >
              <User size={14} className="mr-2" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(isFamily ? "/family-pricing" : "/pricing")}
              className="cursor-pointer text-muted-foreground"
              data-testid="nav-pricing"
            >
              <Sparkles size={14} className="mr-2" />
              Pricing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                clearAuthToken();
                fetch("/api/auth/logout", { method: "POST", credentials: "include" })
                  .finally(() => { window.location.href = "/#/login"; });
              }}
              className="cursor-pointer text-red-500 dark:text-red-400"
              data-testid="sign-out-btn"
            >
              <LogOut size={14} className="mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-border">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-sidebar shadow-2xl">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Demo Banner — only visible when logged in as demo account */}
        {isDemo && !SCREENSHOT_MODE && <DemoBanner userEmail={realUserEmail} onLogout={onLogout} />}

        {/* Sample Client Banner — shown whenever a CG is in practice/sample mode */}
        {isPracticeClient && !SCREENSHOT_MODE && (
          <div className="w-full bg-amber-500 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 text-center">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white opacity-80 flex-shrink-0" />
            Sample Mode — this is a practice portal. No real data.
          </div>
        )}

        {/* Observer Banner — client portal users in read-only observer mode */}
        {isClientMode && clientPermissionLevel === "observer" && !SCREENSHOT_MODE && (
          <div
            className="w-full text-xs font-medium px-4 py-2 flex items-center justify-center gap-2 text-center"
            style={{ background: "hsl(160 60% 28% / 0.12)", color: "hsl(160 60% 28%)", borderBottom: "1px solid hsl(160 60% 28% / 0.2)" }}
          >
            <Eye size={12} className="flex-shrink-0" />
            You are viewing your own care record in read-only mode. Contact your Main Contact to request contributor access.
          </div>
        )}

        {/* Graduation Banner — first contributor login, one-time, dismissable */}
        {isClientMode && clientPermissionLevel === "contributor" && !contributorWelcomeSeen && !SCREENSHOT_MODE && (
          <div
            className="w-full px-4 py-2.5 flex items-center justify-between gap-3"
            style={{ background: "hsl(160 60% 28% / 0.14)", borderBottom: "1px solid hsl(160 60% 28% / 0.25)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={14} className="flex-shrink-0" style={{ color: "hsl(160 60% 32%)" }} />
              <span className="text-xs font-medium" style={{ color: "hsl(160 60% 28%)" }}>
                You can now add to your own care record.
              </span>
            </div>
            <button
              onClick={() => dismissGraduationMutation.mutate()}
              className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
              style={{ color: "hsl(160 60% 28%)", background: "hsl(160 60% 28% / 0.15)", border: "1px solid hsl(160 60% 28% / 0.3)" }}
              data-testid="dismiss-graduation-banner"
            >
              Got it
            </button>
          </div>
        )}

        {/* Phase 3: I Am Ready — client-initiated Transfer of Care */}
        {isClientMode && clientPermissionLevel === "contributor" && !SCREENSHOT_MODE && activeUser.clientId && (
          <IAmReadySection clientId={activeUser.clientId} clientName={activeUser.name} />
        )}

        {/* Demo floating CTA — nudges visitors to apply for real access */}
        {isDemo && !SCREENSHOT_MODE && <DemoApplyCTA />}

        {/* Top Bar */}
        <header
          className={cn(
            "flex items-center gap-1 px-2 py-2.5 border-b backdrop-blur-sm flex-shrink-0 relative",
            isFamilyPortal
              ? "bg-sidebar border-sidebar-border"
              : "bg-background/80 border-border"
          )}
          style={activeClientName && !isPreConnection && !isPracticeClient
            ? { borderTop: `3px solid ${portalAccentColor}` }
            : undefined
          }
        >
          <button
            className={cn("flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors", isFamilyPortal ? "text-sidebar-foreground hover:bg-sidebar-accent" : "hover:bg-muted text-foreground")}
            onClick={() => setNavOverlayOpen(true)}
            data-testid="nav-overlay-toggle"
            aria-label="Open navigation menu"
          >
            <LayoutGrid size={20} />
            <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">Menu</span>
          </button>

          {/* Left pill group — flex-1 so it absorbs space without pushing right icons off screen */}
          <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">

            {/* Role/client pill — caregiver roles only */}
            {isCaregiverRole(activeUser.role) && (
              <button
                onClick={() => navigate("/my-profile")}
                data-testid="role-pill-header"
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all min-w-0 flex-shrink-0",
                  isPreCare
                    ? "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border border-teal-200 dark:border-teal-800"
                    : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                )}
              >
                <Shield size={10} className="flex-shrink-0" />
                <span className="truncate max-w-[52px]">
                  {isPreCare ? "Pre-Care" : ROLE_LABELS[activeUser.role]}
                </span>
              </button>
            )}

            {/* Temp caregiver expiry badge */}
            {activeUser.role === "temp_caregiver" && activeUser.tempAccessEnd && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 text-xs border border-amber-200 dark:border-amber-900 flex-shrink-0">
                <span className="truncate max-w-[70px]">Temp {new Date(activeUser.tempAccessEnd).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
              </div>
            )}

            {/* For Me — FC (Need a Moment) — COMING SOON: dimmed, non-interactive */}
            {isFamily && (
              <div
                data-testid="for-me-btn"
                className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium bg-rose-600/10 border border-rose-600/25 text-rose-400 opacity-40 cursor-default select-none flex-shrink-0"
                title="Coming soon"
              >
                <Heart size={10} className="fill-rose-400" />
                <span>For Me</span>
              </div>
            )}

            {/* For Me — CG (Wellbeing) — COMING SOON: dimmed, navigates to coming soon page */}
            {isCaregiverRole(activeUser.role) && portalMode !== "family" && (
              <button
                onClick={() => navigate("/wellbeing")}
                data-testid="for-me-cg-btn"
                className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all bg-rose-600/10 border border-rose-600/25 text-rose-400 opacity-40 hover:opacity-60 flex-shrink-0"
                title="Coming soon"
              >
                <Heart size={10} className="fill-rose-400" />
                <span>For Me</span>
              </button>
            )}

            {/* Clock In / Out — CG top bar pill */}
            {isCaregiverRole(activeUser.role) && portalMode !== "family" && (
              activeShift ? (
                <button
                  data-testid="topbar-clock-out-btn"
                  onClick={() => clockOutMutation.mutate(activeShift.id)}
                  disabled={clockOutMutation.isPending}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 hover:text-red-300 flex-shrink-0"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                  <LogOut size={10} />
                  <span>{clockOutMutation.isPending ? "Out..." : formatElapsed(shiftElapsed)}</span>
                </button>
              ) : (
                <button
                  data-testid="topbar-clock-in-btn"
                  onClick={() => clockInMutation.mutate()}
                  disabled={clockInMutation.isPending}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-500 hover:text-emerald-400 flex-shrink-0"
                >
                  <LogIn size={10} />
                  <span>{clockInMutation.isPending ? "In..." : "Clock In"}</span>
                </button>
              )
            )}

          </div> {/* end left pill group */}

          {/* Active portal name pill — clickable, goes to Care Home */}
          {activeClientName && !isPreConnection && !isPracticeClient && (
            <div className="flex-1 flex justify-center items-center">
              {hasMultiplePortals ? (
                <button
                  onClick={returnToCareHome}
                  data-testid="active-portal-name"
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-1 rounded-full border-2 truncate max-w-[200px] bg-white dark:bg-zinc-900 shadow-sm transition-opacity hover:opacity-80 active:opacity-60"
                  style={{ color: portalAccentColor, borderColor: portalAccentColor }}
                  title="Return to Care Home"
                >
                  <Home size={13} className="flex-shrink-0" style={{ color: portalAccentColor }} />
                  {activeClientName}
                </button>
              ) : (
                <span
                  data-testid="active-portal-name"
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-1 rounded-full border-2 truncate max-w-[200px] bg-white dark:bg-zinc-900 shadow-sm"
                  style={{ color: portalAccentColor, borderColor: portalAccentColor }}
                >
                  <Home size={13} className="flex-shrink-0" style={{ color: portalAccentColor }} />
                  {activeClientName}
                </span>
              )}
            </div>
          )}

          {/* Voice Controls — Hey CareNet — disabled during beta, icon only on mobile */}
          {isVoiceSupported() && (isCaregiverRole(activeUser.role) || isFamily) && (
            <div className="flex-shrink-0 flex items-center" title="Coming soon">
              <div className="relative flex items-center opacity-30 cursor-not-allowed">
                <div
                  data-testid="hfm-toggle-button"
                  aria-label="Hey CareNet — coming soon"
                  className="relative flex items-center justify-center w-7 h-7 rounded-full border bg-muted/60 text-muted-foreground border-border"
                >
                  <Megaphone size={14} />
                </div>
              </div>
            </div>
          )}



          {/* SOS Button — CG and MC only, real sessions, not demo */}
          {isRealSession && (isCaregiverRole(activeUser.role) || activeUser.role === 'primary_family') && selectedClientId && (
            <button
              onClick={() => { setSosSent(false); setSosMessage(""); setSosAlertCg(true); setSosModalOpen(true); }}
              data-testid="sos-btn"
              aria-label="Emergency Alert"
              className="flex-shrink-0 p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              title="Send Emergency Alert"
            >
              <Siren size={18} />
            </button>
          )}

          {/* Notification Bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn("relative flex-shrink-0 p-1.5 rounded-lg transition-colors",
                  hasEmergency ? "text-red-600 dark:text-red-400" : isFamilyPortal ? "text-sidebar-foreground hover:bg-sidebar-accent" : "hover:bg-muted"
                )}
                data-testid="notifications-bell"
              >
                <Bell size={18} className={hasEmergency ? "animate-pulse" : ""} />
                {unreadCount > 0 && (
                  <span className={cn(
                    "absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[10px] rounded-full flex items-center justify-center font-bold",
                    hasEmergency ? "bg-red-600 animate-pulse" : "bg-red-500"
                  )}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-[0_8px_30px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] rounded-xl p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => apiRequest("PATCH", `/api/users/${activeUser.id}/notifications/read-all`).then(() => queryClient.invalidateQueries({ queryKey: ["/api/users", activeUser.id, "notifications"] }))}
                    className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    data-testid="mark-all-read-btn"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">No notifications</div>
              ) : notifications.slice(0, 8).map(n => (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(
                    "flex flex-col items-start gap-1.5 px-4 py-3 cursor-pointer rounded-none border-b border-zinc-100 dark:border-zinc-800 last:border-0 focus:bg-zinc-50 dark:focus:bg-zinc-800/50",
                    n.priority === 'emergency' && "bg-red-50 dark:bg-red-950/20 border-l-[3px] border-l-red-500 pl-3.5",
                    n.priority === 'urgent' && !n.isRead && "bg-amber-50/60 dark:bg-amber-950/10",
                    !n.isRead && n.priority !== 'emergency' && n.priority !== 'urgent' && "bg-zinc-50/80 dark:bg-zinc-800/30"
                  )}
                  onClick={() => {
                    if (!n.isRead) apiRequest("PATCH", `/api/notifications/${n.id}/read`).then(() => queryClient.invalidateQueries({ queryKey: ["/api/users", activeUser.id, "notifications"] }));
                    if (n.linkTo) navigate(n.linkTo);
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <PriorityBadge priority={n.priority || "normal"} />
                    {!n.isRead && <span className="ml-auto w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <span className={cn("text-sm font-medium text-zinc-800 dark:text-zinc-100", n.priority === 'emergency' && "text-red-700 dark:text-red-300")}>{n.title}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{n.body}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ── Avatar dropdown — prefs + profile + sign out ── */}
          <div className="flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="user-menu-mobile"
                  aria-label="User menu"
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors",
                    isFamilyPortal
                      ? "bg-sidebar-primary/30 text-sidebar-primary hover:bg-sidebar-primary/40"
                      : "bg-primary/20 text-primary hover:bg-primary/30"
                  )}
                >
                  {activeUser.avatarInitials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={cn("bg-white dark:bg-zinc-900 border border-border shadow-2xl", showTzPicker ? "w-72" : "w-64")}>
                {/* User identity */}
                <div className="px-2 py-2">
                  <div className="text-xs text-muted-foreground">Signed in as</div>
                  <div className="text-sm font-medium text-foreground truncate">{activeUser.name}</div>
                  <div className="text-xs text-muted-foreground">{ROLE_LABELS[activeUser.role]}</div>
                </div>
                <DropdownMenuSeparator />
                {/* Profile + Pricing */}
                <DropdownMenuItem onClick={() => navigate(isFamily ? "/my-profile-family" : "/my-profile")} className="cursor-pointer text-muted-foreground" data-testid="nav-my-profile-mobile">
                  <User size={14} className="mr-2" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(isFamily ? "/family-pricing" : "/pricing")} className="cursor-pointer text-muted-foreground" data-testid="nav-pricing-mobile">
                  <Sparkles size={14} className="mr-2" />
                  Pricing
                </DropdownMenuItem>
                {/* Invite */}
                {isRealSession && (
                  <DropdownMenuItem onClick={() => setReferralSheetOpen(true)} className="cursor-pointer text-muted-foreground" data-testid="nav-invite-avatar">
                    <Gift size={14} className="mr-2" />
                    Invite a Friend
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {/* Preferences */}
                <DropdownMenuItem
                  onClick={toggleTheme}
                  className="cursor-pointer text-muted-foreground"
                  data-testid="theme-toggle"
                >
                  {theme === "dark" ? <Sun size={14} className="mr-2" /> : <Moon size={14} className="mr-2" />}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLang(lang === "en" ? "es" : "en")}
                  className="cursor-pointer text-muted-foreground"
                  data-testid="lang-toggle"
                >
                  <span className="mr-2 text-sm leading-none">🌐</span>
                  {lang === "en" ? "Español" : "English"}
                </DropdownMenuItem>
                {/* Timezone — inline sub-panel */}
                <DropdownMenuItem
                  onClick={e => { e.preventDefault(); setShowTzPicker(p => !p); }}
                  className="cursor-pointer text-muted-foreground"
                  data-testid="tz-toggle"
                >
                  <Globe size={14} className="mr-2" />
                  <span className="flex-1">Time Zone</span>
                  <span className="text-xs text-muted-foreground mr-1">
                    {(() => {
                      const found = TIMEZONES.find(z => z.value === userTimezone);
                      if (found) { const m = found.label.match(/\(([^)]+)\)/); return m ? m[1] : found.label.split(" ")[0]; }
                      return userTimezone.split("/").pop()?.replace("_", " ") ?? "";
                    })()}
                  </span>
                  <ChevronRight size={13} className={cn("transition-transform", showTzPicker && "rotate-90")} />
                </DropdownMenuItem>
                {showTzPicker && (
                  <div className="mx-2 mb-1 rounded-lg border border-border bg-background overflow-hidden">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
                      <Search size={12} className="text-muted-foreground flex-shrink-0" />
                      <input
                        type="text"
                        placeholder="Search timezones…"
                        value={tzSearch}
                        onChange={e => setTzSearch(e.target.value)}
                        className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground min-w-0"
                        autoFocus
                        data-testid="tz-search"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {TIMEZONES.filter(tz => !tzSearch || tz.label.toLowerCase().includes(tzSearch.toLowerCase()) || tz.value.toLowerCase().includes(tzSearch.toLowerCase())).map(tz => (
                        <button
                          key={tz.value}
                          onClick={() => { saveTimezone(tz.value); setShowTzPicker(false); setTzSearch(""); }}
                          className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2", userTimezone === tz.value && "bg-accent font-medium")}
                          data-testid={`tz-option-${tz.value}`}
                        >
                          {userTimezone === tz.value && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                          <span className={userTimezone === tz.value ? "" : "ml-3.5"}>{tz.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    clearAuthToken();
                    fetch("/api/auth/logout", { method: "POST", credentials: "include" })
                      .finally(() => { window.location.replace("/#/login"); });
                  }}
                  className="cursor-pointer text-red-500 dark:text-red-400"
                  data-testid="sign-out-mobile"
                >
                  <LogOut size={14} className="mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-28" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}>
          {/* BETA: prompt banners suspended — restore post-beta, redesign thinner + less frequent */}
          {/* <DailyNudge /> */}
          {/* Proactive wellbeing nudge banner */}
          {/* {showProactiveNudge && (
            <ProactiveNudgeBanner
              onOpen={() => { setProactiveNudgeDismissed(true); openWellbeing("proactive_shift_end"); }}
              onDismiss={() => setProactiveNudgeDismissed(true)}
            />
          )} */}
          {/* Pre-connection demo mode banner */}
          {showPreConnBanner && !SCREENSHOT_MODE && (
            <div className="mx-4 mt-4 rounded-xl border border-teal-400/40 bg-teal-50 dark:bg-teal-950/40 px-4 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <GraduationCap size={15} className="text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-teal-800 dark:text-teal-200 text-sm font-semibold leading-tight">You're exploring in demo mode</p>
                <p className="text-teal-700/80 dark:text-teal-400/80 text-xs mt-1 leading-relaxed">
                  This is sample data so you can try everything out. Your real portal activates the moment a family contact signs up and connects with you.
                </p>
                <p className="text-teal-700/80 dark:text-teal-400/80 text-xs mt-1 leading-relaxed font-medium">
                  Ready to go live? Send your family contact the invite link below — it takes them straight to signup.
                </p>
                <button
                  onClick={handlePreConnInvite}
                  disabled={preConnInviteMutation.isPending}
                  className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-full transition-colors"
                >
                  {preConnCopied
                    ? <><Check size={12} /> Invite link copied — send it now!</>  
                    : <><Link2 size={12} /> {preConnInviteMutation.isPending ? "Generating link..." : "Copy family invite link"}</>
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
      />

      {/* Real Portal Ready modal — fires once when real client connects while sample exists */}
      {showRealPortalModal && !SCREENSHOT_MODE && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRealPortalModal(false)} />
          <div className="relative w-full max-w-sm bg-background rounded-2xl border border-border shadow-2xl p-6 space-y-4 z-10">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center mx-auto">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="font-semibold text-foreground text-base">A real client is connected.</p>
              <p className="text-sm text-muted-foreground">
                Your Sample Portal is saved and ready whenever you need it — use it to showcase your skills to future families.
              </p>
            </div>
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => setShowRealPortalModal(false)}
              data-testid="real-portal-ready-ok-btn"
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      {/* Need a Moment — family roles only, controlled from top bar */}
      <NeedAMomentModal open={needAMomentOpen} onClose={() => setNeedAMomentOpen(false)} />

      {/* For Me (CG) moved to top bar — floating button removed */}

      {/* AI Help Desk — floating, always visible */}
      <HelpDesk hfmActive={hfmActive} />

      {/* ── Invite a Friend sheet ── */}
      {/* ── SOS Emergency Alert Modal ───────────────────────────────────────── */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" data-testid="sos-modal">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !sosSending && setSosModalOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl border border-red-200 dark:border-red-800 shadow-2xl p-6 z-10">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 sm:hidden" />
            {sosSent ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto">
                  <Siren size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Alert Sent</p>
                  <p className="text-sm text-muted-foreground mt-1">Your care team has been notified. A record of this alert has been logged.</p>
                </div>
                <button
                  onClick={() => setSosModalOpen(false)}
                  className="mt-2 px-6 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
                  data-testid="sos-close-btn"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <Siren size={18} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-foreground">Emergency Alert</h2>
                    <p className="text-xs text-muted-foreground">This will immediately notify your care team</p>
                  </div>
                  <button onClick={() => setSosModalOpen(false)} className="text-muted-foreground hover:text-foreground p-1" data-testid="sos-modal-close">
                    <X size={16} />
                  </button>
                </div>

                {/* Message */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Message (optional)</label>
                  <textarea
                    value={sosMessage}
                    onChange={e => setSosMessage(e.target.value)}
                    placeholder="Emergency — immediate attention needed"
                    rows={2}
                    className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-red-400"
                    data-testid="sos-message-input"
                  />
                </div>

                {/* MC only: alert CG toggle */}
                {activeUser.role === 'primary_family' && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3 mb-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Also send SMS to caregiver</p>
                        <p className="text-xs text-muted-foreground">Your caregiver will always see an in-app alert</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSosAlertCg(v => !v)}
                      className={cn(
                        "relative w-11 h-6 rounded-full transition-colors flex-shrink-0",
                        sosAlertCg ? "bg-teal-600" : "bg-zinc-300 dark:bg-zinc-600"
                      )}
                      data-testid="sos-alert-cg-toggle"
                    >
                      <span className={cn(
                        "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                        sosAlertCg ? "translate-x-5" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                )}

                {/* CG info: MC always gets notified */}
                {isCaregiverRole(activeUser.role) && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border px-3 py-2.5 mb-4">
                    <AlertCircle size={14} className="text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">Main Contact will be notified immediately</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setSosModalOpen(false)}
                    className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                    data-testid="sos-cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={sosSending}
                    onClick={async () => {
                      if (!selectedClientId) return;
                      setSosSending(true);
                      try {
                        await apiRequest("POST", `/api/clients/${selectedClientId}/sos`, {
                          message: sosMessage.trim() || "Emergency — immediate attention needed",
                          smsToMc: true,
                          smsToCg: activeUser.role === 'primary_family' ? sosAlertCg : false,
                        });
                        queryClient.invalidateQueries({ queryKey: ["/api/users", activeUser.id, "notifications"] });
                        setSosSent(true);
                      } catch {
                        toast({ title: "Could not send alert", variant: "destructive" });
                      } finally {
                        setSosSending(false);
                      }
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    data-testid="sos-send-btn"
                  >
                    {sosSending ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Siren size={14} />}
                    Send Alert
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {referralSheetOpen && !SCREENSHOT_MODE && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setReferralSheetOpen(false); setReferralEmailSent(false); setReferralEmail(""); }} />
          <div className="relative w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl p-6 z-10">
            {/* Handle */}
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 sm:hidden" />

            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Gift size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Invite a Friend</h2>
                <p className="text-xs text-muted-foreground">Know someone who could use this app?</p>
              </div>
              <button onClick={() => { setReferralSheetOpen(false); setReferralEmailSent(false); setReferralEmail(""); }} className="ml-auto text-muted-foreground hover:text-foreground p-1">
                <X size={16} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mt-3 mb-5">
              Families going through a care situation often feel alone. If you know someone who could use a tool like this, send them a link.
            </p>

            {/* Copy link */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 text-xs bg-muted rounded-lg px-3 py-2.5 font-mono text-muted-foreground truncate">{REFERRAL_LINK}</div>
              <button
                onClick={copyReferralLink}
                className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0",
                  referralCopied ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {referralCopied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy link</>}
              </button>
            </div>

            <div className="relative flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or send by email</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {referralEmailSent ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-lg px-4 py-3">
                <Check size={15} /> Invitation sent! They’ll get a personal note from you.
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={referralEmail}
                  onChange={e => setReferralEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendReferralEmail()}
                  placeholder="friend@example.com"
                  className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={sendReferralEmail}
                  disabled={referralSending || !referralEmail.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  {referralSending ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending…</> : <><Send size={13} /> Send</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Monthly referral popup ── */}
      {referralPopupOpen && !SCREENSHOT_MODE && isFamily && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismissReferralPopup} />
          <div className="relative w-full max-w-sm bg-background rounded-2xl border border-border shadow-2xl p-6 z-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Heart size={24} className="text-primary fill-primary/30" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">We're glad your family is here.</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Do you know someone else going through a similar situation? A neighbor, co-worker, or friend who could use a tool like this for their family?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => { dismissReferralPopup(); setReferralSheetOpen(true); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Gift size={15} /> Invite a Friend
              </button>
              <button
                onClick={dismissReferralPopup}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Fixed Bottom Nav */}
        <nav
          className={cn(
            "fixed bottom-0 left-0 right-0 z-[60] flex items-stretch flex-shrink-0 border-t",
            isFamilyPortal
              ? "bg-sidebar border-sidebar-border"
              : "bg-background border-border"
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {([
            { label: "Dashboard", path: "/" },
            { label: "Care Log",  path: "/activity" },
            { label: "Schedule", path: "/schedule" },
            { label: "Messages", path: "/messages" },
          ] as const).map(({ label, path }) => {
            const active = location === path || (path !== "/" && location.startsWith(path));
            const accent = isFamilyPortal ? "rose" : "teal";
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "flex-1 py-2 text-[11px] font-bold tracking-wide transition-colors relative",
                  active
                    ? accent === "rose"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-teal-600 dark:text-teal-400"
                    : isFamilyPortal
                      ? "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
                {active && (
                  <span className={cn(
                    "absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full",
                    accent === "rose" ? "bg-rose-500" : "bg-teal-500"
                  )} />
                )}
              </button>
            );
          })}
        </nav>
    </div>
  );
}

// ── Phase 3: I Am Ready — client-initiated Transfer of Care ──────────────────
function IAmReadySection({ clientId, clientName }: { clientId: number; clientName: string }) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [dialogStep, setDialogStep] = useState<1 | 2 | 3>(1);
  const [chosenRole, setChosenRole] = useState<'monitor' | 'step_back' | 'remove' | null>(null);

  const { data: transferStatus, refetch: refetchTransfer } = useQuery<{
    step: number; initiatedBy: string | null; offeredAt: string | null;
    step2At: string | null; mcCoConfirmed: boolean; cancelledAt: string | null; confirmedAt: string | null;
  }>({
    queryKey: ["/api/clients", clientId, "transfer-status"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/transfer-status`).then(r => r.json()),
  });

  const initiateClientTransfer = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${clientId}/transfer/initiate`, {}),
    onSuccess: () => {
      refetchTransfer();
      setShowDialog(false);
      toast({ title: "Step 1 complete", description: "Your care team has been notified. Come back tomorrow to continue." });
    },
    onError: (err: any) => {
      toast({ title: "Could not start transfer", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const advanceTransfer = useMutation({
    mutationFn: (mcPostTransferRole: string) =>
      apiRequest("POST", `/api/clients/${clientId}/transfer/advance`, { mcPostTransferRole }).then(r => r.json()),
    onSuccess: (data: any) => {
      refetchTransfer();
      if (data?.completed) {
        setShowDialog(false);
        toast({ title: "Transfer of Care complete", description: "You are now the primary authority on your care portal." });
      } else if (data?.step === 2) {
        setShowDialog(false);
        toast({ title: "Step 2 complete", description: "One final confirmation tomorrow and the transfer is done." });
      }
    },
    onError: (err: any) => {
      const hoursRemaining = err?.hoursRemaining;
      const msg = hoursRemaining
        ? `Come back in ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'} to continue.`
        : err?.message || "Please try again.";
      toast({ title: "Not yet", description: msg, variant: "destructive" });
    },
  });

  const cancelTransfer = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${clientId}/transfer/cancel`, {}),
    onSuccess: () => {
      refetchTransfer();
      setShowDialog(false);
      toast({ title: "Transfer cancelled", description: "Everything remains as it is. No pressure." });
    },
  });

  const step = transferStatus?.step ?? 0;
  const isMyTransfer = step > 0 && transferStatus?.initiatedBy === 'client';
  const isMCOffer = step > 0 && transferStatus?.initiatedBy === 'mc';
  const mcCoConfirmed = transferStatus?.mcCoConfirmed ?? false;

  const roleOptions = [
    { value: 'monitor' as const, label: 'Continue monitoring', desc: 'They can see your record but cannot make changes.' },
    { value: 'step_back' as const, label: 'Step back to family member', desc: 'They stay on the portal with a limited role.' },
    { value: 'remove' as const, label: 'Remove from portal', desc: 'They will no longer have access.' },
  ];

  // MC-initiated offer: show accept banner + dialog
  if (isMCOffer) {
    return (
      <>
        <div
          className="w-full px-4 py-2.5 flex items-center justify-between gap-3"
          style={{ background: "hsl(160 60% 28% / 0.1)", borderBottom: "1px solid hsl(160 60% 28% / 0.2)" }}
          data-testid="mc-offer-banner"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={13} className="flex-shrink-0" style={{ color: "hsl(160 60% 32%)" }} />
            <span className="text-xs font-medium" style={{ color: "hsl(160 60% 28%)" }}>
              Your Main Contact says you are ready to own your care portal.
            </span>
          </div>
          <button
            className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
            style={{ color: "hsl(160 60% 28%)", background: "hsl(160 60% 28% / 0.15)", border: "1px solid hsl(160 60% 28% / 0.3)" }}
            onClick={() => { setShowDialog(true); setDialogStep(2); setChosenRole(null); }}
            data-testid="review-mc-offer-btn"
          >
            Review offer
          </button>
        </div>

        {showDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="iam-ready-dialog">
            <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
              <div className="space-y-2">
                <div className="text-base font-semibold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>You Are Invited</div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Your Main Contact believes you are ready to take full ownership of your care portal. This is your choice.
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Choose how your Main Contact stays involved going forward:
                </div>
              </div>
              <div className="space-y-2">
                {roleOptions.map(opt => (
                  <button
                    key={opt.value}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                      chosenRole === opt.value
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                        : 'border-border hover:bg-muted/40'
                    }`}
                    onClick={() => setChosenRole(opt.value)}
                    data-testid={`role-option-${opt.value}`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDialog(false)}>Not now</Button>
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  disabled={!chosenRole || advanceTransfer.isPending}
                  onClick={() => chosenRole && advanceTransfer.mutate(chosenRole)}
                  data-testid="accept-mc-offer-btn"
                >
                  <ArrowRightCircle size={14} /> Accept
                </Button>
              </div>
              <button
                className="text-xs text-muted-foreground w-full text-center hover:text-destructive transition-colors"
                onClick={() => cancelTransfer.mutate()}
                data-testid="decline-mc-offer-btn"
              >
                Decline this offer
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Client-initiated in progress
  if (isMyTransfer) {
    const canContinue = mcCoConfirmed || (() => {
      const base = step === 1
        ? (transferStatus?.step2At ? 0 : (new Date(transferStatus?.offeredAt ?? 0).getTime()))
        : new Date(transferStatus?.step2At ?? 0).getTime();
      return (Date.now() - base) >= 24 * 60 * 60 * 1000;
    })();

    return (
      <>
        <div
          className="w-full px-4 py-2.5 flex items-center justify-between gap-3"
          style={{ background: "hsl(160 60% 28% / 0.1)", borderBottom: "1px solid hsl(160 60% 28% / 0.2)" }}
          data-testid="iam-ready-in-progress-banner"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ArrowRightCircle size={13} className="flex-shrink-0" style={{ color: "hsl(160 60% 32%)" }} />
            <span className="text-xs font-medium" style={{ color: "hsl(160 60% 28%)" }}>
              Transfer of Care in progress — step {step} of 3
              {mcCoConfirmed ? " — your Main Contact agrees. You can complete now." : step < 3 ? " — come back tomorrow to continue." : ""}
            </span>
          </div>
          <button
            className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
            style={{ color: "hsl(160 60% 28%)", background: "hsl(160 60% 28% / 0.15)", border: "1px solid hsl(160 60% 28% / 0.3)" }}
            onClick={() => { setShowDialog(true); setDialogStep(step === 1 ? 2 : 3); setChosenRole(null); }}
            data-testid="continue-transfer-btn"
          >
            {canContinue ? "Continue" : "View"}
          </button>
        </div>

        {showDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="iam-ready-dialog">
            <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">

              {dialogStep === 2 && (
                <>
                  <div className="space-y-2">
                    <div className="text-base font-semibold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Still sure?</div>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      This is your second confirmation. A day has passed. Taking ownership of your care record means your Main Contact steps into a new role.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDialog(false)}>Not yet</Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                      disabled={advanceTransfer.isPending}
                      onClick={() => advanceTransfer.mutate('monitor')}
                      data-testid="client-transfer-step2-btn"
                    >
                      <ChevronRight size={14} /> Yes, continue
                    </Button>
                  </div>
                  <button
                    className="text-xs text-muted-foreground w-full text-center hover:text-destructive transition-colors pt-1"
                    onClick={() => cancelTransfer.mutate()}
                  >
                    Cancel the transfer
                  </button>
                </>
              )}

              {dialogStep === 3 && (
                <>
                  <div className="space-y-2">
                    <div className="text-base font-semibold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Final step</div>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      This is your last confirmation. Choose how your Main Contact stays involved after the transfer:
                    </div>
                  </div>
                  <div className="space-y-2">
                    {roleOptions.map(opt => (
                      <button
                        key={opt.value}
                        className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                          chosenRole === opt.value
                            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                            : 'border-border hover:bg-muted/40'
                        }`}
                        onClick={() => setChosenRole(opt.value)}
                        data-testid={`final-role-option-${opt.value}`}
                      >
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDialog(false)}>Not yet</Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                      disabled={!chosenRole || advanceTransfer.isPending}
                      onClick={() => chosenRole && advanceTransfer.mutate(chosenRole)}
                      data-testid="client-transfer-final-btn"
                    >
                      <ArrowRightCircle size={14} /> Complete transfer
                    </Button>
                  </div>
                  <button
                    className="text-xs text-muted-foreground w-full text-center hover:text-destructive transition-colors pt-1"
                    onClick={() => cancelTransfer.mutate()}
                  >
                    Cancel the transfer
                  </button>
                </>
              )}

            </div>
          </div>
        )}
      </>
    );
  }

  // No transfer in progress: just the dialog trigger (no persistent banner — not intrusive)
  return (
    <>
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="iam-ready-dialog">
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="space-y-2">
              <div className="text-base font-semibold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>I Am Ready</div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                This begins your Transfer of Care — the process of taking full ownership of your care portal.
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                It is a three-step journey over two days. This gives you time to be certain. Your care team will be notified at each step and can cancel at any point before you finalize.
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-1">
                You can cancel at any time before the final step. No judgment, no explanation required.
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDialog(false)}>Not yet</Button>
              <Button
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                disabled={initiateClientTransfer.isPending}
                onClick={() => initiateClientTransfer.mutate()}
                data-testid="iam-ready-confirm-btn"
              >
                <ArrowRightCircle size={14} /> Begin
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

