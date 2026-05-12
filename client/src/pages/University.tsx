import { useState, useEffect, useRef } from "react";
import { useApp } from "@/App";
import { cn } from "@/lib/utils";
import { GraduationCap, Play, CheckCircle2, Lock, ChevronRight, X, BookOpen, Users, Award, ChevronLeft, Sparkles, Pause, Volume2, VolumeX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, API_BASE, STATIC_BASE } from "@/lib/queryClient";
import { speakBecky, stopBecky } from "@/lib/ttsUtils";

// ── Lesson definitions ────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  subtitle: string;    // module grouping label
  image: string;
  narration: string;
  duration: string;
  knowledgePoints: number;
  useBeckyVoice?: boolean; // module 20 only
}

interface Track {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  accentColor: string;
  borderColor: string;
  icon: any;
  audience: "caregiver" | "family" | "both";
  lessons: Lesson[];
}

// ── CAREGIVER TRACK — 20 modules ─────────────────────────────────────────────
const CAREGIVER_TRACK: Track = {
  id: "caregiver",
  title: "Caregiver Track",
  subtitle: "Master every tool in your portal",
  color: "bg-teal-600",
  accentColor: "text-teal-600",
  borderColor: "border-teal-500/30",
  icon: BookOpen,
  audience: "caregiver",
  lessons: [
    {
      id: "mod01_cg_profile",
      title: "Creating Your Caregiver Profile",
      subtitle: "Module 1 · Core Onboarding",
      image: `${STATIC_BASE}/university/new_cg_client_profile.jpg`,
      narration: "Your caregiver profile is your professional identity inside Care Net Portal. Tap My Profile to set your name, contact info, credentials, and role. This is what families see when they connect with you — make it complete and accurate before your first shift.",
      duration: "3 min", knowledgePoints: 4,
    },
    {
      id: "mod02_family_integration",
      title: "Integrating with the Family Side",
      subtitle: "Module 2 · Core Onboarding",
      image: `${STATIC_BASE}/university/new_cg_dashboard.jpg`,
      narration: "Care Net Portal connects you, your client, and the family on a single shared platform. The Main Contact manages family access and can view your Care Log entries, schedule events, and add medications. You will receive immediate alerts when they do. This connection is the foundation of transparency.",
      duration: "3 min", knowledgePoints: 4,
    },
    {
      id: "mod03_client_profile",
      title: "Creating a Client Profile",
      subtitle: "Module 3 · Core Onboarding",
      image: `${STATIC_BASE}/university/new_cg_client_profile.jpg`,
      narration: "A complete client profile is essential for quality care documentation. Include the client's full name, date of birth, address, emergency contacts, primary physician, and any critical health notes. This record travels with every log entry and report generated from the portal.",
      duration: "4 min", knowledgePoints: 5,
    },
    {
      id: "mod04_family_members",
      title: "Adding Family Member Profiles",
      subtitle: "Module 4 · Core Onboarding",
      image: `${STATIC_BASE}/university/new_cg_nav_overlay.jpg`,
      narration: "The Main Contact can add Secondary Family Members to the care network. Each family member gets their own login with controlled visibility — they see the Care Log, Schedule, and Medications but not caregiver-only tools. Set notification preferences per person so the right alerts reach the right people.",
      duration: "3 min", knowledgePoints: 4,
    },
    {
      id: "mod05_schedule",
      title: "Schedule — Creation & Management",
      subtitle: "Module 5 · Core Onboarding",
      image: `${STATIC_BASE}/university/new_cg_schedule.jpg`,
      narration: "The Schedule keeps every caregiver and family member aligned on coverage. Tap the plus to add a shift or appointment. Set the date, time, and priority level. The Main Contact can also add appointments — you will receive an urgent red alert immediately so nothing gets missed.",
      duration: "4 min", knowledgePoints: 5,
    },
    {
      id: "mod06_carelog",
      title: "Care Log — Creation & Management",
      subtitle: "Module 6 · Core Onboarding",
      image: `${STATIC_BASE}/university/new_cg_carelog.jpg`,
      narration: "The Care Log is the heart of the platform. Every shift gets a documented entry — what happened, what you observed, how the client was feeling. Fill in the title, write the full narrative, then set the priority. Normal for routine entries, Important for things the family should know, Urgent for anything requiring immediate attention.",
      duration: "4 min", knowledgePoints: 5,
    },
    {
      id: "mod07_medications",
      title: "Medications — Creation & Management",
      subtitle: "Module 7 · Core Onboarding",
      image: `${STATIC_BASE}/university/new_cg_medications.jpg`,
      narration: "Medications are grouped by time of day — Morning, Afternoon, and Evening — in alphabetical order. Each card shows name, dosage, prescribing doctor, and pharmacy. Tap a card to see the Rx number and admin log. As caregiver, you can add new medications. The Main Contact will receive an urgent alert when you do.",
      duration: "4 min", knowledgePoints: 5,
    },
    {
      id: "mod08_vitals",
      title: "Vitals — Tracking & Logging",
      subtitle: "Module 8 · Daily Use",
      image: `${STATIC_BASE}/university/new_cg_vitals.jpg`,
      narration: "Vitals tracks your client's key health readings over time. Today's values appear at the top — blood pressure, heart rate, oxygen, temperature, and weight. Trend charts below show the past 30 days. Readings outside the normal range are highlighted automatically. Tap the plus to log a new reading.",
      duration: "3 min", knowledgePoints: 4,
    },
    {
      id: "mod09_messages",
      title: "Messages — Sending & Managing",
      subtitle: "Module 9 · Daily Use",
      image: `${STATIC_BASE}/university/new_cg_messages.jpg`,
      narration: "Messages are organized by thread so every conversation has context. Tap any thread to read and reply. Tap New Thread — the green button — to start a fresh conversation with the family or care team. Threads can also be opened directly from a Care Log entry or a note using the Discuss button.",
      duration: "2 min", knowledgePoints: 3,
    },
    {
      id: "mod10_notifications",
      title: "Notifications — Settings & Alerts",
      subtitle: "Module 10 · Daily Use",
      image: `${STATIC_BASE}/university/new_cg_notes.jpg`,
      narration: "Tap the bell in the top right to see all your alerts. Red alerts require immediate attention — these include urgent Care Log entries, schedule changes added by the family, and new medications. Yellow flags are informational. Configure which alerts you receive in your notification settings to keep your feed focused.",
      duration: "2 min", knowledgePoints: 3,
    },
    {
      id: "mod11_carescope",
      title: "Care Scope — Flagging & Rating",
      subtitle: "Module 11 · Daily Use",
      image: `${STATIC_BASE}/university/new_cg_carescope.jpg`,
      narration: "Care Scope is the accountability system built into the platform. The Scope tab defines your care plan. The Flagging tab controls which categories can generate yellow flags. A yellow flag is triggered when an action falls outside the expected timeframe. Three yellows in the same category within 30 days becomes a red flag. Families can turn flagging off for specific categories.",
      duration: "3 min", knowledgePoints: 5,
    },
    {
      id: "mod12_archive",
      title: "Archive & CareNet Summaries",
      subtitle: "Module 12 · Daily Use",
      image: `${STATIC_BASE}/university/new_cg_archive.jpg`,
      narration: "The Archive stores all past shift summaries and generated reports. Tap Generate Summary — the green button — to create a new report from recent Care Log entries and Schedule data. CareNet reads the documentation and produces a structured summary you can share with family, physicians, or agencies.",
      duration: "4 min", knowledgePoints: 5,
    },
    {
      id: "mod13_media",
      title: "Media Library",
      subtitle: "Module 13 · Daily Use",
      image: `${STATIC_BASE}/university/new_cg_media.jpg`,
      narration: "The Media Library is a shared space for photos and documents relevant to your client's care. Upload wound photos, therapy materials, identification documents, or any visual record that helps the family stay informed. All authorized care team members can view what has been uploaded.",
      duration: "2 min", knowledgePoints: 3,
    },
    {
      id: "mod14_outings",
      title: "Outings — Planning & Logging",
      subtitle: "Module 14 · Daily Use",
      image: `${STATIC_BASE}/university/new_cg_outings.jpg`,
      narration: "Outings let you plan and document time outside the home. Add the destination, planned duration, and any preparation notes beforehand. After the outing, log how it went — including the client's response, any notable moments, and whether a follow-up is needed. Families appreciate this documentation.",
      duration: "2 min", knowledgePoints: 3,
    },
    {
      id: "mod15_thoughts",
      title: "Collection of Thoughts",
      subtitle: "Module 15 · Caregiver Only",
      image: `${STATIC_BASE}/university/new_cg_thoughts.jpg`,
      narration: "Collection of Thoughts captures what your client shares with you — their stories, memories, and reflections that surface during the hours you spend together. Stories from a lifetime. Their hometown, their parents, how they met their spouse, moments their own children may never have heard. You have a bond with this person that opens doors no one else can. Write what they share, in their words, as best you can. It does not need to be complete. Even fragments are worth saving. When care concludes, you can gift the entire collection to the family. It is their loved one's voice — preserved through you.",
      duration: "2 min", knowledgePoints: 3,
    },
    {
      id: "mod16_badges",
      title: "Badges — Recognition & Milestones",
      subtitle: "Module 16 · Recognition",
      image: `${STATIC_BASE}/university/new_cg_badges.jpg`,
      narration: "Your Care Badge measures performance across four dimensions: Communication at 22 percent, Dependability at 28 percent, Knowledge at 18 percent, and Connection at 32 percent. Scoring is mathematical — based on documentation frequency, response times, and care activity — not subjective ratings. The percentage shown inside the portal is your raw score. The hearts shown publicly in Care Connections are derived from that score.",
      duration: "2 min", knowledgePoints: 4,
    },
    {
      id: "mod17_bilingual",
      title: "Bilingual Tools",
      subtitle: "Module 17 · Accessibility",
      image: `${STATIC_BASE}/university/new_cg_nav_overlay.jpg`,
      narration: "Care Net Portal supports bilingual caregivers and families. Tap the language toggle in the nav overlay footer to switch the interface between English and Spanish. All core features — Care Log, Schedule, Medications, Messages — are fully available in both languages. This ensures no communication is lost across language barriers.",
      duration: "3 min", knowledgePoints: 3,
    },
    {
      id: "mod18_family_portal",
      title: "Family Care Portal Mode",
      subtitle: "Module 18 · Family Portal",
      image: `${STATIC_BASE}/university/new_fc_dashboard.jpg`,
      narration: "Family Care Portal mode transforms the interface for family members. The rose header confirms you are in family mode. Caregiver-only tools — Badges, Care Scope, Collection of Thoughts, and My Profile — are hidden. The family sees the Care Log, Schedule, Medications, Messages, and Vitals. Switch modes anytime from the portal mode toggle in the nav overlay footer.",
      duration: "4 min", knowledgePoints: 4,
    },
    {
      id: "mod19_nav_settings",
      title: "Nav Overlay & Settings",
      subtitle: "Module 19 · Navigation",
      image: `${STATIC_BASE}/university/new_cg_nav_overlay.jpg`,
      narration: "The navigation overlay is a full-screen grid of colored tiles — one for each section of the app. Tap any tile to go there. Drag to reorder your favorites. Emergency is always pinned at the bottom. The footer controls let you toggle language, switch color palette, change light or dark mode, toggle portal mode, and switch users.",
      duration: "2 min", knowledgePoints: 3,
    },
    {
      id: "mod20_wellbeing",
      title: "Wellbeing — Need a Friend",
      subtitle: "Module 20 · Care for the Caregiver",
      image: `${STATIC_BASE}/university/new_cg_wellbeing.jpg`,
      narration: "This one is personal. Caregiving is one of the hardest jobs there is — and one of the loneliest. My Wellbeing is a private space built specifically for you. Tap Need a Friend anytime you need a moment to be heard. What you write is completely private. You can choose a text response or a voice response. After you share, I will ask how you are feeling — and I will respond with something real, not a script. You deserve support too. That is why this is here.",
      duration: "3 min", knowledgePoints: 4,
      useBeckyVoice: true,
    },
  ],
};

