/**
 * ModuleIntro — "How this works" first-visit intro card.
 *
 * Shows automatically the first time a user visits a module.
 * Plays Becky's voice. Dismisses on "Got it" or after audio ends.
 * Never shows again for that user + module combination.
 *
 * Usage in any page:
 *   <ModuleIntro moduleKey="schedule" />
 *
 * The component handles all state — seenModules persisted server-side for
 * real users, localStorage fallback for demo mode.
 */

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useApp, isCaregiverRole } from "@/App";
import { speakBecky, stopBecky } from "@/lib/ttsUtils";
import { cn } from "@/lib/utils";
import { X, Volume2, VolumeX, ChevronRight, Sparkles } from "lucide-react";
import type { User } from "@shared/schema";

// ── Module definitions ────────────────────────────────────────────────────────

export type ModuleKey =
  | "schedule"
  | "care-log"
  | "messages"
  | "vitals"
  | "medications"
  | "media"
  | "archive"
  | "badges"
  | "care-scope"
  | "documents"
  | "outings"
  | "thoughts"
  | "patterns"
  | "client-portal"
  | "wellbeing";

interface ModuleCopy {
  title: string;
  /** Role-aware body text. If omitted, `body` is used for all roles. */
  body: string;
  familyBody?: string;
  /** Becky's spoken line — short, warm, natural. */
  beckyScript: string;
  familyBeckyScript?: string;
}

