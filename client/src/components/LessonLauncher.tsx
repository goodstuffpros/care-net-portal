/**
 * LessonLauncher — contextual "How this works" button for any page.
 *
 * Usage:
 *   <LessonLauncher pageKey="schedule" />
 *
 * Behaviour:
 *   - Prominent teal/rose pill near top if lesson NOT yet completed
 *   - Small icon-only button once lesson is completed (stays forever, never removed)
 *   - Opens the full-screen LessonViewer inline (same as CNU)
 *   - CG role → CG lesson, family role → family lesson for same section
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { GraduationCap, Play, CheckCircle2, Pause, Square, Volume2, ChevronRight, Award, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, API_BASE, STATIC_BASE } from "@/lib/queryClient";
import { useApp } from "@/App";
import { speakBecky, stopBecky, pauseBecky, resumeBecky, isBeckyPlaying } from "@/lib/ttsUtils";

// ── Types (mirror University.tsx) ─────────────────────────────────────────────
interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  narration: string;
  duration: string;
  knowledgePoints: number;
}

interface LessonMap {
  cgLessonId: string;
  familyLessonId: string | null;
}

// ── Page → lesson mapping ─────────────────────────────────────────────────────
const PAGE_MAP: Record<string, LessonMap> = {
  schedule:    { cgLessonId: "mod05_schedule",   familyLessonId: "fc_04" },
  activity:    { cgLessonId: "mod06_carelog",    familyLessonId: "fc_03" },
  medications: { cgLessonId: "mod07_medications", familyLessonId: "fc_05" },
  messages:    { cgLessonId: "mod09_messages",   familyLessonId: "fc_06" },
  vitals:      { cgLessonId: "mod08_vitals",     familyLessonId: "fc_07" },
  archive:     { cgLessonId: "mod12_archive",    familyLessonId: null },
  carescope:   { cgLessonId: "mod11_carescope",  familyLessonId: null },
  wellbeing:   { cgLessonId: "mod20_wellbeing",  familyLessonId: null },
  badges:      { cgLessonId: "mod16_badges",     familyLessonId: null },
  media:       { cgLessonId: "mod13_media",      familyLessonId: null },
  outings:     { cgLessonId: "mod14_outings",    familyLessonId: null },
  thoughts:    { cgLessonId: "mod15_thoughts",   familyLessonId: null },
  notes:       { cgLessonId: "mod10_notifications", familyLessonId: "fc_08" },
  handoff:     { cgLessonId: "mod17_handoff",    familyLessonId: null },
  documents:   { cgLessonId: "mod_documents",     familyLessonId: "fc_documents" },
  caregivers:  { cgLessonId: "mod18_caregivers",  familyLessonId: null },
  "client-portal": { cgLessonId: "mod03_client_profile", familyLessonId: null },
};

// ── All lesson data (duplicated here so component is self-contained) ───────────
const ALL_LESSONS: Lesson[] = [
  { id: "mod03_client_profile", title: "Client Profile", subtitle: "Module 3 · Core Onboarding", image: `${STATIC_BASE}/university/new_cg_client_profile.jpg`, narration: "The Client Portal is the full profile for the person in your care. Background, preferences, medical history, emergency contacts, and care instructions all live here. Keep this complete — it is the foundation of everything the care team needs to know.", duration: "3 min", knowledgePoints: 4 },
  { id: "mod05_schedule",    title: "Schedule — Creation & Management",   subtitle: "Module 5 · Core Onboarding",  image: `${STATIC_BASE}/university/new_cg_schedule.jpg`,         narration: "The Schedule keeps every caregiver and family member aligned on coverage. Tap the plus to add a shift or appointment. Set the date, time, and priority level. The Main Contact can also add appointments — you will receive an urgent red alert immediately so nothing gets missed.", duration: "4 min", knowledgePoints: 5 },
  { id: "mod06_carelog",     title: "Care Log — Creation & Management",   subtitle: "Module 6 · Core Onboarding",  image: `${STATIC_BASE}/university/new_cg_carelog.jpg`,      narration: "The Care Log is the heart of the platform. Every shift gets a documented entry — what happened, what you observed, how the client was feeling. Fill in the title, write the full narrative, then set the priority. Normal for routine entries, Important for things the family should know, Urgent for anything requiring immediate attention.", duration: "4 min", knowledgePoints: 5 },
  { id: "mod07_medications", title: "Medications — Creation & Management", subtitle: "Module 7 · Core Onboarding", image: `${STATIC_BASE}/university/new_cg_medications.jpg`,      narration: "Medications are grouped by time of day — Morning, Afternoon, and Evening — in alphabetical order. Each card shows name, dosage, prescribing doctor, and pharmacy. Tap a card to see the Rx number and admin log. As caregiver, you can add new medications. The Main Contact will receive an urgent alert when you do.", duration: "4 min", knowledgePoints: 5 },
  { id: "mod08_vitals",      title: "Vitals — Tracking & Logging",        subtitle: "Module 8 · Daily Use",        image: `${STATIC_BASE}/university/new_cg_vitals.jpg`,           narration: "Vitals tracks your client's key health readings over time. Today's values appear at the top — blood pressure, heart rate, oxygen, temperature, and weight. Trend charts below show the past 30 days. Readings outside the normal range are highlighted automatically. Tap the plus to log a new reading.", duration: "3 min", knowledgePoints: 4 },
  { id: "mod09_messages",    title: "Messages — Sending & Managing",      subtitle: "Module 9 · Daily Use",        image: `${STATIC_BASE}/university/new_cg_messages.jpg`,         narration: "Messages are organized by thread so every conversation has context. Tap any thread to read and reply. Tap New Thread — the green button — to start a fresh conversation with the family or care team. Threads can also be opened directly from a Care Log entry or a note using the Discuss button.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod10_notifications", title: "Notifications — Settings & Alerts", subtitle: "Module 10 · Daily Use",    image: `${STATIC_BASE}/university/new_cg_notes.jpg`,         narration: "Tap the bell in the top right to see all your alerts. Red alerts require immediate attention — these include urgent Care Log entries, schedule changes added by the family, and new medications. Yellow flags are informational. Configure which alerts you receive in your notification settings to keep your feed focused.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod11_carescope",   title: "Care Scope — Flagging & Rating",     subtitle: "Module 11 · Daily Use",      image: `${STATIC_BASE}/university/new_cg_carescope.jpg`,        narration: "Care Scope is the accountability system built into the platform. The Scope tab defines your care plan. The Flagging tab controls which categories can generate yellow flags. A yellow flag is triggered when an action falls outside the expected timeframe. Three yellows in the same category within 30 days becomes a red flag. Families can turn flagging off for specific categories.", duration: "3 min", knowledgePoints: 5 },
  { id: "mod12_archive",     title: "Archive & CareNet Summaries",             subtitle: "Module 12 · Daily Use",      image: `${STATIC_BASE}/university/new_cg_archive.jpg`,          narration: "The Archive stores all past shift summaries and generated reports. Tap Generate Summary — the green button — to create a new report from recent Care Log entries and Schedule data. CareNet reads the documentation and produces a structured summary you can share with family, physicians, or agencies.", duration: "4 min", knowledgePoints: 5 },
  { id: "mod_documents",     title: "Document Vault",                      subtitle: "Module · Daily Use",         image: `${STATIC_BASE}/university/new_cg_documents.jpg`,             narration: "The Document Vault is a secure place to store anything important to the care relationship — insurance cards, advance directives, medication lists, physician letters, and identification documents. Upload a file by tapping Add Document, choose the category, and save. Confidential documents are marked with a lock and only visible to caregivers. Family members can view non-confidential uploads at any time.", duration: "2 min", knowledgePoints: 3 },
  { id: "fc_documents",     title: "Document Vault",                      subtitle: "Family Track · Documents",    image: `${STATIC_BASE}/university/new_fc_documents.jpg`,             narration: "The Document Vault holds important records for your loved one's care — insurance cards, medical letters, advance directives, and more. As Main Contact, you can upload documents directly. Your caregiver will be able to see and reference them. Confidential items are marked with a lock.", duration: "1 min", knowledgePoints: 2 },
  { id: "mod13_media",       title: "Media Library",                      subtitle: "Module 13 · Daily Use",      image: `${STATIC_BASE}/university/new_cg_media.jpg`,        narration: "The Media Library is a shared space for photos and documents relevant to your client's care. Upload wound photos, therapy materials, identification documents, or any visual record that helps the family stay informed. All authorized care team members can view what has been uploaded.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod14_outings",     title: "Outings — Planning & Logging",       subtitle: "Module 14 · Daily Use",      image: `${STATIC_BASE}/university/new_cg_outings.jpg`,         narration: "Outings let you plan and document time outside the home. Add the destination, planned duration, and any preparation notes beforehand. After the outing, log how it went — including the client's response, any notable moments, and whether a follow-up is needed. Families appreciate this documentation.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod15_thoughts",    title: "Collection of Thoughts",             subtitle: "Module 15 · Caregiver Only", image: `${STATIC_BASE}/university/new_cg_thoughts.jpg`,         narration: "Collection of Thoughts captures what your client shares with you — their stories, memories, and reflections that surface during the hours you spend together. Stories from a lifetime. Their hometown, their parents, how they met their spouse, moments their own children may never have heard. You have a bond with this person that opens doors no one else can. Write what they share, in their words, as best you can. It does not need to be complete. Even fragments are worth saving. When care concludes, you can gift the entire collection to the family. It is their loved one's voice — preserved through you.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod16_badges",      title: "Badges — Recognition & Milestones",  subtitle: "Module 16 · Recognition",   image: `${STATIC_BASE}/university/new_cg_badges.jpg`,           narration: "Your Care Badge measures performance across four dimensions: Communication at 22 percent, Dependability at 28 percent, Knowledge at 18 percent, and Connection at 32 percent. Scoring is mathematical — based on documentation frequency, response times, and care activity — not subjective ratings. The percentage shown inside the portal is your raw score. The hearts shown publicly in Care Connections are derived from that score.", duration: "2 min", knowledgePoints: 4 },
  { id: "mod17_handoff",    title: "Shift Handoff — End-of-Shift Summary", subtitle: "Module 17 · Daily Use", image: `${STATIC_BASE}/university/new_cg_handoff.jpg`, narration: "The Shift Handoff pulls together everything from your current shift into a single report. Tap Generate Report and CareNet will compile the medications administered, any Care Log incidents, the client's mood and activity, upcoming schedule items, and open notes — all in one place. You can add a personal message before submitting. The incoming caregiver and family receive it automatically. A completed handoff is one of the most professional things you can do at the end of a shift.", duration: "3 min", knowledgePoints: 4 },
  { id: "mod18_caregivers",  title: "Care Team — Managing Access",         subtitle: "Module 18 · Setup",     image: `${STATIC_BASE}/university/new_cg_caregivers.jpg`, narration: "The Care Team page shows everyone with access to this client's portal — caregivers, family members, and contacts. To add a new caregiver, tap Add Member and enter their name and email. They will receive an invitation to join. You can also remove access for anyone who is no longer part of the care team. Keeping this list current ensures the right people see the right information.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod20_wellbeing",   title: "Wellbeing — Need a Friend",          subtitle: "Module 20 · Care for the Caregiver", image: `${STATIC_BASE}/university/new_cg_wellbeing.jpg`, narration: "This one is personal. Caregiving is one of the hardest jobs there is — and one of the loneliest. My Wellbeing is a private space built specifically for you. Tap Need a Friend anytime you need a moment to be heard. What you write is completely private. You can choose a text response or a voice response. After you share, I will ask how you are feeling — and I will respond with something real, not a script. You deserve support too. That is why this is here.", duration: "3 min", knowledgePoints: 4 },
  // Family lessons
  { id: "fc_03", title: "Reading the Care Log",        subtitle: "Family Track · Care Log",  image: `${STATIC_BASE}/university/new_fc_carelog.jpg`,   narration: "The Care Log shows everything your caregiver has documented. Each entry has a priority dot — green for Normal, yellow for Important, red for Urgent. Tap any entry to read the full text. As Main Contact, you can also add your own entries directly.", duration: "25 sec", knowledgePoints: 3 },
  { id: "fc_04", title: "Schedule & Appointments",     subtitle: "Family Track · Schedule",  image: `${STATIC_BASE}/university/new_fc_schedule.jpg`,  narration: "As Main Contact, you can add appointments directly to the Schedule. Tap the plus button, enter the details, and save. Your caregiver receives an urgent red alert immediately — so nothing is ever missed between you.", duration: "20 sec", knowledgePoints: 2 },
  { id: "fc_05", title: "Medication Regimen",          subtitle: "Family Track · Medications", image: `${STATIC_BASE}/university/new_fc_medications.jpg`, narration: "Medications are grouped by Morning, Afternoon, and Evening. Tap any card to see the dosage, prescribing doctor, and pharmacy. As Main Contact you can add new medications — your caregiver will receive an urgent alert when you do.", duration: "20 sec", knowledgePoints: 2 },
  { id: "fc_06", title: "Messages & Discuss",          subtitle: "Family Track · Messages",  image: `${STATIC_BASE}/university/new_fc_messages.jpg`,  narration: "Start a new thread to reach the caregiver or care team directly. The green New Thread button opens a fresh conversation. The Discuss button on Care Log entries and notes opens a message thread tied to that specific context — so your caregiver knows exactly what you are referring to.", duration: "25 sec", knowledgePoints: 3 },
  { id: "fc_07", title: "Vitals & Health",             subtitle: "Family Track · Vitals",    image: `${STATIC_BASE}/university/new_fc_vitals.jpg`,    narration: "Vitals gives you a real-time view of your loved one's health readings. Today's values appear at the top. Trend charts below show the past 30 days so you can spot patterns. Readings outside the normal range are highlighted automatically.", duration: "20 sec", knowledgePoints: 2 },
  { id: "fc_08", title: "Notes, Resolving & Discussing", subtitle: "Family Track · Notes",   image: `${STATIC_BASE}/university/new_fc_carelog.jpg`,    narration: "Misc Notes are shared observations and reminders. Mark a note Resolved when it has been handled. Tap Discuss to open a message thread directly tied to that note — no context is ever lost between you and the caregiver.", duration: "25 sec", knowledgePoints: 3 },
];

const LESSON_BY_ID = Object.fromEntries(ALL_LESSONS.map(l => [l.id, l]));

// ── Inline Lesson Viewer (single-lesson, no Next) ─────────────────────────────
function InlineLessonViewer({
  lesson, isFamily, isCompleted, onComplete, onClose,
}: {
  lesson: Lesson; isFamily: boolean; isCompleted: boolean;
  onComplete: (id: string, pts: number) => void; onClose: () => void;
}) {
  const [audioState, setAudioState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [showText, setShowText] = useState(false);
  const [canComplete, setCanComplete] = useState(isCompleted);

  const overlayColor = isFamily ? "hsl(345,52%,22%)" : "hsl(175,55%,18%)";
  const btnColor    = isFamily ? "bg-rose-600"       : "bg-teal-600";

  useEffect(() => {
    setAudioState("idle");
    setShowText(false);
    setCanComplete(isCompleted);
    stopBecky();

    const t = setTimeout(async () => {
      setAudioState("loading");
      await speakBecky(lesson.narration);
      setAudioState(isBeckyPlaying() ? "playing" : "idle");
      setCanComplete(true);
    }, 500);

    return () => { clearTimeout(t); stopBecky(); };
  }, [lesson.id]);

  // Keep audioState in sync with actual playback
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioState === "playing" && !isBeckyPlaying()) {
        setAudioState("idle");
        setCanComplete(true);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [audioState]);

  // back-button intercept + stop on unmount
  useEffect(() => {
    window.history.pushState({ inlineLessonViewer: true }, "");
    const handlePop = () => { stopBecky(); onClose(); };
    window.addEventListener("popstate", handlePop);
    return () => {
      stopBecky();
      window.removeEventListener("popstate", handlePop);
      if (window.history.state?.inlineLessonViewer) window.history.back();
    };
  }, []);

  async function handlePlay() {
    if (audioState === "paused") {
      resumeBecky();
      setAudioState("playing");
    } else {
      setAudioState("loading");
      await speakBecky(lesson.narration);
      setAudioState("idle");
      setCanComplete(true);
    }
  }

  function handlePause() {
    pauseBecky();
    setAudioState("paused");
  }

  function handleStop() {
    stopBecky();
    setAudioState("idle");
  }

  function handleDone() {
    stopBecky();
    if (!isCompleted) onComplete(lesson.id, lesson.knowledgePoints);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-black">
      {/* Screenshot fills screen */}
      <div className="absolute inset-0">
        <img src={lesson.image} alt={lesson.title} className="w-full h-full object-contain object-top" />
        <div className="absolute bottom-0 left-0 right-0 h-52 pointer-events-none"
          style={{ background: `linear-gradient(to top, ${overlayColor} 0%, transparent 100%)` }} />
      </div>

      {/* Example banner */}
      <div className="relative flex items-center justify-center px-4 pt-3 pb-0">
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur px-3 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          <span className="text-white/40 text-[10px] tracking-wide">Example — not your live data</span>
        </div>
      </div>

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-4 pt-2 pb-3">
        <button onClick={() => { stopBecky(); onClose(); }}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="bg-black/40 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5">
          <GraduationCap size={11} className="text-white/60" />
          <span className="text-white/70 text-xs font-medium">How this works</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-10 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">{lesson.subtitle}</p>
            <p className="text-white font-semibold text-base leading-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {lesson.title}
            </p>
          </div>
          {/* Audio controls: Play / Pause / Stop */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {audioState === "playing" ? (
              <button onClick={handlePause}
                className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all">
                <Pause size={15} className="text-white" />
              </button>
            ) : (
              <button onClick={handlePlay}
                className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  audioState === "loading" ? "bg-white/10 animate-pulse" : "bg-white/10 hover:bg-white/20")}>
                {audioState === "loading"
                  ? <Volume2 size={15} className="text-white/50 animate-pulse" />
                  : <Play size={15} className="text-white/80" />}
              </button>
            )}
            {(audioState === "playing" || audioState === "paused") && (
              <button onClick={handleStop}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                <Square size={12} className="text-white/60" />
              </button>
            )}
          </div>
        </div>

        <button onClick={() => setShowText(v => !v)}
          className="text-white/35 text-[10px] mb-3 flex items-center gap-1 hover:text-white/60 transition-colors">
          <ChevronRight size={10} className={cn("transition-transform", showText ? "rotate-90" : "")} />
          {showText ? "Hide transcript" : "Show transcript"}
        </button>

        {showText && (
          <div className="bg-black/60 backdrop-blur rounded-xl px-4 py-3 mb-3">
            <p className="text-white/80 text-xs leading-relaxed">{lesson.narration}</p>
          </div>
        )}

        <button onClick={handleDone} disabled={!canComplete}
          className={cn("w-full py-3 rounded-2xl text-sm font-semibold transition-all",
            canComplete ? `${btnColor} text-white hover:opacity-90` : "bg-white/10 text-white/20 cursor-not-allowed")}>
          {canComplete
            ? isCompleted ? "Got it ✓" : "Got it — mark complete"
            : "Listening..."}
        </button>

        <div className="flex items-center justify-center gap-1.5 mt-3 text-white/25 text-[10px]">
          <Award size={10} />
          +{lesson.knowledgePoints} pts · {lesson.duration}
          {isCompleted && <span className="text-emerald-400 ml-1">· ✓ Already earned</span>}
        </div>
      </div>
    </div>
  );
}