// ── FAMILY TRACK — 8 lessons ─────────────────────────────────────────────────
const FAMILY_TRACK: Track = {
  id: "family",
  title: "Family Track",
  subtitle: "Stay connected and informed",
  color: "bg-rose-600",
  accentColor: "text-rose-600",
  borderColor: "border-rose-500/30",
  icon: Users,
  audience: "family",
  lessons: [
    {
      id: "fc_01", title: "Your Family Care Portal", subtitle: "Getting Started",
      image: `${STATIC_BASE}/university/new_fc_dashboard.jpg`,
      narration: "Welcome to the Family Care Portal. The rose header confirms you are in family mode. Your loved one's key care information is always visible on the dashboard — recent activity, upcoming schedule, and your connected caregiver.",
      duration: "20 sec", knowledgePoints: 2,
    },
    {
      id: "fc_02", title: "Navigation Overview", subtitle: "Getting Started",
      image: `${STATIC_BASE}/university/new_fc_nav_overlay.jpg`,
      narration: "Family navigation shows only the tools relevant to you. Caregiver-only features are not shown. You can switch back to Dedicated CG view anytime using the portal mode toggle in the nav overlay footer.",
      duration: "20 sec", knowledgePoints: 2,
    },
    {
      id: "fc_03", title: "Reading the Care Log", subtitle: "Care Log",
      image: `${STATIC_BASE}/university/new_fc_carelog.jpg`,
      narration: "The Care Log shows everything your caregiver has documented. Each entry has a priority dot — green for Normal, yellow for Important, red for Urgent. Tap any entry to read the full text. As Main Contact, you can also add your own entries directly.",
      duration: "25 sec", knowledgePoints: 3,
    },
    {
      id: "fc_04", title: "Schedule & Appointments", subtitle: "Schedule",
      image: `${STATIC_BASE}/university/new_fc_schedule.jpg`,
      narration: "As Main Contact, you can add appointments directly to the Schedule. Tap the plus button, enter the details, and save. Your caregiver receives an urgent red alert immediately — so nothing is ever missed between you.",
      duration: "20 sec", knowledgePoints: 2,
    },
    {
      id: "fc_05", title: "Medication Regimen", subtitle: "Medications",
      image: `${STATIC_BASE}/university/new_fc_medications.jpg`,
      narration: "Medications are grouped by Morning, Afternoon, and Evening. Tap any card to see the dosage, prescribing doctor, and pharmacy. As Main Contact you can add new medications — your caregiver will receive an urgent alert when you do.",
      duration: "20 sec", knowledgePoints: 2,
    },
    {
      id: "fc_06", title: "Messages & Discuss", subtitle: "Messages",
      image: `${STATIC_BASE}/university/new_fc_messages.jpg`,
      narration: "Start a new thread to reach the caregiver or care team directly. The green New Thread button opens a fresh conversation. The Discuss button on Care Log entries and notes opens a message thread tied to that specific context — so your caregiver knows exactly what you are referring to.",
      duration: "25 sec", knowledgePoints: 3,
    },
    {
      id: "fc_07", title: "Vitals & Health", subtitle: "Vitals",
      image: `${STATIC_BASE}/university/new_fc_vitals.jpg`,
      narration: "Vitals gives you a real-time view of your loved one's health readings. Today's values appear at the top. Trend charts below show the past 30 days so you can spot patterns. Readings outside the normal range are highlighted automatically.",
      duration: "20 sec", knowledgePoints: 2,
    },
    {
      id: "fc_08", title: "Notes, Resolving & Discussing", subtitle: "Notes",
      image: `${STATIC_BASE}/university/new_fc_carelog.jpg`,
      narration: "Misc Notes are shared observations and reminders. Mark a note Resolved when it has been handled. Tap Discuss to open a message thread directly tied to that note — no context is ever lost between you and the caregiver.",
      duration: "25 sec", knowledgePoints: 3,
    },
  ],
};