const MODULE_COPY: Record<ModuleKey, ModuleCopy> = {
  schedule: {
    title: "Schedule",
    body: "This is where all shifts live — clock in, log tasks, and track time. Yellow flags appear when something falls outside expected timing.",
    familyBody: "See every scheduled shift and appointment at a glance. You'll know exactly when the caregiver is on duty and what's planned.",
    beckyScript: "This is the Schedule — your home base for every shift. You can clock in, track tasks, and see the full picture of care at any time.",
    familyBeckyScript: "This is the Schedule. You can see every shift and appointment for your loved one right here — always up to date.",
  },
  "care-log": {
    title: "Care Log",
    body: "Log what happened during each shift — tasks completed, observations, anything worth noting. These entries build the full care record over time.",
    familyBody: "Read what the caregiver logged during each visit — tasks, observations, and anything notable. This is the real-time story of your loved one's care.",
    beckyScript: "This is the Care Log. Every entry here becomes part of a permanent care record — honest, timestamped, and visible to the whole care team.",
    familyBeckyScript: "This is the Care Log. Your caregiver writes here after every visit so you always know what happened, even when you weren't there.",
  },
  messages: {
    title: "Messages",
    body: "Secure messaging for the whole care circle. Priority labels — Normal, Important, or Urgent — help the right people respond quickly.",
    familyBody: "One place for all care communication. No more scattered group texts — everyone on the care team sees the same thread.",
    beckyScript: "This is Messages — secure, organized, and shared with everyone in the care circle. Use priority labels so the right message gets the right attention.",
    familyBeckyScript: "This is Messages — one secure inbox for your whole care circle. No more group texts. Everyone stays on the same page.",
  },
  vitals: {
    title: "Vitals",
    body: "Log blood pressure, heart rate, temperature, oxygen, weight, and blood sugar. Trends and pattern alerts live here too.",
    familyBody: "See logged vitals — blood pressure, heart rate, and more. The caregiver tracks these during visits so you can spot trends over time.",
    beckyScript: "This is Vitals. Log readings after each check — blood pressure, heart rate, oxygen, and more. The system flags anything that looks unusual.",
    familyBeckyScript: "This is Vitals. Your loved one's readings are logged here after every check so you can follow their health trends over time.",
  },
  medications: {
    title: "Medications",
    body: "Full medication list organized by Morning, Afternoon, and Evening. Log each dose in the Admin Log tab to build a complete administration record.",
    familyBody: "See every medication organized by time of day. You can view the schedule and check what's been administered.",
    beckyScript: "This is Medications. Every medication is listed by time of day, and the Admin Log keeps a record of every dose that's been given.",
    familyBeckyScript: "This is Medications. You can see every medication by time of day and follow what's been administered.",
  },
  media: {
    title: "Media",
    body: "Share photos and videos with the care circle — moments from daily life, updates, or anything worth seeing.",
    familyBody: "Photos and videos shared by the caregiver during care. A running visual record of your loved one's days.",
    beckyScript: "This is Media — a shared album for the whole care circle. I love adding little moments here so families can feel connected.",
    familyBeckyScript: "This is Media. Your caregiver can share photos and videos here so you can see the moments from your loved one's day.",
  },
  archive: {
    title: "Archive",
    body: "AI-generated monthly summaries of care activity. Everything — logs, vitals, messages — distilled into a clear, readable record. Unlocks after 7 days of care.",
    familyBody: "Monthly AI summaries of care activity — everything distilled into a clear, readable report. Perfect for doctor visits or keeping extended family informed.",
    beckyScript: "This is the Archive. Each month, the AI builds a summary of everything — logs, vitals, messages — so you have a complete record without the manual work.",
    familyBeckyScript: "This is the Archive. Monthly summaries of all care activity, written by AI, so you can share a clear picture with your family or bring it to a doctor's visit.",
  },
  badges: {
    title: "Badges",
    body: "Your performance record — built from real activity data, not self-reported. Communication, Dependability, Knowledge, and Connection. Yellow flags and red flags are tracked here.",
    beckyScript: "This is your Badges page. Your score reflects actual care data — consistency, communication, and reliability. It's your professional reputation, built honestly.",
  },
  "care-scope": {
    title: "Care Scope",
    body: "Define what this care relationship covers — which tasks, which responsibilities, which are off-limits. Sets clear expectations on both sides.",
    familyBody: "See what's included in your care arrangement — tasks, responsibilities, and scope of service. Clear expectations for everyone.",
    beckyScript: "This is Care Scope. It's how we set clear expectations from day one — what I do, what falls outside my role, and what both sides have agreed to.",
    familyBeckyScript: "This is Care Scope — the agreed-upon scope of care for your loved one. Everyone knows what's included and what isn't.",
  },
  documents: {
    title: "Documents",
    body: "Store and share care-related documents — authorizations, care plans, medical instructions, insurance info.",
    familyBody: "Access shared documents — care plans, authorizations, and any important paperwork related to your loved one's care.",
    beckyScript: "This is Documents — a secure place for care plans, authorizations, and any paperwork the whole team needs to access.",
    familyBeckyScript: "This is Documents. Important paperwork — care plans, authorizations, medical instructions — all in one secure place.",
  },
  outings: {
    title: "Outings",
    body: "Log and plan outings with your client — destinations, timing, and any notes. Keeps family informed and builds a record of activities.",
    familyBody: "See planned and completed outings with your loved one — where they went, when, and any notes from the caregiver.",
    beckyScript: "This is Outings. Any time I take my client out — a walk, a doctor's appointment, an errand — I log it here so the family always knows.",
    familyBeckyScript: "This is Outings. Every trip your loved one takes with the caregiver is logged here — where, when, and how it went.",
  },
  thoughts: {
    title: "Collection of Thoughts",
    body: "A private journal for caregivers. Reflections, personal notes, things worth remembering. Visible only to you.",
    beckyScript: "This is your Collection of Thoughts — a private space just for you. Sometimes caregiving is heavy, and having a place to write helps.",
  },
  patterns: {
    title: "Wellness Trends",
    body: "Charts and correlations built from vitals and care log data over time. Spot patterns before they become problems. Unlocks after 30 days of data.",
    familyBody: "Visual trends built from logged vitals and care data over time. A clear picture of how your loved one's health is changing.",
    beckyScript: "This is Wellness Trends. Over time, the app surfaces patterns in vitals and care data — the kind of thing that's easy to miss day-to-day.",
    familyBeckyScript: "This is Wellness Trends. As data builds up, the app shows health patterns over time — helpful for spotting changes and sharing with a doctor.",
  },
  "client-portal": {
    title: "Client Portal",
    body: "Full profile for the person in your care — background, preferences, medical history, emergency contacts, and care instructions.",
    familyBody: "The full profile for your loved one — medical history, preferences, emergency contacts, and care instructions all in one place.",
    beckyScript: "This is the Client Portal — everything about the person in my care. Their history, preferences, medical details, and who to call in an emergency.",
    familyBeckyScript: "This is the Client Portal — your loved one's full profile. Medical history, care preferences, and emergency contacts, all organized and accessible.",
  },
  wellbeing: {
    title: "Wellbeing",
    body: "A private check-in for caregivers. When you need a moment, this is the place. Your responses are anonymous and confidential.",
    beckyScript: "This is Wellbeing — a quiet corner just for you. Caregiving is hard, and this is a safe place to check in with yourself.",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ModuleIntroProps {
  moduleKey: ModuleKey;
  /** Optional override for the title */
  titleOverride?: string;
}

export default function ModuleIntro({ moduleKey, titleOverride }: ModuleIntroProps) {
  const { activeUser, isRealSession, portalMode } = useApp();
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";
  const isFamilyPortal = portalMode === "family";
  const useFamily = isFamily || isFamilyPortal;

  // ── Seen state ────────────────────────────────────────────────────────────
  const [visible, setVisible] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const hasMarkedSeen = useRef(false);

  // Fetch user to get seenModules
  const { data: userData } = useQuery<User>({
    queryKey: ["/api/users", activeUser.id],
    queryFn: () => apiRequest("GET", `/api/users/${activeUser.id}`).then(r => r.json()),
    enabled: isRealSession,
  });

  const markSeenMutation = useMutation({
    mutationFn: (seenModules: string[]) =>
      apiRequest("PATCH", `/api/users/${activeUser.id}`, {
        seenModules: JSON.stringify(seenModules),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users", activeUser.id] }),
  });

  // ── Determine if we should show ──────────────────────────────────────────
  useEffect(() => {
    const DEMO_KEY = `cnp_seen_module_${activeUser.id}_${moduleKey}`;

    if (isRealSession) {
      if (!userData) return; // wait for data
      try {
        const seen: string[] = JSON.parse((userData as any).seenModules ?? "[]");
        if (!seen.includes(moduleKey)) {
          // Small delay so the page content renders first
          const t = setTimeout(() => setVisible(true), 600);
          return () => clearTimeout(t);
        }
      } catch {
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } else {
      // Demo mode — use localStorage
      try {
        const seen: string[] = JSON.parse(localStorage.getItem("cnp_seen_modules") ?? "[]");
        if (!seen.includes(DEMO_KEY)) {
          const t = setTimeout(() => setVisible(true), 600);
          return () => clearTimeout(t);
        }
      } catch {
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    }
  }, [activeUser.id, moduleKey, isRealSession, userData]);

  // ── Auto-play Becky when visible ─────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const copy = MODULE_COPY[moduleKey];
    const script = useFamily && copy.familyBeckyScript ? copy.familyBeckyScript : copy.beckyScript;

    setIsLoadingAudio(true);
    setAudioFailed(false);

    speakBecky(script)
      .then(() => {
        setIsLoadingAudio(false);
        setIsSpeaking(true);
      })
      .catch(() => {
        setIsLoadingAudio(false);
        setAudioFailed(true);
      });

    return () => stopBecky();
  }, [visible]);

  // ── Mark seen ────────────────────────────────────────────────────────────
  function markSeen() {
    if (hasMarkedSeen.current) return;
    hasMarkedSeen.current = true;

    stopBecky();
    setIsSpeaking(false);
    setVisible(false);

    if (isRealSession) {
      try {
        const current: string[] = JSON.parse((userData as any)?.seenModules ?? "[]");
        if (!current.includes(moduleKey)) {
          markSeenMutation.mutate([...current, moduleKey]);
        }
      } catch {
        markSeenMutation.mutate([moduleKey]);
      }
    } else {
      // Demo mode localStorage
      try {
        const DEMO_KEY = `cnp_seen_module_${activeUser.id}_${moduleKey}`;
        const current: string[] = JSON.parse(localStorage.getItem("cnp_seen_modules") ?? "[]");
        if (!current.includes(DEMO_KEY)) {
          localStorage.setItem("cnp_seen_modules", JSON.stringify([...current, DEMO_KEY]));
        }
      } catch {}
    }
  }

  if (!visible) return null;

  const copy = MODULE_COPY[moduleKey];
  const title = titleOverride ?? copy.title;
  const body = useFamily && copy.familyBody ? copy.familyBody : copy.body;

  return (
    <>
      {/* Backdrop — light scrim, tap to dismiss */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={markSeen}
        aria-hidden="true"
      />

      {/* Card — slides up from bottom */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:max-w-lg",
          "animate-in slide-in-from-bottom-4 duration-300"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={`How ${title} works`}
      >
        <div className={cn(
          "mx-0 md:mx-4 rounded-t-2xl md:rounded-2xl border shadow-2xl overflow-hidden",
          isFamilyPortal
            ? "bg-sidebar border-sidebar-border"
            : "bg-card border-border"
        )}>
          {/* Top handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                isFamilyPortal ? "bg-primary/20" : "bg-primary/10"
              )}>
                <Sparkles size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">How this works</p>
                <h2 className="text-sm font-semibold text-foreground leading-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  {title}
                </h2>
              </div>
            </div>
            <button
              onClick={markSeen}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
              aria-label="Dismiss"
              data-testid="module-intro-dismiss"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 pb-2">
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </div>

          {/* Becky voice indicator */}
          <div className="px-5 pb-4 pt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isLoadingAudio ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
                  <span className="ml-1">Becky is explaining…</span>
                </div>
              ) : isSpeaking ? (
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <Volume2 size={13} className="animate-pulse" />
                  <span>Becky is speaking</span>
                </div>
              ) : audioFailed ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <VolumeX size={13} />
                  <span>Audio unavailable</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Volume2 size={13} />
                  <span>Becky's intro</span>
                </div>
              )}
            </div>

            <button
              onClick={markSeen}
              data-testid="module-intro-got-it"
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                isFamilyPortal
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              Got it <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
