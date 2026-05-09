/**
 * ModuleIntro — full-screen "How this works" intro overlay.
 *
 * Shows automatically the FIRST time a user visits a module.
 * Reuses the Care Net University screenshot + Becky's narration for that module.
 * Dismisses on "Got it", back button, or backdrop tap.
 * Never shows again for that user + module combination.
 *
 * Usage in any page:
 *   <ModuleIntro moduleKey="schedule" />
 */

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
import { useApp } from "@/App";
import { speakBecky, stopBecky, pauseBecky, resumeBecky, isBeckyPlaying, registerBeckyStateListener, unregisterBeckyStateListener } from "@/lib/ttsUtils";
import { cn } from "@/lib/utils";
import { X, Volume2, VolumeX, Pause, Play, ChevronRight } from "lucide-react";
import type { User } from "@shared/schema";

// ── Module → CNU lesson mapping ───────────────────────────────────────────────
// Each module key maps to:
//   image   — the CNU screenshot already hosted on the server
//   narration — Becky's exact script from the CNU lesson (caregiver version)
//   familyNarration — family-facing version where it differs
//   familyImage — family-specific screenshot where it exists

export type ModuleKey =
  | "dashboard"
  | "nav-overlay"
  | "family-profile"
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

interface ModuleLesson {
  title: string;
  image: string;
  narration: string;
  familyImage?: string;
  familyNarration?: string;
}

