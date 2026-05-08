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
import { GraduationCap, Play, CheckCircle2, Pause, Volume2, ChevronRight, Award } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
import { useApp } from "@/App";
import { speakBecky, stopBecky } from "@/lib/ttsUtils";

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
  handoff:     { cgLessonId: "mod11_carescope",  familyLessonId: null },
};

// ── All lesson data (duplicated here so component is self-contained) ───────────
const ALL_LESSONS: Lesson[] = [
  { id: "mod05_schedule",    title: "Schedule — Creation & Management",   subtitle: "Module 5 · Core Onboarding",  image: `${API_BASE}/university/seed_mod05_schedule.jpg`,         narration: "The Schedule keeps every caregiver and family member aligned on coverage. Tap the plus to add a shift or appointment. Set the date, time, and priority level. The Main Contact can also add appointments — you will receive an urgent red alert immediately so nothing gets missed.", duration: "4 min", knowledgePoints: 5 },
  { id: "mod06_carelog",     title: "Care Log — Creation & Management",   subtitle: "Module 6 · Core Onboarding",  image: `${API_BASE}/university/seed_mod06_carelog_list.jpg`,      narration: "The Care Log is the heart of the platform. Every shift gets a documented entry — what happened, what you observed, how the client was feeling. Fill in the title, write the full narrative, then set the priority. Normal for routine entries, Important for things the family should know, Urgent for anything requiring immediate attention.", duration: "4 min", knowledgePoints: 5 },
  { id: "mod07_medications", title: "Medications — Creation & Management", subtitle: "Module 7 · Core Onboarding", image: `${API_BASE}/university/seed_mod07_medications.jpg`,      narration: "Medications are grouped by time of day — Morning, Afternoon, and Evening — in alphabetical order. Each card shows name, dosage, prescribing doctor, and pharmacy. Tap a card to see the Rx number and admin log. As caregiver, you can add new medications. The Main Contact will receive an urgent alert when you do.", duration: "4 min", knowledgePoints: 5 },
  { id: "mod08_vitals",      title: "Vitals — Tracking & Logging",        subtitle: "Module 8 · Daily Use",        image: `${API_BASE}/university/seed_mod08_vitals.jpg`,           narration: "Vitals tracks your client's key health readings over time. Today's values appear at the top — blood pressure, heart rate, oxygen, temperature, and weight. Trend charts below show the past 30 days. Readings outside the normal range are highlighted automatically. Tap the plus to log a new reading.", duration: "3 min", knowledgePoints: 4 },
  { id: "mod09_messages",    title: "Messages — Sending & Managing",      subtitle: "Module 9 · Daily Use",        image: `${API_BASE}/university/seed_mod09_messages.jpg`,         narration: "Messages are organized by thread so every conversation has context. Tap any thread to read and reply. Tap New Thread — the green button — to start a fresh conversation with the family or care team. Threads can also be opened directly from a Care Log entry or a note using the Discuss button.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod10_notifications", title: "Notifications — Settings & Alerts", subtitle: "Module 10 · Daily Use",    image: `${API_BASE}/university/seed_mod10_notifications.jpg`,         narration: "Tap the bell in the top right to see all your alerts. Red alerts require immediate attention — these include urgent Care Log entries, schedule changes added by the family, and new medications. Yellow flags are informational. Configure which alerts you receive in your notification settings to keep your feed focused.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod11_carescope",   title: "Care Scope — Flagging & Rating",     subtitle: "Module 11 · Daily Use",      image: `${API_BASE}/university/seed_mod11_carescope.jpg`,        narration: "Care Scope is the accountability system built into the platform. The Scope tab defines your care plan. The Flagging tab controls which categories can generate yellow flags. A yellow flag is triggered when an action falls outside the expected timeframe. Three yellows in the same category within 30 days becomes a red flag. Families can turn flagging off for specific categories.", duration: "3 min", knowledgePoints: 5 },
  { id: "mod12_archive",     title: "Archive & AI Summaries",             subtitle: "Module 12 · Daily Use",      image: `${API_BASE}/university/seed_mod12_archive.jpg`,          narration: "The Archive stores all past shift summaries and generated reports. Tap Generate Summary — the green button — to create a new report from recent Care Log entries and Schedule data. AI reads the documentation and produces a structured summary you can share with family, physicians, or agencies.", duration: "4 min", knowledgePoints: 5 },
  { id: "mod13_media",       title: "Media Library",                      subtitle: "Module 13 · Daily Use",      image: `${API_BASE}/university/seed_mod10_notifications.jpg`,        narration: "The Media Library is a shared space for photos and documents relevant to your client's care. Upload wound photos, therapy materials, identification documents, or any visual record that helps the family stay informed. All authorized care team members can view what has been uploaded.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod14_outings",     title: "Outings — Planning & Logging",       subtitle: "Module 14 · Daily Use",      image: `${API_BASE}/university/seed_mod05_schedule.jpg`,         narration: "Outings let you plan and document time outside the home. Add the destination, planned duration, and any preparation notes beforehand. After the outing, log how it went — including the client's response, any notable moments, and whether a follow-up is needed. Families appreciate this documentation.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod15_thoughts",    title: "Collection of Thoughts",             subtitle: "Module 15 · Caregiver Only", image: `${API_BASE}/university/seed_mod15_thoughts.jpg`,         narration: "Collection of Thoughts is your private caregiver journal — visible only to you. No family member or admin can see anything written here. Use it to process difficult days, capture observations you are still working through, or reflect on moments you want to remember. You can optionally let AI lightly polish your writing before you save it.", duration: "2 min", knowledgePoints: 3 },
  { id: "mod16_badges",      title: "Badges — Recognition & Milestones",  subtitle: "Module 16 · Recognition",   image: `${API_BASE}/university/seed_mod16_badges.jpg`,           narration: "Your Care Badge measures performance across four dimensions: Communication at 22 percent, Dependability at 28 percent, Knowledge at 18 percent, and Connection at 32 percent. Scoring is mathematical — based on documentation frequency, response times, and care activity — not subjective ratings. The percentage shown inside the portal is your raw score. The hearts shown publicly in Care Connections are derived from that score.", duration: "2 min", knowledgePoints: 4 },
  { id: "mod20_wellbeing",   title: "Wellbeing — Need a Friend",          subtitle: "Module 20 · Care for the Caregiver", image: `${API_BASE}/university/seed_mod20_wellbeing.jpg`, narration: "This one is personal. Caregiving is one of the hardest jobs there is — and one of the loneliest. My Wellbeing is a private space built specifically for you. Tap Need a Friend anytime you need a moment to be heard. What you write is completely private. You can choose a text response or a voice response. After you share, I will ask how you are feeling — and I will respond with something real, not a script. You deserve support too. That is why this is here.", duration: "3 min", knowledgePoints: 4 },
  // Family lessons
  { id: "fc_03", title: "Reading the Care Log",        subtitle: "Family Track · Care Log",  image: `${API_BASE}/university/seed_fc03_carelog.jpg`,   narration: "The Care Log shows everything your caregiver has documented. Each entry has a priority dot — green for Normal, yellow for Important, red for Urgent. Tap any entry to read the full text. As Main Contact, you can also add your own entries directly.", duration: "25 sec", knowledgePoints: 3 },
  { id: "fc_04", title: "Schedule & Appointments",     subtitle: "Family Track · Schedule",  image: `${API_BASE}/university/seed_fc04_schedule.jpg`,  narration: "As Main Contact, you can add appointments directly to the Schedule. Tap the plus button, enter the details, and save. Your caregiver receives an urgent red alert immediately — so nothing is ever missed between you.", duration: "20 sec", knowledgePoints: 2 },
  { id: "fc_05", title: "Medication Regimen",          subtitle: "Family Track · Medications", image: `${API_BASE}/university/seed_fc05_medications.jpg`, narration: "Medications are grouped by Morning, Afternoon, and Evening. Tap any card to see the dosage, prescribing doctor, and pharmacy. As Main Contact you can add new medications — your caregiver will receive an urgent alert when you do.", duration: "20 sec", knowledgePoints: 2 },
  { id: "fc_06", title: "Messages & Discuss",          subtitle: "Family Track · Messages",  image: `${API_BASE}/university/seed_fc06_messages.jpg`,  narration: "Start a new thread to reach the caregiver or care team directly. The green New Thread button opens a fresh conversation. The Discuss button on Care Log entries and notes opens a message thread tied to that specific context — so your caregiver knows exactly what you are referring to.", duration: "25 sec", knowledgePoints: 3 },
  { id: "fc_07", title: "Vitals & Health",             subtitle: "Family Track · Vitals",    image: `${API_BASE}/university/seed_fc07_vitals.jpg`,    narration: "Vitals gives you a real-time view of your loved one's health readings. Today's values appear at the top. Trend charts below show the past 30 days so you can spot patterns. Readings outside the normal range are highlighted automatically.", duration: "20 sec", knowledgePoints: 2 },
  { id: "fc_08", title: "Notes, Resolving & Discussing", subtitle: "Family Track · Notes",   image: `${API_BASE}/university/seed_fc08_notes.jpg`,    narration: "Misc Notes are shared observations and reminders. Mark a note Resolved when it has been handled. Tap Discuss to open a message thread directly tied to that note — no context is ever lost between you and the caregiver.", duration: "25 sec", knowledgePoints: 3 },
];