// ── Dismiss helpers (localStorage) ──────────────────────────────────────────
function dismissedKey(pageKey: string, userId: number) {
  return `pt_dismissed_${userId}_${pageKey}`;
}
function firstSeenKey(pageKey: string, userId: number) {
  return `pt_first_seen_${userId}_${pageKey}`;
}
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// ── Public component ───────────────────────────────────────────────────────────
export function LessonLauncher({ pageKey, className: extraClass }: { pageKey: string; className?: string }) {
  const { activeUser } = useApp();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);

  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";

  const mapping = PAGE_MAP[pageKey];

  // Record first-seen timestamp on mount
  useEffect(() => {
    if (!activeUser?.id || !mapping) return;
    const fsk = firstSeenKey(pageKey, activeUser.id);
    if (!localStorage.getItem(fsk)) {
      localStorage.setItem(fsk, Date.now().toString());
    }
    // Re-check visibility in case of 14-day expiry
    const dk = dismissedKey(pageKey, activeUser.id);
    if (localStorage.getItem(dk)) { setVisible(false); return; }
    const firstSeen = parseInt(localStorage.getItem(fsk) ?? "0", 10);
    if (firstSeen && Date.now() - firstSeen > FOURTEEN_DAYS_MS) {
      setVisible(false);
    }
  }, [pageKey, activeUser?.id]);

  if (!mapping) return null;

  // Family uses their specific lesson if one exists, otherwise falls back to CG lesson
  const lessonId = (isFamily && mapping.familyLessonId)
    ? mapping.familyLessonId
    : mapping.cgLessonId;

  const lesson = LESSON_BY_ID[lessonId];
  if (!lesson) return null;

  const { data: progressData } = useQuery({
    queryKey: ["/api/university/progress", activeUser.id],
    queryFn: () => apiRequest("GET", `/api/university/progress/${activeUser.id}`).then(r => r.json()),
    staleTime: 60000,
  });

  const completeMutation = useMutation({
    mutationFn: ({ lessonId, knowledgePoints }: { lessonId: string; knowledgePoints: number }) =>
      apiRequest("POST", "/api/university/complete", {
        userId: activeUser.id,
        lessonId,
        trackId: isFamily ? "family" : "caregiver",
        knowledgePoints,
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/university/progress", activeUser.id] }),
  });

  const completed = (progressData?.completed ?? []).some((r: any) => r.lessonId === lessonId);

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    localStorage.setItem(dismissedKey(pageKey, activeUser.id), "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      {/* Red "Page Tutorial" pill — centered above the page CTA, mb-2 gives uniform gap to CTA below */}
      <div className={cn("flex items-center justify-center w-full mb-2", extraClass)}>
        <div className="flex items-center gap-0 rounded-full overflow-hidden shadow-sm">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            <GraduationCap size={13} />
            Page Tutorial
            {completed
              ? <CheckCircle2 size={11} className="opacity-80" />
              : <Play size={10} className="opacity-80" />}
          </button>
          <button
            onClick={handleDismiss}
            className="flex items-center justify-center bg-red-700 hover:bg-red-800 text-white/80 hover:text-white px-2 py-1.5 transition-colors"
            title="Remove tutorial button"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {open && (
        <InlineLessonViewer
          lesson={lesson}
          isFamily={isFamily}
          isCompleted={completed}
          onComplete={(id, pts) => completeMutation.mutate({ lessonId: id, knowledgePoints: pts })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