const LESSONS: Record<ModuleKey, ModuleLesson> = {
  dashboard: {
    title: "Your Dashboard",
    image: `${API_BASE}/university/seed_mod02_dashboard.jpg`,
    narration: "Welcome to your Dashboard. This is your home base every time you open Care Net Portal. The four stat tiles at the top give you an instant snapshot — tasks completed today, tasks still pending, urgent flags, and recent Care Log entries. Below that you will find today’s upcoming schedule and the most recent Care Log entries — so you can see what is coming and what has already been documented, all in one place.",
    familyImage: `${API_BASE}/university/seed_fc01_dashboard.jpg`,
    familyNarration: "Welcome to your Dashboard — your home base every time you open the Family Care Portal. The stat tiles at the top give you a quick snapshot of today’s activity. Below that you will see your loved one’s upcoming schedule and the most recent Care Log entries — so you are always in the loop without having to dig.",
  },
  "family-profile": {
    title: "Your Profile",
    image: `${API_BASE}/university/seed_mod18_family_portal.jpg`,
    narration: "This is your profile page. At the top you can update your name, phone number, and your relationship to your loved one. Scrolling down, you will find your Notification Preferences — this is where you choose exactly what Care Net Portal tells you about. You can turn on or off notifications for schedule changes, new Care Log entries, messages, vital sign alerts, medications, and media. Each one has its own toggle so you are only hearing about the things that matter to you. Below that is your Care Circle, where you can invite additional family members to the portal. And at the bottom, Account Settings let you update your language and time zone.",
    familyNarration: "This is your profile page. At the top you can update your name, phone number, and your relationship to your loved one. Scrolling down, you will find your Notification Preferences — this is where you choose exactly what Care Net Portal tells you about. You can turn on or off notifications for schedule changes, new Care Log entries, messages, vital sign alerts, medications, and media. Each one has its own toggle so you are only hearing about the things that matter to you. Below that is your Care Circle, where you can invite additional family members to the portal. And at the bottom, Account Settings let you update your language and time zone.",
  },
  "nav-overlay": {
    title: "Your Menu",
    image: `${API_BASE}/university/seed_mod04_nav_overlay.jpg`,
    narration: "This is your menu — the fastest way to get anywhere in Care Net Portal. Every module in the app has a tile right here. Tap any tile to go directly to that section. Now here is something worth knowing — you can make this menu yours. Press and hold any tile for a moment, then drag it to a new position. Your order saves automatically. Put the things you use every day at the top, and everything else wherever makes sense to you.",
    familyImage: `${API_BASE}/university/seed_fc02_nav_overlay.jpg`,
    familyNarration: "This is your menu — every section of the Family Care Portal is one tap away from here. Tap any tile to go directly to that part of the app. And you can make it your own — press and hold any tile, then drag it where you want it. Your layout saves automatically, so the things you check most often are always right at the top.",
  },
  schedule: {
    title: "Schedule",
    image: `${API_BASE}/university/seed_mod05_schedule.jpg`,
    narration: "The Schedule keeps every caregiver and family member aligned on coverage. Tap the plus to add a shift or appointment. Set the date, time, and priority level. The Main Contact can also add appointments — you will receive an urgent red alert immediately so nothing gets missed.",
    familyImage: `${API_BASE}/university/seed_fc04_schedule.jpg`,
    familyNarration: "As Main Contact, you can add appointments directly to the Schedule. Tap the plus button, enter the details, and save. Your caregiver receives an urgent red alert immediately — so nothing is ever missed between you.",
  },
  "care-log": {
    title: "Care Log",
    image: `${API_BASE}/university/seed_mod06_carelog_list.jpg`,
    narration: "The Care Log is your daily record of care. Every shift entry lives here — tasks completed, observations, anything worth noting. Entries are timestamped and visible to the family, building a complete and transparent picture of care over time.",
    familyImage: `${API_BASE}/university/seed_fc03_carelog.jpg`,
    familyNarration: "The Care Log shows everything your caregiver has documented. Each entry has a priority dot — green for Normal, yellow for Important, red for Urgent. Tap any entry to read the full text. As Main Contact, you can also add your own entries directly.",
  },
  messages: {
    title: "Messages",
    image: `${API_BASE}/university/seed_mod09_messages.jpg`,
    narration: "Messages are organized by thread so every conversation has context. Tap any thread to read and reply. Tap New Thread — the green button — to start a fresh conversation with the family or care team. Threads can also be opened directly from a Care Log entry or a note using the Discuss button.",
    familyImage: `${API_BASE}/university/seed_fc06_messages.jpg`,
    familyNarration: "Start a new thread to reach the caregiver or care team directly. The green New Thread button opens a fresh conversation. The Discuss button on Care Log entries and notes opens a message thread tied to that specific context — so your caregiver knows exactly what you are referring to.",
  },
  vitals: {
    title: "Vitals",
    image: `${API_BASE}/university/seed_mod08_vitals.jpg`,
    narration: "The Vitals module lets you log blood pressure, heart rate, temperature, oxygen levels, weight, and blood sugar. Log readings after each check — the system tracks trends and flags anything that looks unusual over time.",
    familyImage: `${API_BASE}/university/seed_fc07_vitals.jpg`,
    familyNarration: "Vitals shows your loved one's logged readings — blood pressure, heart rate, temperature, and more. Your caregiver records these during visits so you can follow health trends over time.",
  },
  medications: {
    title: "Medications",
    image: `${API_BASE}/university/seed_mod07_medications.jpg`,
    narration: "Medications lists every medication organized by Morning, Afternoon, and Evening. Log each dose in the Admin Log tab to build a complete administration record. The record is visible to the family and creates accountability for every dose given.",
    familyImage: `${API_BASE}/university/seed_fc05_medications.jpg`,
    familyNarration: "Medications shows every medication organized by time of day — Morning, Afternoon, and Evening. You can see what has been administered and follow your loved one's medication schedule.",
  },
  media: {
    title: "Media",
    image: `${API_BASE}/university/seed_mod13_media.jpg`,
    narration: "The Media Library is a shared space for photos and documents relevant to your client's care. Upload wound photos, therapy materials, identification documents, or any visual record that helps the family stay informed. All authorized care team members can view what has been uploaded.",
  },
  archive: {
    title: "Archive",
    image: `${API_BASE}/university/seed_mod12_archive.jpg`,
    narration: "The Archive stores all past shift summaries and generated reports. Tap Generate Summary — the green button — to create a new report from recent Care Log entries and Schedule data. CareNet reads the documentation and produces a structured summary you can share with family, physicians, or agencies.",
  },
  badges: {
    title: "Badges",
    image: `${API_BASE}/university/seed_mod16_badges.jpg`,
    narration: "Your Badges page shows your performance record — built from real activity data, not self-reported. Communication, Dependability, Knowledge, and Connection are each scored from your actual care activity. Yellow flags and red flags are tracked here and feed directly into your score.",
  },
  "care-scope": {
    title: "Care Scope",
    image: `${API_BASE}/university/seed_mod11_carescope.jpg`,
    narration: "Care Scope is the accountability system built into the platform. The Scope tab defines your care plan. The Flagging tab controls which categories can generate yellow flags. A yellow flag is triggered when an action falls outside the expected timeframe. Three yellows in the same category within 30 days becomes a red flag. Families can turn flagging off for specific categories.",
  },
  documents: {
    title: "Documents",
    image: `${API_BASE}/university/seed_mod13_media.jpg`,
    narration: "Documents is a secure place for care-related paperwork — authorizations, care plans, medical instructions, and insurance information. Everything the care team needs, accessible in one place.",
  },
  outings: {
    title: "Outings",
    image: `${API_BASE}/university/seed_mod14_outings.jpg`,
    narration: "Outings lets you log and plan trips with your client — destinations, timing, and any notes from the outing. This keeps the family informed and builds a record of activities over time.",
  },
  thoughts: {
    title: "Collection of Thoughts",
    image: `${API_BASE}/university/seed_mod15_thoughts.jpg`,
    narration: "Collection of Thoughts is your private journal inside Care Net Portal. This is a space for personal reflections, things worth remembering, and the moments that matter in this work. It is visible only to you.",
  },
  patterns: {
    title: "Wellness Trends",
    image: `${API_BASE}/university/seed_mod08_vitals.jpg`,
    narration: "Wellness Trends surfaces patterns in vitals and care log data over time — the kind of thing that is easy to miss day to day. As data builds up, the app charts correlations and flags trends that may be worth discussing with a physician.",
  },
  "client-portal": {
    title: "Client Profile",
    image: `${API_BASE}/university/seed_mod03_client_profile.jpg`,
    narration: "The Client Portal is the full profile for the person in your care. Background, preferences, medical history, emergency contacts, and care instructions all live here. Keep this complete — it is the foundation of everything the care team needs to know.",
    familyImage: `${API_BASE}/university/seed_mod18_family_portal.jpg`,
    familyNarration: "The Client Profile is where your loved one's full picture lives — personal information, care preferences, medical history, and emergency contacts. Everything your care team needs, organized in one place.",
  },
  wellbeing: {
    title: "Wellbeing",
    image: `${API_BASE}/university/seed_mod20_wellbeing.jpg`,
    narration: "Wellbeing is a private check-in space just for you. When the weight of this work gets heavy, this is the place to say so. Your responses are anonymous and confidential — a quiet corner that is yours alone.",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ModuleIntroProps {
  moduleKey: ModuleKey;
}

export default function ModuleIntro({ moduleKey }: ModuleIntroProps) {
  const { activeUser, isRealSession, portalMode } = useApp();
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";
  const isFamilyPortal = portalMode === "family";
  const useFamily = isFamily || isFamilyPortal;

  const [visible, setVisible] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const hasMarkedSeen = useRef(false);

  // ── Fetch user to read seenModules ───────────────────────────────────────
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

  // ── Should we show? ──────────────────────────────────────────────────────
  // DEV MODE: always show on every visit so the team can review all intros.
  // Flip DEV_ALWAYS_SHOW to false when intros are finalized for production.
  const DEV_ALWAYS_SHOW = true;

  useEffect(() => {
    const DEMO_KEY = `cnp_seen_module_${activeUser.id}_${moduleKey}`;

    function checkAndShow(seenList: string[], storageKey?: string) {
      if (DEV_ALWAYS_SHOW || (!seenList.includes(moduleKey) && !seenList.includes(DEMO_KEY))) {
        const t = setTimeout(() => setVisible(true), 700);
        return () => clearTimeout(t);
      }
    }

    if (isRealSession) {
      if (!userData) return;
      try {
        const seen: string[] = JSON.parse((userData as any).seenModules ?? "[]");
        return checkAndShow(seen);
      } catch {
        return checkAndShow([]);
      }
    } else {
      try {
        const seen: string[] = JSON.parse(localStorage.getItem("cnp_seen_modules") ?? "[]");
        return checkAndShow(seen, DEMO_KEY);
      } catch {
        return checkAndShow([]);
      }
    }
  }, [activeUser.id, moduleKey, isRealSession, userData]);

  // ── Subscribe to Becky state changes ────────────────────────────────────
  useEffect(() => {
    registerBeckyStateListener(({ isPlaying, isLoading: loading }) => {
      setIsSpeaking(isPlaying);
      setIsLoading(loading);
      setIsPaused(!isPlaying && !loading && isBeckyPlaying() === false);
    });
    return () => unregisterBeckyStateListener();
  }, []);

  // ── Auto-play when visible ───────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const lesson = LESSONS[moduleKey];
    const script = useFamily && lesson.familyNarration ? lesson.familyNarration : lesson.narration;

    setIsLoading(true);
    setAudioFailed(false);
    setIsSpeaking(false);
    setIsPaused(false);

    speakBecky(script)
      .then(() => {
        // speakBecky resolves when audio ENDS (or errors)
        // State is tracked via the Becky state listener — nothing to do here
      })
      .catch(() => {
        setIsLoading(false);
        setAudioFailed(true);
      });

    return () => stopBecky();
  }, [visible]);

  // ── Handle Android back button ───────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    window.history.pushState({ moduleIntro: true }, "");
    const handlePop = () => {
      stopBecky();
      markSeen();
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [visible]);

  // ── Mark seen + close ────────────────────────────────────────────────────
  function markSeen() {
    if (hasMarkedSeen.current) return;
    hasMarkedSeen.current = true;
    // Stop audio immediately — iOS needs pause() called synchronously in the touch handler
    stopBecky();
    setIsLoading(false);
    setIsSpeaking(false);
    setVisible(false);
    // Reset for next visit (DEV_ALWAYS_SHOW mode)
    setTimeout(() => { hasMarkedSeen.current = false; }, 1000);

    if (isRealSession) {
      try {
        const current: string[] = JSON.parse((userData as any)?.seenModules ?? "[]");
        if (!current.includes(moduleKey)) markSeenMutation.mutate([...current, moduleKey]);
      } catch {
        markSeenMutation.mutate([moduleKey]);
      }
    } else {
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

  const lesson = LESSONS[moduleKey];
  const image = useFamily && lesson.familyImage ? lesson.familyImage : lesson.image;
  const overlayColor = isFamilyPortal ? "hsl(345,52%,12%)" : "hsl(175,55%,10%)";

  return (
    // Full-screen overlay — same feel as CNU lesson viewer
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={`How ${lesson.title} works`}>

      {/* Screenshot fills the screen */}
      <div className="absolute inset-0">
        <img
          src={image}
          alt={lesson.title}
          className="w-full h-full object-contain object-top"
        />
        {/* Gradient fade at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
          style={{ background: `linear-gradient(to top, ${overlayColor} 0%, transparent 100%)` }}
        />
      </div>

      {/* "Example" banner — top center */}
      <div className="relative flex items-center justify-center px-4 pt-3 pb-0 z-10">
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          <span className="text-white/50 text-[10px] tracking-wide">Example — not your live data</span>
        </div>
      </div>

      {/* Top bar — title + close */}
      <div className="relative flex items-center justify-between px-4 pt-2 pb-3 z-10">
        <div className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <span className="text-white/80 text-xs font-medium">How this works</span>
        </div>
        <button
          type="button"
          onClick={markSeen}
          onTouchEnd={e => { e.preventDefault(); markSeen(); }}
          data-testid="module-intro-close"
          aria-label="Close intro"
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          <X size={18} className="text-white" />
        </button>
      </div>

      {/* Bottom controls — pinned */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-8 pt-4">
        {/* Module title */}
        <h2 className="text-white text-lg font-bold mb-1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          {lesson.title}
        </h2>

        {/* Audio status + pause/play control */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 text-xs h-5">
            {isLoading ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse [animation-delay:300ms]" />
                <span className="ml-1 text-white/60">Loading audio…</span>
              </>
            ) : isSpeaking ? (
              <>
                <Volume2 size={13} className="text-white/70 animate-pulse" />
                <span className="text-white/70">Becky is speaking</span>
              </>
            ) : audioFailed ? (
              <>
                <VolumeX size={13} className="text-white/50" />
                <span className="text-white/50">Audio unavailable</span>
              </>
            ) : isPaused ? (
              <>
                <Pause size={13} className="text-white/50" />
                <span className="text-white/50">Paused</span>
              </>
            ) : null}
          </div>

          {/* Pause / Play / Replay button — visible whenever audio is active or paused */}
          {!audioFailed && (isLoading || isSpeaking || isPaused) && (
            <button
              type="button"
              onClick={() => {
                if (isSpeaking) {
                  pauseBecky();
                  setIsSpeaking(false);
                  setIsPaused(true);
                } else if (isPaused) {
                  resumeBecky();
                  setIsSpeaking(true);
                  setIsPaused(false);
                }
              }}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all flex-shrink-0"
              aria-label={isSpeaking ? "Pause narration" : "Resume narration"}
            >
              {isSpeaking
                ? <Pause size={15} className="text-white" />
                : <Play size={15} className="text-white ml-0.5" />}
            </button>
          )}
        </div>

        {/* Got it button */}
        <button
          type="button"
          onClick={markSeen}
          onTouchEnd={e => { e.preventDefault(); markSeen(); }}
          data-testid="module-intro-got-it"
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all",
            isFamilyPortal
              ? "bg-primary text-primary-foreground"
              : "bg-primary text-primary-foreground"
          )}
        >
          Got it — take me in
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