const ALL_TRACKS = [CAREGIVER_TRACK, FAMILY_TRACK];

// ── Welcome Video Gate ────────────────────────────────────────────────────────
function WelcomeGate({ onClose }: { onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      setAudioError(null);
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => { setPlaying(true); })
          .catch((err) => {
            console.error('Audio play failed:', err);
            setAudioError('Tap again to play');
            setPlaying(false);
          });
      } else {
        setPlaying(true);
      }
    }
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
  }

  function handleEnded() {
    setPlaying(false);
    setHasPlayed(true);
    setProgress(100);
  }

  return (
    <div className="flex flex-col bg-black" style={{ height: '100dvh', minHeight: '-webkit-fill-available', maxHeight: '100dvh', overflow: 'hidden' }}>
      <audio
        ref={audioRef}
        src={`${API_BASE}/cnu-audio/welcome.mp3`}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onCanPlay={() => setAudioError(null)}
        onError={(e) => {
          console.error('Audio element error:', e);
          setAudioError('Audio unavailable — check connection');
        }}
        preload="auto"
        playsInline
      />

      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(175,55%,10%)] to-black pointer-events-none" />

      {/* Center content — top-aligned with 20vh push, bottom cleared for pinned button */}
      <div className="relative flex-1 flex flex-col items-center justify-start px-6 gap-5 overflow-hidden" style={{ paddingTop: '20vh', paddingBottom: '8rem' }}>
        {/* Logo mark — smaller on tight screens */}
        <div className="flex flex-col items-center gap-2">
          <svg width="52" height="43" viewBox="0 0 100 82" fill="none">
            <line x1="45.1" y1="17.5" x2="16.9" y2="60.5" stroke="hsl(175,60%,55%)" strokeWidth="1.6" opacity="0.55"/>
            <line x1="54.9" y1="17.5" x2="83.1" y2="60.5" stroke="hsl(175,60%,55%)" strokeWidth="1.6" opacity="0.55"/>
            <polyline points="21,68 34,68 38,58 43,76 50,55 57,76 62,68 79,68" stroke="hsl(175,70%,65%)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="50" cy="10" r="9" fill="hsl(175,55%,42%)"/>
            <circle cx="50" cy="7.5" r="2.5" fill="hsl(175,70%,72%)"/>
            <path d="M44,14 Q44,11 50,11 Q56,11 56,14 Z" fill="hsl(175,70%,72%)"/>
            <circle cx="12" cy="68" r="9" fill="hsl(175,55%,42%)"/>
            <polygon points="12,61 7,66 17,66" fill="hsl(175,70%,72%)"/>
            <rect x="7" y="66" width="10" height="6" fill="hsl(175,70%,72%)"/>
            <rect x="10" y="68" width="4" height="4" rx="0.5" fill="hsl(175,35%,32%)"/>
            <circle cx="88" cy="68" r="9" fill="hsl(175,55%,42%)"/>
            <path d="M88,74 C85,71 80,68 80,64 C80,61.5 82,60 84,61.5 C85.5,62.5 87,64 88,65.5 C89,64 90.5,62.5 92,61.5 C94,60 96,61.5 96,64 C96,68 91,71 88,74 Z" fill="hsl(175,70%,72%)"/>
          </svg>
          <div className="text-center">
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
              Care<span style={{ color: 'hsl(175,70%,65%)' }}>Net</span>
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>University</div>
          </div>
        </div>

        <div className="text-center space-y-1 max-w-xs">
          <p className="text-white/90 text-sm leading-snug" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            A personal welcome from Becky
          </p>
          <p className="text-white/45 text-xs leading-relaxed">
            10+ years caregiving experience. She built this. She'll walk you through it.
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={togglePlay}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl transition-all"
            style={{ background: 'hsl(175,55%,28%)' }}
          >
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              {playing
                ? <div className="flex gap-1">
                    <div className="w-1.5 h-4 bg-white rounded-full" />
                    <div className="w-1.5 h-4 bg-white rounded-full" />
                  </div>
                : <Play size={16} className="text-white ml-0.5" />
              }
            </div>
            <span className="text-white font-semibold text-sm">
              {playing ? 'Pause' : hasPlayed ? 'Play Again' : 'Play Welcome'}
            </span>
          </button>

          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'hsl(175,70%,55%)' }} />
          </div>
          {audioError ? (
            <p className="text-center text-red-400 text-[10px]">{audioError}</p>
          ) : (
            <p className="text-center text-white/30 text-[10px]">~82 seconds</p>
          )}
        </div>
      </div>

      {/* Bottom button — absolutely pinned, always visible */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pt-3" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}>
        <button
          onClick={() => { audioRef.current?.pause(); onClose(); }}
          className={cn(
            "w-full py-3.5 rounded-2xl font-semibold text-sm transition-all",
            hasPlayed
              ? "bg-white text-[hsl(175,55%,22%)] hover:bg-white/90"
              : "bg-white/10 text-white/40"
          )}
        >
          {hasPlayed ? "Let's get started →" : "Skip for now"}
        </button>
        {!hasPlayed && (
          <p className="text-center text-white/25 text-[10px] mt-2">Listen to the welcome first for the best experience</p>
        )}
      </div>
    </div>
  );
}

