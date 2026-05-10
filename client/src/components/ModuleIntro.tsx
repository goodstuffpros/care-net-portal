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
    image: `${API_BASE}/university/new_cg_dashboard.jpg`,
    narration: "This is your home base every time you open the app. You'll see four stat tiles at the top — tasks completed, tasks still pending, any urgent flags that need your attention, and your most recent Care Log entries. These aren't just numbers. Tap any tile and it takes you straight into that data. Below the tiles you'll find today's schedule, and underneath that, your most recent Care Log entries. Everything is one tap away. Before you start a shift, this is the first place to look.",
    familyImage: `${API_BASE}/university/new_fc_dashboard.jpg`,
    familyNarration: "When you open the app, this is the first thing you see. Four tiles give you an instant read on how care is going — tasks completed, what's still pending, any urgent flags, and recent Care Log entries from your caregiver. Tap any tile to dig in. Underneath that you'll find the upcoming schedule and recent care notes. You don't have to wonder what's happening day to day. It's all right here.",
  },
  "family-profile": {
    title: "Your Profile",
    image: `${API_BASE}/university/new_fc_family_profile.jpg`,
    narration: "This is where you manage your own information in the app. Your name, phone number, and relationship to the person in care are all here. In Notification Preferences, you can choose which types of updates you want to be alerted about — turn categories on or off based on what's most useful to you. Under Care Circle, you can invite other family members so they have their own access. Account Settings lets you adjust your language and time zone. It's a quick setup and worth spending a few minutes on.",
    familyNarration: "This is where you manage your own information in the app. Your name, phone number, and relationship to the person in care are all here. In Notification Preferences, you can choose which types of updates you want to be alerted about — turn categories on or off based on what's most useful to you. Under Care Circle, you can invite other family members so they have their own access. Account Settings lets you adjust your language and time zone. It's a quick setup and worth spending a few minutes on.",
  },
  "nav-overlay": {
    title: "Your Menu",
    image: `${API_BASE}/university/new_cg_nav_overlay.jpg`,
    narration: "Tap the menu icon and the full navigation opens as a tile grid — every module, all at once. Tap any tile to go straight there. If you want to rearrange the layout, press and hold a tile and drag it where you want it. Put the modules you use most up front. The one tile that never moves is Emergency — it's always pinned at the bottom, right where you need it to be.",
    familyImage: `${API_BASE}/university/new_fc_nav_overlay.jpg`,
    familyNarration: "Tap the menu icon and you'll see all the app's sections laid out as tiles. Just tap the one you want. You can press and hold any tile to move it around and put your most-used sections at the top. Emergency is always pinned at the bottom — it doesn't move, no matter what.",
  },
  schedule: {
    title: "Schedule",
    image: `${API_BASE}/university/new_cg_schedule.jpg`,
    narration: "This is where your shifts and appointments live. Tap the plus to add a new event — give it a date, time, and a priority level. You'll notice a bell icon on every event. Tap that to turn on an alarm for it, and set how far ahead you want to be notified. Priority colors let you see at a glance what's routine, what's important, and what's urgent. If the Main Contact adds an appointment for your client, you'll get an urgent alert immediately — you're never caught off guard.",
    familyImage: `${API_BASE}/university/new_fc_schedule.jpg`,
    familyNarration: "As Main Contact, you can add appointments directly to the schedule. Tap the plus, fill in the details, and your caregiver gets an urgent alert right away — no need for a separate text or call. You can view everything coming up and everything that's already passed. The bell icon on each event lets you set an alarm with a custom lead time, so nothing slips through.",
  },
  "care-log": {
    title: "Care Log",
    image: `${API_BASE}/university/new_cg_carelog.jpg`,
    narration: "The Care Log is where you document your shift. Tap the plus to add a new entry and assign a priority — Normal, Important, or Urgent. Once you check off an entry, it collapses to just the first line to keep things tidy. Uncheck it any time to see the full note. See the Discuss button on an entry? Tap that to open a message thread tied directly to that note — the family sees the context automatically. Everything you log here is visible to the care team and family.",
    familyImage: `${API_BASE}/university/new_fc_carelog.jpg`,
    familyNarration: "Everything your caregiver documented during a visit lives here. You'll see a colored dot on each entry — green for Normal, yellow for Important, red for Urgent. Tap any entry to read the full note. As Main Contact, you can add your own entries too. If something needs a conversation, the Discuss button opens a message thread connected to that exact note. Nothing is lost in translation.",
  },
  messages: {
    title: "Messages",
    image: `${API_BASE}/university/new_cg_messages.jpg`,
    narration: "All your message threads are here. Tap any thread to read and reply. To start a brand new conversation, tap the teal New Thread button at the bottom. Here's something worth knowing — when you tap Discuss on a Care Log entry, it automatically opens a thread with that entry attached. The family sees exactly what you're referring to without you having to re-explain it. Everything stays connected.",
    familyImage: `${API_BASE}/university/new_fc_messages.jpg`,
    familyNarration: "Your message threads with the care team are all in one place. Tap any thread to read and respond. When your caregiver taps Discuss on a Care Log entry, that note comes attached to the thread — so you always have the full picture of what's being talked about. And if you want to start a conversation yourself, tap the teal New Thread button.",
  },
  vitals: {
    title: "Vitals",
    image: `${API_BASE}/university/new_cg_vitals.jpg`,
    narration: "After checking in on your client, log their vitals here. You can record blood pressure, heart rate, temperature, oxygen level, weight, and blood sugar. Just tap the reading you're logging, enter the value, and save it. Over time, those entries build a trend line — so if something starts drifting, you and the family can catch it early. Everything you log is visible to the family and the Main Contact.",
    familyImage: `${API_BASE}/university/new_fc_vitals.jpg`,
    familyNarration: "This is where you can see all the vital signs your caregiver has recorded. Blood pressure, heart rate, temperature, oxygen, weight, blood sugar — each one logged after a visit. You're not just seeing one reading, you're seeing a trend over time. If something looks off, you'll have the history to bring to a physician.",
  },
  medications: {
    title: "Medications",
    image: `${API_BASE}/university/new_cg_medications.jpg`,
    narration: "All of your client's medications are organized here by time of day — Morning, Afternoon, and Evening. Tap any medication to expand it and see the details. When you've administered a dose, log it in the Admin Log tab. That tab builds a full, timestamped administration record — every dose, every time. Nothing is based on memory. The family and Main Contact can see this record at any time, which means full transparency for everyone on the care team.",
    familyImage: `${API_BASE}/university/new_fc_medications.jpg`,
    familyNarration: "Your loved one's medications are listed by time of day — Morning, Afternoon, and Evening. Tap any one to see the details. The Admin Log tab shows exactly what's been given and when. Your caregiver logs every dose as it's administered, so you have a complete record to reference or share with a physician. There are no gaps, no guessing.",
  },
  media: {
    title: "Media",
    image: `${API_BASE}/university/new_cg_media.jpg`,
    narration: "Media is where you upload photos and documents for your client's record. That could be a wound photo to track healing progress, therapy materials, a photo from an outing, or documents you want the care team to have. Families can see what you upload, which means they don't have to wonder how things look — you're showing them. Over time, this builds a real visual record of care that words alone can't capture.",
  },
  archive: {
    title: "Archive",
    image: `${API_BASE}/university/new_cg_archive.jpg`,
    narration: "Archive is where your past shift summaries and generated reports live. When you're ready to create a new one, tap the teal Generate Summary button. CareNet pulls from your recent Care Log entries and Schedule data and puts together a structured summary automatically. You can share it with family, a physician, or a home care agency — it's the kind of documentation that used to take an hour to write yourself. This module unlocks after your first seven days in the app.",
    familyImage: `${API_BASE}/university/new_fc_archive.jpg`,
    familyNarration: "Archive gives you the 30,000-foot view. While your caregiver is documenting care day by day, Archive lets you step back and read through structured summaries of a week, a month, or longer. You can see patterns that are hard to notice from the ground — gradual progress, subtle changes, or a shift in the overall picture. It's the difference between reading today's entry and reading the whole story. This module unlocks after the first seven days in the app.",
  },
  badges: {
    title: "Badges",
    image: `${API_BASE}/university/new_cg_badges.jpg`,
    narration: "Badges is your professional performance record — built from your actual activity in the app. There are four categories: Connection at 32%, Dependability at 28%, Communication at 22%, and Knowledge at 18%. A yellow flag means an action happened outside the expected timeframe. If you get three yellow flags in the same category within 30 days, that becomes a red flag. Your score shows as a percentage inside the portal. On your public-facing profile, it shows as Hearts out of 5. This module unlocks at Day 30 once there's enough data to be meaningful.",
  },
  "care-scope": {
    title: "Care Scope",
    image: `${API_BASE}/university/new_cg_carescope.jpg`,
    narration: "Care Scope has two tabs. The Scope tab is where your care plan duties are laid out — what you're responsible for and what falls outside your role. The Flagging tab shows which categories are being tracked for yellow flags. A yellow flag is just a note that something happened outside the expected timeframe — it's not an accusation, it's a record. Three yellows in the same category over 30 days becomes a red flag. The family can turn flagging on or off for any category, so this is always a collaborative setup.",
  },
  documents: {
    title: "Documents",
    image: `${API_BASE}/university/new_cg_documents.jpg`,
    narration: "Documents is where the Main Contact stores important files — care plans, authorizations, medical instructions, insurance paperwork. Your access to any document depends entirely on what the MC has shared with you. By default, you can't see anything here. If the MC grants you access to a specific document, it'll appear for you. Just know that what you see is what you've been given permission to see.",
    familyImage: `${API_BASE}/university/new_fc_documents.jpg`,
    familyNarration: "As Main Contact, you own and manage all documents in this section. Upload care plans, authorizations, medical instructions, insurance — anything the care team might need. For each document, you choose who can see it: Private, CG Read-Only, or CG Full Access. Your caregiver sees nothing by default. You decide what to open up and when. It's your file cabinet, and you control the keys.",
  },
  outings: {
    title: "Outings",
    image: `${API_BASE}/university/new_cg_outings.jpg`,
    narration: "When you take your client somewhere — a doctor's appointment, a walk, an errand, a little outing — log it here. Add the destination, the timing, and any notes from the trip. Families really value knowing where their loved one has been and how it went. It also builds a record over time that shows engagement and activity outside the home. It takes thirty seconds, and it means a lot to the people who care about your client.",
  },
  thoughts: {
    title: "Collection of Thoughts",
    image: `${API_BASE}/university/new_cg_thoughts.jpg`,
    narration: "This is a private space — just for you and your client. When your client shares a story, a memory, something that made them laugh or brought tears to their eyes, you capture it here. Write what they said. Add what you noticed — how they looked, what it meant in that moment. The family doesn't see this section. They don't even know it exists. It's being quietly collected the entire time you're caring for their loved one. When the care journey comes to a close, it gets exported and given to them as a gift. A record of the person their family member was — in their own words, through your eyes. There's nothing else in the app quite like it.",
  },
  patterns: {
    title: "Health Patterns",
    image: `${API_BASE}/university/new_cg_patterns.jpg`,
    narration: "Health Patterns does something you don't have time to do — sit with all the data and look for what it's telling you. It's not a diagnosis. It's an observation. The kind of thing you might notice yourself if all you did was analyze numbers all day. For example, it might show that your client started experiencing consistent fatigue or changes in appetite right around the same time a new medication was introduced. That's not a coincidence — that's a pattern. CareNet surfaces those connections so you don't have to find them manually. Take it as a starting point for a conversation with a physician, not a conclusion.",
    familyImage: `${API_BASE}/university/new_fc_patterns.jpg`,
    familyNarration: "Health Patterns looks across all the data that's been collected and finds things worth noticing. Not diagnoses — observations. Patterns you might have spotted yourself if you had the time to sit with every entry, every vital, every care note. You don't have that time. This does. It might show that your loved one began experiencing consistent symptoms right around the time a new medication was introduced — the kind of thing that's easy to miss day to day but becomes obvious when the data lines up. It's not alarming you — it's informing you.",
  },
  "client-portal": {
    title: "Client Profile",
    image: `${API_BASE}/university/new_cg_client_profile.jpg`,
    narration: "This is the foundation everything else is built on. The Client Profile holds your client's full picture — personal background, care preferences, medical history, emergency contacts, and specific care instructions. This information is filled in and maintained by the family, so what you're reading reflects what they want you to know. Before you ever start a shift, this is worth reading. If you're ever in doubt about how your client likes something done, it's in here.",
    familyImage: `${API_BASE}/university/new_fc_client_profile.jpg`,
    familyNarration: "This is where everything about your loved one lives in one organized place. Personal information, care preferences, medical history, emergency contacts, and care instructions for your caregiver. If there's something important about how your loved one likes to be cared for — their routines, their preferences, what matters to them — this is where you put it. And life changes. Come back and update it whenever something shifts. The more current this profile is, the better care your loved one receives.",
  },
  wellbeing: {
    title: "Wellbeing",
    image: `${API_BASE}/university/new_cg_wellbeing.jpg`,
    narration: "This one is just for you. Caregiving is meaningful work, and it's also heavy — and this is the place to check in with yourself about that. Answer honestly. Your responses here are anonymous and completely confidential — nobody on the care team sees them. It's not a performance review. It's a quiet corner of the app that belongs to you, because what you carry matters too.",
  },
};

