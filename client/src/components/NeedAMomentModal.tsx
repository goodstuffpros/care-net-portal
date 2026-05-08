/**
 * NeedAMomentModal — "Need a Moment" for MC / family roles
 *
 * Mirrors the WellbeingModal flow (opening → write → mood rating → Becky response → follow-ups)
 * but with content tuned for unpaid family caregivers who can't clock out.
 *
 * Floating heart button renders itself (like HelpDesk).
 * Sits above the HelpDesk button: bottom-[4.25rem] right-4.
 * HelpDesk is at bottom-6 right-4; NeedAMoment stacks above it with a small gap.
 *
 * Placeholder scripts are marked *** BECKY *** for easy find-replace when she writes the real ones.
 */

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useApp } from "@/App";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Heart, X, Volume2, VolumeX, ChevronDown, Loader2 } from "lucide-react";
import { speakBecky, stopBecky, registerBeckyStateListener, unregisterBeckyStateListener } from "@/lib/ttsUtils";

// ── Mood options (same scale, warmer language for family) ──────────────────────
const MOOD_OPTIONS = [
  { value: 1, emoji: "😞", label: "Really hard" },
  { value: 2, emoji: "😔", label: "Struggling" },
  { value: 3, emoji: "😐", label: "Getting through" },
  { value: 4, emoji: "🙂", label: "Pretty good" },
  { value: 5, emoji: "😊", label: "Doing well" },
];

// ── Opening greeting ────────────────────────────────────────────────────────────
const OPENING = "I've been thinking about you. Caring for someone you love is one of the hardest things a person can do. How are you really doing today?";

// ── Wrap-up (shown on 3rd exchange) ────────────────────────────────────────────
const WRAP_UP = "I want you to know — what you are doing matters more than you may ever fully see. Rest in that today. I am always here when you need a moment.";

// ── Placeholder response library (Becky fills these in) ───────────────────────
// Category keys are passed to the API as detectedTheme hints for the AI.
// Each category has a seed phrase Becky can later replace via Becky Admin.
export const MOMENT_CATEGORIES = [
  {
    key: "overwhelmed",
    label: "Feeling overwhelmed",
    placeholder:
      "*** BECKY *** What you are carrying right now is not small. Nobody handed you a manual for this. The fact that you showed up today — and keep showing up — that is strength, even when it does not feel like it. Take one breath. Just one. You do not have to solve everything right now.",
  },
  {
    key: "guilt",
    label: "Guilt and second-guessing",
    placeholder:
      "*** BECKY *** The guilt you feel? It comes from love. You would not feel it if you did not care deeply. But I want you to hear this: second-guessing yourself does not mean you made the wrong choice. It means you are paying attention. That is what a good caregiver does.",
  },
  {
    key: "grief",
    label: "Grief",
    placeholder:
      "*** BECKY *** Grief does not wait for things to be over. It shows up in the middle — watching someone you love change, missing who they were, mourning a future that looks different than you imagined. All of that is real, and all of it is allowed. You do not have to hold it together right now.",
  },
  {
    key: "invisible",
    label: "When caregiving feels invisible",
    placeholder:
      "*** BECKY *** Nobody is handing out awards for what you do. There is no performance review, no paycheck, no clock to punch out. And some days that invisibility is crushing. I see it. The appointments you keep, the medications you track, the hand you hold at 2am — none of that is invisible to the people who matter.",
  },
  {
    key: "decision_fatigue",
    label: "Decision fatigue",
    placeholder:
      "*** BECKY *** There is a specific kind of exhaustion that comes from making decisions about someone else's life — especially when the right answer is not always clear. You are not expected to know everything. Give yourself permission to make the best decision you can with what you know today, and let that be enough.",
  },
  {
    key: "enough",
    label: "You're doing enough",
    placeholder:
      "*** BECKY *** I know the voice in your head that says you should be doing more. I want you to know — that voice is lying to you. You are present. You are trying. You are here. That is not nothing. That is everything.",
  },
];

interface Exchange {
  userMessage: string;
  beckyResponse: string;
  isFinal?: boolean;
}

interface CheckInResult {
  checkIn: { id: number; aiResponse: string; detectedMood: string; detectedTheme: string };
  streak: { currentStreak: number; totalCheckIns: number };
}