// ── Lesson Viewer ─────────────────────────────────────────────────────────────
function LessonViewer({
  lesson, track, onClose, onComplete, isCompleted, onNext, hasNext, lessonIndex, totalLessons,
}: {
  lesson: Lesson; track: Track; onClose: () => void;
  onComplete: (id: string, points: number) => void; isCompleted: boolean;
  onNext: () => void; hasNext: boolean;
  lessonIndex: number; totalLessons: number;
}) {
  const [narratingBecky, setNarratingBecky] = useState(false);
  const [showText, setShowText] = useState(false);
  const [canComplete, setCanComplete] = useState(isCompleted);

  // Auto-play Becky when lesson opens
  useEffect(() => {
    setNarratingBecky(false);
    setShowText(false);
    setCanComplete(isCompleted);
    stopBecky();

    // Short delay so image renders first
    const t = setTimeout(async () => {
      setNarratingBecky(true);
      await speakBecky(lesson.narration);
      setNarratingBecky(false);
      setCanComplete(true); // allow completion once audio finishes
    }, 600);

    return () => {
      clearTimeout(t);
      stopBecky();
    };
  }, [lesson.id]);

  // Back button intercept — push a safe hash so the browser never surfaces
  // a stale verify-email URL when the user taps the phone back button.
  useEffect(() => {
    // Replace the current history entry with a clean university URL
    // so there's no dangerous previous entry to pop back to.
    const prevHash = window.location.hash;
    window.history.pushState({ lessonViewer: true }, "", "#/university");
    const handlePop = (e: PopStateEvent) => {
      if (e.state?.lessonViewer === undefined) {
        // They went back past our pushed state — restore hash and close
        window.history.pushState({ lessonViewer: true }, "", "#/university");
      }
      stopBecky();
      onClose();
    };
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
      // On unmount, leave hash at #/university (already there)
    };
  }, []);

  async function toggleNarration() {
    if (narratingBecky) {
      stopBecky();
      setNarratingBecky(false);
    } else {
      setNarratingBecky(true);
      await speakBecky(lesson.narration);
      setNarratingBecky(false);
      setCanComplete(true);
    }
  }

  function handleMarkComplete() {
    if (!isCompleted) onComplete(lesson.id, lesson.knowledgePoints);
  }

  function handleNext() {
    stopBecky();
    if (!isCompleted) onComplete(lesson.id, lesson.knowledgePoints);
    onNext();
  }

  // Track color as hex-ish for the gradient overlay
  const isTeal = track.id === "caregiver";
  const overlayColor = isTeal ? "hsl(175,55%,18%)" : "hsl(345,52%,22%)";

  return (
    <div className="flex flex-col bg-black" style={{ minHeight: '100dvh' }}>

      {/* Full-screen screenshot — no padding, fills the space */}
      <div className="absolute inset-0">
        <img
          src={lesson.image}
          alt={lesson.title}
          className="w-full h-full object-contain object-top"
        />
        {/* Gradient fade at bottom so controls are readable */}
        <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
          style={{ background: `linear-gradient(to top, ${overlayColor} 0%, transparent 100%)` }}
        />
      </div>

      {/* Example banner — subtle, top of screen */}
      <div className="relative flex items-center justify-center px-4 pt-3 pb-0">
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur px-3 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          <span className="text-white/40 text-[10px] tracking-wide">Example — not your live data</span>
        </div>
      </div>

      {/* Top bar — back + progress */}
      <div className="relative flex items-center justify-between px-4 pt-2 pb-3">
        <button
          onClick={() => { stopBecky(); onClose(); }}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>
        <div className="bg-black/40 backdrop-blur px-3 py-1.5 rounded-full">
          <span className="text-white/70 text-xs font-medium">{lessonIndex + 1} / {totalLessons}</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Bottom controls — overlaid on image */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-10 pt-4">

        {/* Lesson title + audio state */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">{lesson.subtitle}</p>
            <p className="text-white font-semibold text-base leading-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {lesson.title}
            </p>
          </div>
          {/* Audio status + replay */}
          <button
            onClick={toggleNarration}
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
              narratingBecky ? "bg-white/20 animate-pulse" : "bg-white/10 hover:bg-white/20"
            )}
          >
            {narratingBecky
              ? <Pause size={16} className="text-white" />
              : <Volume2 size={16} className="text-white/70" />
            }
          </button>
        </div>

        {/* Collapsed transcript toggle */}
        <button
          onClick={() => setShowText(v => !v)}
          className="text-white/35 text-[10px] mb-3 flex items-center gap-1 hover:text-white/60 transition-colors"
        >
          <ChevronRight size={10} className={cn("transition-transform", showText ? "rotate-90" : "")} />
          {showText ? "Hide transcript" : "Show transcript"}
        </button>

        {showText && (
          <div className="bg-black/60 backdrop-blur rounded-xl px-4 py-3 mb-3">
            <p className="text-white/80 text-xs leading-relaxed">{lesson.narration}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Always-visible Exit button */}
          <button
            onClick={() => { stopBecky(); onClose(); }}
            className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all flex-shrink-0"
            title="Exit lesson"
          >
            <X size={16} className="text-white/70" />
          </button>
          {!isCompleted && (
            <button
              onClick={handleMarkComplete}
              disabled={!canComplete}
              className={cn(
                "flex-1 py-3 rounded-2xl text-sm font-medium transition-all",
                canComplete ? "bg-white/15 text-white hover:bg-white/20" : "bg-white/5 text-white/20 cursor-not-allowed"
              )}
            >
              {canComplete ? "Mark Complete" : "Listening..."}
            </button>
          )}
          {hasNext && (
            <button
              onClick={handleNext}
              disabled={!canComplete}
              className={cn(
                "flex-1 py-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5",
                canComplete ? `${track.color} text-white hover:opacity-90` : "bg-white/10 text-white/20 cursor-not-allowed"
              )}
            >
              Next <ChevronRight size={14} />
            </button>
          )}
          {!hasNext && (
            <button
              onClick={() => { stopBecky(); handleMarkComplete(); onClose(); }}
              disabled={!canComplete && !isCompleted}
              className={cn(
                "flex-1 py-3 rounded-2xl text-sm font-semibold transition-all",
                (canComplete || isCompleted) ? `${track.color} text-white hover:opacity-90` : "bg-white/10 text-white/20 cursor-not-allowed"
              )}
            >
              {isCompleted ? "Track Complete ✓" : "Finish Track"}
            </button>
          )}
        </div>

        {/* Points */}
        <div className="flex items-center justify-center gap-1.5 mt-3 text-white/25 text-[10px]">
          <Award size={10} />
          +{lesson.knowledgePoints} pts · {lesson.duration}
          {isCompleted && <span className="text-emerald-400 ml-1">· ✓ Complete</span>}
        </div>
      </div>
    </div>
  );
}

// ── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ percent, color, size = 56 }: { percent: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted/30" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UniversityPage() {
  const { activeUser } = useApp();
  const isCG = ["caregiver", "multi_caregiver", "temp_caregiver"].includes(activeUser.role);
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";

  // If this is a demo-preview session (real user clicked "Go to University" from PreConnection),
  // clear the flag on unmount so navigating away from University returns them to PreConnection.
  useEffect(() => {
    return () => {
      sessionStorage.removeItem("cnp_demo_preview");
    };
  }, []);

  const [showGate, setShowGate] = useState<boolean>(() => !(window as any).__cnuVisited);
  const [activeLesson, setActiveLesson] = useState<{ lesson: Lesson; track: Track } | null>(null);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);

  const { data: progressData } = useQuery({
    queryKey: ["/api/university/progress", activeUser.id],
    queryFn: () => apiRequest("GET", `/api/university/progress/${activeUser.id}`).then(r => r.json()),
    staleTime: 30000,
  });

  const completeMutation = useMutation({
    mutationFn: ({ lessonId, trackId, knowledgePoints }: { lessonId: string; trackId: string; knowledgePoints: number }) =>
      apiRequest("POST", "/api/university/complete", { userId: activeUser.id, lessonId, trackId, knowledgePoints }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/progress", activeUser.id] });
    },
  });

  const completed: Set<string> = new Set(
    (progressData?.completed ?? []).map((r: any) => r.lessonId)
  );
  const totalPoints: number = progressData?.totalPoints ?? 0;

  function handleComplete(id: string, points: number) {
    const track = ALL_TRACKS.find(t => t.lessons.some(l => l.id === id));
    if (!track) return;
    completeMutation.mutate({ lessonId: id, trackId: track.id, knowledgePoints: points });
  }

  function handleGateClose() {
    (window as any).__cnuVisited = true;
    setShowGate(false);
  }

  function trackProgress(track: Track) {
    const done = track.lessons.filter(l => completed.has(l.id)).length;
    return Math.round((done / track.lessons.length) * 100);
  }

  const relevantTracks = isCG
    ? ALL_TRACKS  // caregivers see both tracks
    : ALL_TRACKS.filter(t => t.audience === "family" || t.audience === "both");

  if (showGate) return <WelcomeGate onClose={handleGateClose} />;

  // ── Track detail view ────────────────────────────────────────────────────
  if (activeTrack) {
    const progress = trackProgress(activeTrack);
    const doneLessons = activeTrack.lessons.filter(l => completed.has(l.id)).length;
    return (
      <div className="flex flex-col min-h-full">
        <div className={cn("px-4 pt-4 pb-5", activeTrack.color)}>
          <button onClick={() => setActiveTrack(null)} className="flex items-center gap-1 text-white/70 text-xs mb-3 hover:text-white">
            <ChevronLeft size={14} /> All Tracks
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white text-lg font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                {activeTrack.title}
              </h2>
              <p className="text-white/70 text-xs mt-0.5">{activeTrack.subtitle}</p>
            </div>
            <div className="relative flex items-center justify-center">
              <ProgressRing percent={progress} color="white" size={60} />
              <span className="absolute text-white text-xs font-bold">{progress}%</span>
            </div>
          </div>
          <div className="mt-2 text-white/60 text-xs">{doneLessons} of {activeTrack.lessons.length} lessons complete</div>
        </div>

        <div className="flex-1 p-4 space-y-3 pb-8">
          {activeTrack.lessons.map((lesson, idx) => {
            const done = completed.has(lesson.id);
            return (
              <button
                key={lesson.id}
                onClick={() => setActiveLesson({ lesson, track: activeTrack })}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                  done ? "bg-muted/30 border-border" : "bg-background border-border hover:border-foreground/20 hover:bg-muted/20"
                )}
              >
                <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  <img src={lesson.image} alt="" className="w-full h-full object-cover object-top" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-muted-foreground truncate">{lesson.subtitle}</div>
                  <div className="text-sm font-medium truncate">{lesson.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{lesson.duration}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className={cn("text-[10px] font-medium", activeTrack.accentColor)}>+{lesson.knowledgePoints} pts</span>

                  </div>
                </div>
                <div className="flex-shrink-0">
                  {done
                    ? <CheckCircle2 size={18} className="text-emerald-500" />
                    : <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", activeTrack.color)}>
                        <Play size={12} className="text-white ml-0.5" />
                      </div>
                  }
                </div>
              </button>
            );
          })}
        </div>

        {activeLesson && (() => {
          const idx = activeLesson.track.lessons.findIndex(l => l.id === activeLesson.lesson.id);
          const nextLesson = activeLesson.track.lessons[idx + 1] ?? null;
          return (
            <LessonViewer
              lesson={activeLesson.lesson}
              track={activeLesson.track}
              onClose={() => setActiveLesson(null)}
              onComplete={handleComplete}
              isCompleted={completed.has(activeLesson.lesson.id)}
              lessonIndex={idx}
              totalLessons={activeLesson.track.lessons.length}
              hasNext={!!nextLesson}
              onNext={() => nextLesson && setActiveLesson({ lesson: nextLesson, track: activeLesson.track })}
            />
          );
        })()}
      </div>
    );
  }

  // ── Main hub ─────────────────────────────────────────────────────────────
  const allLessons = ALL_TRACKS.flatMap(t => t.lessons);
  const totalPossible = allLessons.reduce((s, l) => s + l.knowledgePoints, 0);
  const overallPct = Math.round((totalPoints / Math.max(totalPossible, 1)) * 100);

  return (
    <div className="p-4 space-y-5 max-w-xl mx-auto pb-10">
      <div className="flex items-center gap-3 pt-1">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
          <GraduationCap size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Care Net University
          </h1>
          <p className="text-xs text-muted-foreground">Short lessons. Real confidence.</p>
        </div>
      </div>

      <Card className="border-border bg-gradient-to-br from-primary/5 to-background">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                {totalPoints} <span className="text-base font-normal text-muted-foreground">/ {totalPossible} pts</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Knowledge points earned</div>
              <div className="text-xs text-muted-foreground">
                {allLessons.filter(l => completed.has(l.id)).length} of {allLessons.length} lessons complete
              </div>
            </div>
            <div className="relative flex items-center justify-center">
              <ProgressRing percent={overallPct} color="hsl(175,55%,28%)" size={68} />
              <span className="absolute text-sm font-bold">{overallPct}%</span>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${overallPct}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Learning Tracks</h2>
        {relevantTracks.map(track => {
          const prog = trackProgress(track);
          const done = track.lessons.filter(l => completed.has(l.id)).length;
          const Icon = track.icon;
          return (
            <button
              key={track.id}
              onClick={() => setActiveTrack(track)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all hover:scale-[1.01]",
                track.borderColor, "bg-background hover:bg-muted/20"
              )}
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", track.color)}>
                <Icon size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  {track.title}
                </div>
                <div className="text-xs text-muted-foreground">{track.subtitle}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", track.color)} style={{ width: `${prog}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{done}/{track.lessons.length}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground/60 pb-2 leading-relaxed px-4">
        Knowledge points count toward your Care Badge score.<br/>Complete all lessons in a track for a bonus.
      </p>
    </div>
  );
}