const LESSON_BY_ID = Object.fromEntries(ALL_LESSONS.map(l => [l.id, l]));

// ── Inline Lesson Viewer (single-lesson, no Next) ─────────────────────────────
function InlineLessonViewer({
  lesson, isFamily, isCompleted, onComplete, onClose,
}: {
  lesson: Lesson; isFamily: boolean; isCompleted: boolean;
  onComplete: (id: string, pts: number) => void; onClose: () => void;
}) {
  const [narratingBecky, setNarratingBecky] = useState(false);
  const [showText, setShowText] = useState(false);
  const [canComplete, setCanComplete] = useState(isCompleted);

  const overlayColor = isFamily ? "hsl(345,52%,22%)" : "hsl(175,55%,18%)";
  const btnColor    = isFamily ? "bg-rose-600"       : "bg-teal-600";

  useEffect(() => {
    setNarratingBecky(false);
    setShowText(false);
    setCanComplete(isCompleted);
    stopBecky();

    const t = setTimeout(async () => {
      setNarratingBecky(true);
      await speakBecky(lesson.narration);
      setNarratingBecky(false);
      setCanComplete(true);
    }, 500);

    return () => { clearTimeout(t); stopBecky(); };
  }, [lesson.id]);

  // back-button intercept
  useEffect(() => {
    window.history.pushState({ inlineLessonViewer: true }, "");
    const handlePop = () => { stopBecky(); onClose(); };
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
      if (window.history.state?.inlineLessonViewer) window.history.back();
    };
  }, []);

  async function toggleNarration() {
    if (narratingBecky) {
      stopBecky(); setNarratingBecky(false);
    } else {
      setNarratingBecky(true);
      await speakBecky(lesson.narration);
      setNarratingBecky(false);
      setCanComplete(true);
    }
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
          <button onClick={toggleNarration}
            className={cn("w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
              narratingBecky ? "bg-white/20 animate-pulse" : "bg-white/10 hover:bg-white/20")}>
            {narratingBecky
              ? <Pause size={16} className="text-white" />
              : <Volume2 size={16} className="text-white/70" />}
          </button>
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

// ── Public component ───────────────────────────────────────────────────────────
export function LessonLauncher({ pageKey }: { pageKey: string }) {
  const { activeUser } = useApp();
  const [open, setOpen] = useState(false);

  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";

  const mapping = PAGE_MAP[pageKey];
  if (!mapping) return null;

  const lessonId = isFamily && mapping.familyLessonId
    ? mapping.familyLessonId
    : mapping.cgLessonId;

  // If family has no lesson for this page, don't render
  if (isFamily && !mapping.familyLessonId) return null;

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

  const trackColor = isFamily ? "bg-rose-600" : "bg-teal-600";
  const trackBorder = isFamily ? "border-rose-500/30" : "border-teal-500/30";
  const trackText = isFamily ? "text-rose-400" : "text-teal-400";

  return (
    <>
      {/* Always show full pill — completed shows checkmark inside pill */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-medium transition-all hover:opacity-90 shadow-sm",
          completed
            ? "bg-emerald-600 border-emerald-500/30 text-white"
            : cn(trackColor, trackBorder, "text-white")
        )}
        title="How this works"
      >
        {completed
          ? <CheckCircle2 size={14} />
          : <GraduationCap size={14} />}
        How this works
        {!completed && <Play size={11} className="opacity-70" />}
      </button>

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
