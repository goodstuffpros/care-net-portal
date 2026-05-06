import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useApp } from "@/App";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Heart, Volume2, VolumeX, X, Flame, Star, Loader2 } from "lucide-react";
import { speakBecky, stopBecky, registerBeckyStateListener, unregisterBeckyStateListener } from "@/lib/ttsUtils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CheckInResult {
  checkIn: {
    id: number;
    aiResponse: string;
    detectedMood: string;
    detectedTheme: string;
  };
  streak: {
    currentStreak: number;
    longestStreak: number;
    totalCheckIns: number;
    earnedBadges: string;
  };
}

interface Exchange {
  userMessage: string;
  beckyResponse: string;
  isFinal?: boolean; // true on the 3rd exchange — Becky's wrap-up
}

const BECKY_WRAP_UP = "I hope I have given you some good things to consider. I do not want to overwhelm you. So let these thoughts marinate in your mind, and remember I am always here for your encouragement.";

// ── Mood rating labels ────────────────────────────────────────────────────────
const MOOD_OPTIONS = [
  { value: 1, emoji: "😞", label: "Really hard" },
  { value: 2, emoji: "😔", label: "Struggling" },
  { value: 3, emoji: "😐", label: "Getting through" },
  { value: 4, emoji: "🙂", label: "Pretty good" },
  { value: 5, emoji: "😊", label: "Doing great" },
];

const EARNED_BADGE_LABELS: Record<string, { label: string; icon: string }> = {
  first_checkin: { label: "First Check-In", icon: "💬" },
  week_streak: { label: "7-Day Streak", icon: "🔥" },
  month_streak: { label: "30-Day Streak", icon: "⭐" },
  ten_checkins: { label: "10 Check-Ins", icon: "💛" },
};

// ── Opening greeting ──────────────────────────────────────────────────────────
const OPENING = "Hey. I was wondering when you'd check in with me. What's going on, friend?";