// ── Component

// ── Component ─────────────────────────────────────────────────────────────────

interface ModuleIntroProps {
  moduleKey: ModuleKey;
}

export default function ModuleIntro({ moduleKey }: ModuleIntroProps) {
  const { activeUser, isRealSession, portalMode, navOverlayOpen } = useApp();
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";
  const isFamilyPortal = portalMode === "family";
  const useFamily = isFamily || isFamilyPortal;

  const [visible, setVisible] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const hasMarkedSeen = useRef(false);
  const hasDismissed = useRef(false); // permanent guard — never resets in this mount

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
  // Flipped to false for beta — real users only see each intro once.
  const DEV_ALWAYS_SHOW = true;

  useEffect(() => {
    const DEMO_KEY = `cnp_seen_module_${activeUser.id}_${moduleKey}`;

    function checkAndShow(seenList: string[], storageKey?: string) {
      // Never re-show if user already dismissed it this mount
      if (hasDismissed.current) return;
      // Never show while the nav overlay is open
      if (navOverlayOpen) return;
      if (DEV_ALWAYS_SHOW || (!seenList.includes(moduleKey) && !seenList.includes(DEMO_KEY))) {
        const t = setTimeout(() => {
          if (!hasDismissed.current && !navOverlayOpen) setVisible(true);
        }, 700);
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
  }, [activeUser.id, moduleKey, isRealSession, userData, navOverlayOpen]);

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
    hasDismissed.current = true; // permanent — blocks any re-show from userData refetch
    // Stop audio immediately — iOS needs pause() called synchronously in the touch handler
    stopBecky();
    setIsLoading(false);
    setIsSpeaking(false);
    setVisible(false);

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