export function NeedAMomentModal() {
  const { activeUser, selectedClientId } = useApp();

  const isFamily =
    activeUser.role === "primary_family" || activeUser.role === "secondary_family";

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"opening" | "writing" | "rating" | "response">("opening");
  const [message, setMessage] = useState("");
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [audioMode, setAudioMode] = useState(false);
  const [beckyLoading, setBeckyLoading] = useState(false);
  const [beckyPlaying, setBeckyPlaying] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [followUpMood, setFollowUpMood] = useState<number | null>(null);
  const [followUpStep, setFollowUpStep] = useState<"idle" | "writing" | "rating">("idle");
  const [followUpPending, setFollowUpPending] = useState(false);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerBeckyStateListener(({ isPlaying, isLoading }) => {
      setBeckyPlaying(isPlaying);
      setBeckyLoading(isLoading);
    });
    return () => unregisterBeckyStateListener();
  }, []);

  useEffect(() => {
    if (open) {
      setStep("opening");
      setMessage("");
      setMoodRating(null);
      setResult(null);
      setExchanges([]);
      setFollowUpMessage("");
      setFollowUpMood(null);
      setFollowUpStep("idle");
      setFollowUpPending(false);
    }
  }, [open]);

  useEffect(() => {
    if (exchanges.length > 0) {
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [exchanges.length]);

  useEffect(() => {
    if (step === "writing") setTimeout(() => textRef.current?.focus(), 100);
  }, [step]);

  const submitMutation = useMutation({
    mutationFn: (payload: { caregiverMessage: string; moodRating: number | null }) =>
      apiRequest("POST", "/api/wellbeing/checkin", {
        userId: activeUser.id,
        clientId: selectedClientId,
        caregiverMessage: payload.caregiverMessage,
        moodRating: payload.moodRating,
        triggerType: "manual",
        // Signal to AI that this is a family caregiver context
        context: "family_caregiver",
      }).then(r => r.json()),
    onSuccess: (data: CheckInResult) => {
      setResult(data);
      setStep("response");
      if (audioMode && data.checkIn.aiResponse) {
        setTimeout(() => speakBecky(data.checkIn.aiResponse), 400);
      }
    },
  });

  async function handleFollowUpSubmit() {
    if (!followUpMessage.trim() || followUpPending) return;
    const isFinalExchange = exchanges.length >= 2;
    setFollowUpPending(true);
    try {
      const data: CheckInResult = await apiRequest("POST", "/api/wellbeing/checkin", {
        userId: activeUser.id,
        clientId: selectedClientId,
        caregiverMessage: followUpMessage,
        moodRating: followUpMood,
        triggerType: "manual",
        context: "family_caregiver",
      }).then(r => r.json());

      const beckyText = isFinalExchange
        ? data.checkIn.aiResponse + "\n\n" + WRAP_UP
        : data.checkIn.aiResponse;

      setExchanges(prev => [...prev, { userMessage: followUpMessage, beckyResponse: beckyText, isFinal: isFinalExchange }]);
      setFollowUpMessage("");
      setFollowUpMood(null);
      setFollowUpStep("idle");
      if (audioMode && beckyText) setTimeout(() => speakBecky(beckyText), 400);
    } finally {
      setFollowUpPending(false);
    }
  }

  // Only show for family roles
  if (!isFamily) return null;

  const canContinue = exchanges.length < 3 && !exchanges[exchanges.length - 1]?.isFinal;

  return (
    <>
      {/* Floating heart button — sits above HelpDesk (bottom-6 + h-12 + gap = ~4.25rem) */}
      <button
        onClick={() => setOpen(o => !o)}
        data-testid="need-a-moment-toggle"
        aria-label="Need a Moment"
        className={cn(
          "fixed z-50 w-12 h-12 rounded-full shadow-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-200",
          "bottom-[5.5rem] right-4",
          open
            ? "bg-rose-500 text-white"
            : "bg-rose-500/90 hover:bg-rose-500 text-white"
        )}
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <Heart className="w-4 h-4 fill-white" />}
        <span className="text-[8px] font-semibold leading-none tracking-wide opacity-90">
          {open ? "Close" : "For Me"}
        </span>
      </button>

      {/* Panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 w-[360px] max-w-[calc(100vw-2.5rem)]",
            "rounded-2xl border border-rose-900/40 shadow-2xl",
            "flex flex-col overflow-hidden",
            "animate-in slide-in-from-bottom-4 duration-200",
            // Sits above the For Me button (bottom ~4.25rem + 48px button + 8px gap)
            "bottom-[10rem] right-4"
          )}
          style={{ height: "480px", background: "hsl(345 18% 7%)" }}
          data-testid="need-a-moment-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-rose-900/40 bg-rose-700/30 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-500/30 flex items-center justify-center">
                <Heart size={14} className="text-rose-300 fill-rose-300" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  Need a Moment
                </div>
                <div className="text-xs text-rose-300/70">Care for the Caregiver</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white/70 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* STEP: Opening */}
            {step === "opening" && (
              <div className="space-y-4">
                {/* About Becky card */}
                <div className="flex gap-3 bg-white/5 border border-white/10 rounded-xl p-3.5">
                  <div className="w-9 h-9 rounded-full bg-rose-600/30 flex items-center justify-center flex-shrink-0 text-base">👩</div>
                  <div className="space-y-1">
                    <p className="text-white text-xs font-semibold">About Becky</p>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Becky has spent 10+ years walking alongside families in caregiving seasons — not just as a professional, but as someone who understands the weight you carry. These words come from real experience.
                    </p>
                  </div>
                </div>

                <div className="bg-rose-950/40 border border-rose-900/40 rounded-xl p-4">
                  <p className="text-white/90 text-sm leading-relaxed italic">"{OPENING}"</p>
                </div>

                {/* Read / Listen choice */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAudioMode(false)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 py-4 rounded-2xl border-2 transition-all",
                      !audioMode
                        ? "border-rose-500 bg-rose-500/15 text-white"
                        : "border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white/60"
                    )}
                  >
                    <span className="text-lg font-bold tracking-wide" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>READ</span>
                    <span className={cn("text-[11px] font-medium", !audioMode ? "text-rose-300" : "text-white/30")}>Becky's Words</span>
                  </button>
                  <button
                    onClick={() => setAudioMode(true)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 py-4 rounded-2xl border-2 transition-all",
                      audioMode
                        ? "border-rose-500 bg-rose-500/15 text-white"
                        : "border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white/60"
                    )}
                  >
                    <span className="text-lg font-bold tracking-wide" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>LISTEN</span>
                    <span className={cn("text-[11px] font-medium", audioMode ? "text-rose-300" : "text-white/30")}>Becky's Voice</span>
                  </button>
                </div>

                <div className="text-xs text-white/30 text-center">Private. Only you can see what you share here.</div>

                <Button
                  onClick={() => setStep("writing")}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white border-0"
                >
                  I'm ready to talk
                </Button>
              </div>
            )}

            {/* STEP: Writing */}
            {step === "writing" && (
              <div className="space-y-4">
                <div className="bg-rose-950/30 border border-rose-900/30 rounded-xl p-3">
                  <p className="text-white/75 text-sm leading-relaxed italic">"{OPENING}"</p>
                </div>
                <Textarea
                  ref={textRef}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Just say what's on your heart. There's no wrong answer here..."
                  className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none rounded-xl focus-visible:ring-rose-500/50"
                />
                <Button
                  onClick={() => { if (message.trim()) setStep("rating"); }}
                  disabled={!message.trim()}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white border-0 disabled:opacity-40"
                >
                  Send
                </Button>
              </div>
            )}

            {/* STEP: Mood rating */}
            {step === "rating" && (
              <div className="space-y-5">
                <p className="text-white/80 text-sm leading-relaxed">
                  Before I respond — how would you describe where you are emotionally right now?
                </p>
                <div className="flex justify-between gap-1">
                  {MOOD_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMoodRating(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 flex-1 py-3 rounded-xl border transition-all",
                        moodRating === opt.value
                          ? "border-rose-500 bg-rose-500/20"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      )}
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      <span className="text-[10px] text-white/60 leading-tight text-center">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => submitMutation.mutate({ caregiverMessage: message, moodRating })}
                  disabled={submitMutation.isPending}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white border-0 disabled:opacity-40"
                >
                  {submitMutation.isPending ? (
                    <><Loader2 size={14} className="animate-spin mr-2" /> Becky is thinking...</>
                  ) : "Continue"}
                </Button>
              </div>
            )}

            {/* STEP: Response */}
            {step === "response" && result && (
              <div className="space-y-4">
                {/* Initial Becky response */}
                <div className="bg-rose-950/40 border border-rose-900/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">👩</span>
                      <span className="text-xs font-semibold text-rose-300">Becky</span>
                    </div>
                    <button
                      onClick={() => beckyPlaying ? stopBecky() : speakBecky(result.checkIn.aiResponse)}
                      className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                    >
                      {beckyLoading ? <Loader2 size={12} className="animate-spin" /> : beckyPlaying ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      {beckyPlaying ? "Stop" : "Listen"}
                    </button>
                  </div>
                  {result.checkIn.aiResponse.split("\n\n").map((para, i) => (
                    <p key={i} className="text-white/85 text-sm leading-relaxed">{para}</p>
                  ))}
                </div>

                {/* Follow-up conversation thread */}
                {exchanges.map((ex, i) => (
                  <div key={i} className="space-y-3">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <p className="text-white/70 text-sm leading-relaxed">{ex.userMessage}</p>
                    </div>
                    <div className={cn("bg-rose-950/40 border border-rose-900/40 rounded-xl p-4 space-y-2", ex.isFinal && "border-rose-500/30")}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">👩</span>
                        <span className="text-xs font-semibold text-rose-300">Becky</span>
                        {ex.isFinal && <span className="text-[10px] text-rose-400/60 ml-auto">Final thought</span>}
                      </div>
                      {ex.beckyResponse.split("\n\n").map((para, j) => (
                        <p key={j} className="text-white/85 text-sm leading-relaxed">{para}</p>
                      ))}
                      <button
                        onClick={() => speakBecky(ex.beckyResponse)}
                        className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors mt-1"
                      >
                        <Volume2 size={11} /> Listen
                      </button>
                    </div>
                  </div>
                ))}
                <div ref={threadEndRef} />

                {/* Follow-up input */}
                {canContinue && followUpStep === "idle" && (
                  <button
                    onClick={() => setFollowUpStep("writing")}
                    className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-white/50 hover:text-white/80 hover:border-white/20 text-sm transition-all"
                  >
                    I want to share more...
                  </button>
                )}
                {canContinue && followUpStep === "writing" && (
                  <div className="space-y-3">
                    <Textarea
                      value={followUpMessage}
                      onChange={e => setFollowUpMessage(e.target.value)}
                      placeholder="Keep sharing..."
                      className="min-h-[90px] bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none rounded-xl focus-visible:ring-rose-500/50"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFollowUpStep("idle")}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white/60 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <Button
                        onClick={() => { if (followUpMessage.trim()) setFollowUpStep("rating"); }}
                        disabled={!followUpMessage.trim()}
                        className="flex-1 bg-rose-600 hover:bg-rose-500 text-white border-0 disabled:opacity-40"
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                )}
                {canContinue && followUpStep === "rating" && (
                  <div className="space-y-3">
                    <p className="text-white/70 text-xs">How are you feeling now?</p>
                    <div className="flex justify-between gap-1">
                      {MOOD_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setFollowUpMood(opt.value)}
                          className={cn(
                            "flex flex-col items-center gap-1 flex-1 py-2.5 rounded-xl border transition-all",
                            followUpMood === opt.value
                              ? "border-rose-500 bg-rose-500/20"
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          )}
                        >
                          <span className="text-lg">{opt.emoji}</span>
                          <span className="text-[9px] text-white/50 leading-tight text-center">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={handleFollowUpSubmit}
                      disabled={followUpPending}
                      className="w-full bg-rose-600 hover:bg-rose-500 text-white border-0 disabled:opacity-40"
                    >
                      {followUpPending ? <><Loader2 size={14} className="animate-spin mr-2" />Becky is thinking...</> : "Continue"}
                    </Button>
                  </div>
                )}

                {/* Done */}
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-2.5 text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