// ── WellbeingModal ────────────────────────────────────────────────────────────
export function WellbeingModal({
  open,
  onClose,
  triggerType = "manual",
  proactiveIntro,
}: {
  open: boolean;
  onClose: () => void;
  triggerType?: "manual" | "proactive_shift_end" | "proactive_trend";
  proactiveIntro?: string;
}) {
  const { activeUser, selectedClientId } = useApp();
  const [step, setStep] = useState<"opening" | "writing" | "rating" | "response" | "streak">("opening");
  const [message, setMessage] = useState("");
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [audioMode, setAudioMode] = useState(false); // false = text (default), true = voice
  const [beckyLoading, setBeckyLoading] = useState(false);
  const [beckyPlaying, setBeckyPlaying] = useState(false);
  // Conversation thread
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [followUpMood, setFollowUpMood] = useState<number | null>(null);
  const [followUpStep, setFollowUpStep] = useState<"idle" | "writing" | "rating">("idle");
  const [followUpPending, setFollowUpPending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Track Becky audio state
  useEffect(() => {
    registerBeckyStateListener(({ isPlaying, isLoading }) => {
      setBeckyPlaying(isPlaying);
      setBeckyLoading(isLoading);
    });
    return () => unregisterBeckyStateListener();
  }, []);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(triggerType === "manual" ? "opening" : "writing");
      setMessage("");
      setMoodRating(null);
      setResult(null);
      setNewBadges([]);
      setExchanges([]);
      setFollowUpMessage("");
      setFollowUpMood(null);
      setFollowUpStep("idle");
      setFollowUpPending(false);
    }
  }, [open, triggerType]);

  // Scroll to bottom of thread when a new exchange is added
  useEffect(() => {
    if (exchanges.length > 0) {
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [exchanges.length]);

  // Auto-focus textarea when writing
  useEffect(() => {
    if (step === "writing") setTimeout(() => textRef.current?.focus(), 100);
  }, [step]);

  const { data: streakData } = useQuery({
    queryKey: ["/api/wellbeing/streak", activeUser.id],
    queryFn: () => apiRequest("GET", `/api/wellbeing/streak/${activeUser.id}`).then(r => r.json()),
    enabled: open,
  });

  const submitMutation = useMutation({
    mutationFn: (payload: { caregiverMessage: string; moodRating: number | null }) =>
      apiRequest("POST", "/api/wellbeing/checkin", {
        userId: activeUser.id,
        clientId: selectedClientId,
        caregiverMessage: payload.caregiverMessage,
        moodRating: payload.moodRating,
        triggerType,
      }).then(r => r.json()),
    onSuccess: (data: CheckInResult) => {
      setResult(data);
      // Detect newly earned badges
      const prev: string[] = JSON.parse(streakData?.earnedBadges || "[]");
      const now: string[] = JSON.parse(data.streak.earnedBadges || "[]");
      setNewBadges(now.filter(b => !prev.includes(b)));
      queryClient.invalidateQueries({ queryKey: ["/api/wellbeing/streak", activeUser.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/wellbeing/history", activeUser.id] });
      setStep("response");
      // Auto-play if audio mode was selected
      if (audioMode && data.checkIn.aiResponse) {
        setTimeout(() => speakBecky(data.checkIn.aiResponse), 400);
      }
    },
  });

  function handleSubmit() {
    if (!message.trim()) return;
    setStep("rating");
  }

  function handleRatingDone() {
    submitMutation.mutate({ caregiverMessage: message, moodRating });
  }

  function handleReadAloud() {
    if (!result?.checkIn.aiResponse) return;
    speakBecky(result.checkIn.aiResponse);
  }

  async function handleFollowUpSubmit() {
    if (!followUpMessage.trim() || followUpPending) return;
    const isFinalExchange = exchanges.length >= 2; // 0-indexed: 3rd exchange = index 2
    setFollowUpPending(true);
    try {
      const data: CheckInResult = await apiRequest("POST", "/api/wellbeing/checkin", {
        userId: activeUser.id,
        clientId: selectedClientId,
        caregiverMessage: followUpMessage,
        moodRating: followUpMood,
        triggerType: "manual",
      }).then(r => r.json());

      const beckyText = isFinalExchange
        ? data.checkIn.aiResponse + "\n\n" + BECKY_WRAP_UP
        : data.checkIn.aiResponse;

      const newExchange: Exchange = {
        userMessage: followUpMessage,
        beckyResponse: beckyText,
        isFinal: isFinalExchange,
      };
      setExchanges(prev => [...prev, newExchange]);
      setFollowUpMessage("");
      setFollowUpMood(null);
      setFollowUpStep("idle");
      if (audioMode && beckyText) setTimeout(() => speakBecky(beckyText), 400);
    } finally {
      setFollowUpPending(false);
    }
  }

  const isCaregiverRole = ["caregiver", "multi_caregiver", "temp_caregiver"].includes(activeUser.role);
  if (!isCaregiverRole) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-md w-full p-0 overflow-hidden border-0 rounded-2xl"
        style={{ background: "hsl(345 18% 7%)" }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-rose-500/20 flex items-center justify-center">
              <Heart size={16} className="text-rose-400 fill-rose-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                Need a Friend
              </div>
              <div className="text-xs text-rose-300/70">Care for the Caregiver</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">

          {/* STEP: Opening */}
          {step === "opening" && (
            <div className="space-y-4">
              {/* Becky intro — real person, not just an AI voice */}
              <div className="flex gap-3 bg-white/5 border border-white/10 rounded-xl p-3.5">
                <div className="w-9 h-9 rounded-full bg-rose-600/30 flex items-center justify-center flex-shrink-0 text-base">👩</div>
                <div className="space-y-1">
                  <p className="text-white text-xs font-semibold">About Becky</p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    Becky is a real caregiver with 10+ years of experience. Many of the responses here came directly from her — written from real moments, not a script. Where her words don't reach, the spirit behind them does.
                  </p>
                </div>
              </div>

              <div className="bg-rose-950/40 border border-rose-900/40 rounded-xl p-4">
                <p className="text-white/90 text-sm leading-relaxed italic">"{OPENING}"</p>
              </div>

              {/* READ / LISTEN choice */}
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

          {/* STEP: Proactive intro (auto-triggered) */}
          {step === "writing" && triggerType !== "manual" && proactiveIntro && (
            <div className="bg-rose-950/40 border border-rose-900/40 rounded-xl p-4 mb-1">
              <p className="text-white/90 text-sm leading-relaxed italic">"{proactiveIntro}"</p>
            </div>
          )}

          {/* STEP: Writing */}
          {step === "writing" && (
            <div className="space-y-4">
              {triggerType === "manual" && (
                <div className="bg-rose-950/30 border border-rose-900/30 rounded-xl p-3">
                  <p className="text-white/75 text-sm leading-relaxed italic">"{OPENING}"</p>
                </div>
              )}
              <Textarea
                ref={textRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Just say what's on your heart. There's no wrong answer here..."
                className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none rounded-xl focus-visible:ring-rose-500/50"
              />
              <Button
                onClick={handleSubmit}
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
              <div className="text-center space-y-1">
                <p className="text-white/90 text-sm font-medium">Before I respond — how are you feeling right now?</p>
                <p className="text-white/40 text-xs">Just a quick read, no pressure to be exact.</p>
              </div>
              <div className="flex justify-between gap-1">
                {MOOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMoodRating(opt.value)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
                      moodRating === opt.value
                        ? "border-rose-500 bg-rose-500/20 scale-105"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    )}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-white/60 text-[10px] leading-tight text-center">{opt.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={handleRatingDone}
                  className="flex-1 text-white/40 hover:text-white/70 text-xs"
                >
                  Skip
                </Button>
                <Button
                  onClick={handleRatingDone}
                  disabled={submitMutation.isPending}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white border-0"
                >
                  {submitMutation.isPending ? "..." : "Continue"}
                </Button>
              </div>
            </div>
          )}

          {/* STEP: Response */}
          {step === "response" && result && (
            <div className="space-y-4">
              {/* Caregiver's message recap */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-white/50 text-xs mb-1">You said:</p>
                <p className="text-white/75 text-sm leading-relaxed">{message}</p>
              </div>

              {/* AI response */}
              <div className="bg-rose-950/50 border border-rose-800/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart size={13} className="text-rose-400 fill-rose-400 flex-shrink-0" />
                    <span className="text-rose-300 text-xs font-medium">From Becky</span>
                    <span className="text-white/25 text-[10px]">— written by a real caregiver</span>
                  </div>
                  {/* Audio/text toggle on response */}
                  <button
                    onClick={() => {
                      const newMode = !audioMode;
                      setAudioMode(newMode);
                      if (newMode) handleReadAloud();
                      else stopBecky();
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border transition-all",
                      audioMode
                        ? "bg-rose-600/20 border-rose-500/40 text-rose-300"
                        : "bg-white/5 border-white/15 text-white/40 hover:text-white/60"
                    )}
                  >
                    {audioMode ? <Volume2 size={10} /> : <VolumeX size={10} />}
                    {audioMode ? "LISTEN" : "READ"}
                  </button>
                </div>

                {/* Text response — always visible, even in audio mode */}
                <p className="text-white/90 text-sm leading-relaxed">{result.checkIn.aiResponse}</p>

                {/* Audio controls */}
                {audioMode ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleReadAloud}
                      disabled={beckyLoading}
                      className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 text-xs transition-colors font-medium disabled:opacity-50"
                    >
                      {beckyLoading
                        ? <><Loader2 size={12} className="animate-spin" /> Loading...</>
                        : beckyPlaying
                        ? <><Volume2 size={12} /> Playing...</>
                        : <><Volume2 size={12} /> Play again</>}
                    </button>
                    <button
                      onClick={() => stopBecky()}
                      className="text-white/30 hover:text-white/50 text-xs transition-colors"
                    >
                      Stop
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAudioMode(true); handleReadAloud(); }}
                    className="flex items-center gap-1.5 text-rose-400/50 hover:text-rose-400 text-xs transition-colors"
                  >
                    <Volume2 size={12} />
                    Hear this in Becky's voice
                  </button>
                )}
              </div>

              {/* Streak info */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2">
                  <Flame size={14} className="text-amber-400" />
                  <span className="text-white/70 text-xs">
                    {result.streak.currentStreak > 1
                      ? `${result.streak.currentStreak}-day streak`
                      : "Check-in #" + result.streak.totalCheckIns}
                  </span>
                </div>
                <span className="text-white/40 text-xs">{result.streak.totalCheckIns} total</span>
              </div>

              {/* New badges */}
              {newBadges.length > 0 && (
                <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                    <Star size={12} /> You earned something
                  </div>
                  {newBadges.map(b => (
                    <div key={b} className="flex items-center gap-2 text-white/80 text-xs">
                      <span>{EARNED_BADGE_LABELS[b]?.icon}</span>
                      <span>{EARNED_BADGE_LABELS[b]?.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Follow-up conversation thread */}
              {exchanges.map((ex, i) => (
                <div key={i} className="space-y-2">
                  {/* Caregiver follow-up */}
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-white/50 text-xs mb-1">You continued:</p>
                    <p className="text-white/75 text-sm leading-relaxed">{ex.userMessage}</p>
                  </div>
                  {/* Becky's follow-up response */}
                  <div className="bg-rose-950/50 border border-rose-800/40 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Heart size={13} className="text-rose-400 fill-rose-400 flex-shrink-0" />
                      <span className="text-rose-300 text-xs font-medium">From Becky</span>
                    </div>
                    {ex.beckyResponse.split("\n\n").map((para, j) => (
                      <p key={j} className={cn(
                        "text-sm leading-relaxed",
                        j > 0 && ex.isFinal ? "text-rose-200/80 italic border-t border-rose-800/30 pt-3 mt-1" : "text-white/90"
                      )}>{para}</p>
                    ))}
                    {audioMode && (
                      <button
                        onClick={() => speakBecky(ex.beckyResponse)}
                        className="flex items-center gap-1.5 text-rose-400/50 hover:text-rose-400 text-xs transition-colors"
                      >
                        <Volume2 size={12} /> Play this response
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={threadEndRef} />

              {/* Follow-up input — writing step */}
              {followUpStep === "writing" && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <p className="text-white/60 text-xs">What else is on your heart?</p>
                  <Textarea
                    value={followUpMessage}
                    onChange={e => setFollowUpMessage(e.target.value)}
                    placeholder="Keep talking..."
                    className="min-h-[90px] bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none rounded-xl focus-visible:ring-rose-500/50"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => { setFollowUpStep("idle"); setFollowUpMessage(""); }}
                      className="text-white/30 hover:text-white/50 text-xs px-3"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => followUpMessage.trim() && setFollowUpStep("rating")}
                      disabled={!followUpMessage.trim()}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white border-0 disabled:opacity-40"
                    >
                      Send
                    </Button>
                  </div>
                </div>
              )}

              {/* Follow-up mood rating */}
              {followUpStep === "rating" && (
                <div className="space-y-4 border-t border-white/10 pt-4">
                  <div className="text-center space-y-1">
                    <p className="text-white/90 text-sm font-medium">Before I respond — how are you feeling right now?</p>
                    <p className="text-white/40 text-xs">Just a quick read, no pressure.</p>
                  </div>
                  <div className="flex justify-between gap-1">
                    {MOOD_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFollowUpMood(opt.value)}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
                          followUpMood === opt.value
                            ? "border-rose-500 bg-rose-500/20 scale-105"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        )}
                      >
                        <span className="text-xl">{opt.emoji}</span>
                        <span className="text-white/60 text-[10px] leading-tight text-center">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      onClick={handleFollowUpSubmit}
                      disabled={followUpPending}
                      className="flex-1 text-white/40 hover:text-white/70 text-xs"
                    >
                      Skip
                    </Button>
                    <Button
                      onClick={handleFollowUpSubmit}
                      disabled={followUpPending}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white border-0"
                    >
                      {followUpPending ? <><Loader2 size={13} className="animate-spin mr-1" />Sending...</> : "Continue"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Bottom action buttons */}
              {followUpStep === "idle" && (
                <div className="space-y-2 pt-1">
                  {/* Only show Keep Talking if under the 3-exchange cap */}
                  {exchanges.length < 3 && !exchanges.some(e => e.isFinal) && (
                    <Button
                      onClick={() => setFollowUpStep("writing")}
                      className="w-full bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/40 text-rose-200 hover:text-white"
                    >
                      Can we keep talking?
                    </Button>
                  )}
                  <Button
                    onClick={onClose}
                    className="w-full bg-white/10 hover:bg-white/15 text-white border-0"
                  >
                    Thank you — I needed that
                  </Button>
                  <Button
                    onClick={onClose}
                    variant="ghost"
                    className="w-full text-white/40 hover:text-white/60 text-sm"
                  >
                    Good talk. I may be coming back later.
                  </Button>
                </div>
              )}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Proactive Nudge Banner ────────────────────────────────────────────────────
// Shown at end of shift when urgency is high — sits at top of Dashboard
export function ProactiveNudgeBanner({
  onOpen,
  onDismiss,
}: {
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl overflow-hidden border border-rose-800/40 bg-gradient-to-r from-rose-950/80 to-rose-900/40">
      <div className="flex items-start gap-3 p-3.5">
        <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Heart size={14} className="text-rose-400 fill-rose-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium mb-0.5">Checking in on you</p>
          <p className="text-white/60 text-xs leading-relaxed">
            It looks like things have been intense lately. I know you're pushing through — but I wanted you to know I see it.
          </p>
        </div>
        <button onClick={onDismiss} className="text-white/30 hover:text-white/60 flex-shrink-0">
          <X size={14} />
        </button>
      </div>
      <div className="flex border-t border-rose-800/30">
        <button
          onClick={onOpen}
          className="flex-1 py-2.5 text-rose-300 text-xs font-medium hover:bg-rose-900/30 transition-colors"
        >
          Talk to Becky
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 py-2.5 text-white/30 text-xs hover:bg-white/5 transition-colors border-l border-rose-800/30"
        >
          I'm okay, thanks
        </button>
      </div>
    </div>
  );
}

// ── Need a Friend floating button ─────────────────────────────────────────────
// Small persistent button — appears only for caregiver roles, hidden in FCP
export function NeedAFriendButton({ onClick }: { onClick: () => void }) {
  const { activeUser, portalMode } = useApp();
  const isCaregiverRole = ["caregiver", "multi_caregiver", "temp_caregiver"].includes(activeUser.role);
  if (!isCaregiverRole || portalMode === "family") return null;

  return (
    <button
      onClick={onClick}
      data-testid="need-a-friend-btn"
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
        "bg-rose-600/15 hover:bg-rose-600/25 border border-rose-600/30 hover:border-rose-500/50",
        "text-rose-400 hover:text-rose-300"
      )}
    >
      <Heart size={11} className="fill-rose-400" />
      Need a friend
    </button>
  );
}
