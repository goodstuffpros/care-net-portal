import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useApp } from "@/App";
import { useLang } from "@/lib/useLang";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Award, MessageSquare, Shield, BookOpen, Heart, RefreshCw, ClipboardList, ChevronLeft, ChevronRight, CheckCircle2, Pill, Activity, Calendar, SlidersHorizontal } from "lucide-react";
import { LessonLauncher } from "@/components/LessonLauncher";

// ── Types ────────────────────────────────────────────────────────────────────

interface BadgeScore {
  id: number;
  caregiverId: number;
  clientId: number;
  computedAt: string;
  communicationScore: number;
  dependabilityScore: number;
  knowledgeScore: number;
  connectionScore: number;
  overallScore: number;
  heartsOverall: number;
  heartsCommunication: number;
  heartsDependability: number;
  heartsKnowledge: number;
  heartsConnection: number;
  objCommResponseSpeed: number;
  objCommQuality: number;
  objCommParticipation: number;
  objDepShiftAccuracy: number;
  objDepFlagScore: number;
  objDepAppointments: number;
  objKnwMedication: number;
  objKnwVitals: number;
  objConPortalSignals: number;
  portalDaysActive: number;
  hasMinimumData: boolean;
  surveysInWindow: number;
}

// ── Hearts Display ────────────────────────────────────────────────────────────

function HeartsDisplay({ value, size = "md", color = "text-rose-500" }: { value: number; size?: "sm" | "md" | "lg"; color?: string }) {
  const sizeClass = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm";
  const hearts = [];
  for (let i = 1; i <= 5; i++) {
    if (value >= i) {
      hearts.push(<span key={i} className={cn(sizeClass, color)}>♥</span>);
    } else if (value >= i - 0.5) {
      hearts.push(<span key={i} className={cn(sizeClass, color, "opacity-50")}>♥</span>);
    } else {
      hearts.push(<span key={i} className={cn(sizeClass, "text-muted-foreground/25")}>♡</span>);
    }
  }
  return <div className="flex items-center gap-0.5">{hearts}</div>;
}

// ── Score Bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700", color)}
        style={{ width: `${Math.max(score, 2)}%` }}
      />
    </div>
  );
}

// ── Score Color ───────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 75) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function barColor(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-amber-500";
  return "bg-red-500";
}

// ── Survey Questions ──────────────────────────────────────────────────────────

const SURVEY_QUESTIONS: Array<{
  key: string;
  dbKey: string;
  dim: string;
  label: string;
  options: string[];
  hasTextInput?: boolean;
}> = [
  // Communication (3)
  {
    key: "commResponse",
    dbKey: "commClarity",
    dim: "communication",
    label: "When you reached out to your caregiver with a question or concern, how would you describe the response?",
    options: ["Very thoughtful", "Adequate", "Brief or vague", "Rarely responded"],
  },
  {
    key: "commProactive",
    dbKey: "commProactive",
    dim: "communication",
    label: "How well did your caregiver keep you informed about your loved one’s day — without you having to ask?",
    options: ["Always proactive", "Usually", "Sometimes", "Rarely"],
  },
  {
    key: "commUnexpected",
    dbKey: "commResponsive",
    dim: "communication",
    label: "When something unexpected happened during care, how quickly and clearly did your caregiver communicate it to you?",
    options: ["Right away with full detail", "Somewhat timely", "Delayed", "I found out on my own"],
  },
  // Dependability (2)
  {
    key: "depConsistency",
    dbKey: "depReliable",
    dim: "dependability",
    label: "How consistent was your caregiver with their scheduled shifts?",
    options: ["Never missed or was late", "Occasionally", "Sometimes unreliable", "Often unreliable"],
  },
  {
    key: "depAbsence",
    dbKey: "depFollowThrough",
    dim: "dependability",
    label: "When your caregiver couldn’t make a shift, how was it handled?",
    options: ["Always gave advance notice and arranged coverage", "Usually", "Sometimes", "This was a recurring problem"],
  },
  // Knowledge (2)
  {
    key: "knwHealthNeeds",
    dbKey: "knwCompetence",
    dim: "knowledge",
    label: "How confident did you feel that your caregiver understood your loved one’s specific health needs and conditions?",
    options: ["Very confident", "Somewhat confident", "Uncertain", "Not confident"],
  },
  {
    key: "knwMedAppt",
    dbKey: "knwSituational",
    dim: "knowledge",
    label: "Did your caregiver handle medications, appointments, or health monitoring in a way that gave you peace of mind?",
    options: ["Always", "Usually", "Sometimes", "Rarely — or N/A if not applicable"],
  },
  // Connection (5)
  {
    key: "conWarmth",
    dbKey: "conWarmth",
    dim: "connection",
    label: "Did your caregiver treat your loved one with genuine warmth and dignity — not just as a job?",
    options: ["Absolutely", "Most of the time", "Hard to tell", "Not really"],
  },
  {
    key: "conPersonhood",
    dbKey: "conPersonhood",
    dim: "connection",
    label: "Did you feel your caregiver truly paid attention to who your loved one is as a person — their personality, preferences, and history?",
    options: ["Yes, deeply", "Somewhat", "Not particularly", "No"],
  },
  {
    key: "conMoodEffect",
    dbKey: "conHappiness",
    dim: "connection",
    label: "How did your loved one seem after time with their caregiver?",
    options: ["Noticeably better — happier, calmer, more engaged", "About the same", "Sometimes worse"],
  },
  {
    key: "conTrust",
    dbKey: "conAboveAndBeyond",
    dim: "connection",
    label: "Would you trust this caregiver with your loved one without checking in?",
    options: ["Completely", "Mostly", "With some reservations", "Not really"],
  },
  {
    key: "conRecommend",
    dbKey: "conFamilyConfidence",
    dim: "connection",
    label: "If you had to describe this caregiver to another family looking for care, what would you say?",
    options: ["Outstanding — I would recommend without hesitation", "Good", "Mixed feelings", "I would not recommend"],
    hasTextInput: true,
  },
];

// Score mapping: option index → points (1st=best)
// 4-option: [5, 4, 2, 0]; 3-option: [5, 3, 0]
function optionIndexToScore(index: number, optionCount: number): number {
  if (optionCount === 3) {
    return [5, 3, 0][index] ?? 0;
  }
  return [5, 4, 2, 0][index] ?? 0;
}

const DIM_LABELS: Record<string, string> = {
  communication: "Communication",
  dependability: "Dependability",
  knowledge: "Knowledge",
  connection: "Connection",
};

const DIM_COLORS: Record<string, string> = {
  communication: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
  dependability: "bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400",
  knowledge:     "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
  connection:    "bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400",
};

// ── Survey Modal ──────────────────────────────────────────────────────────────

function SurveyModal({ caregiverId, clientId, caregiverName, onClose }: {
  caregiverId: number;
  clientId: number;
  caregiverName: string;
  onClose: () => void;
}) {
  const { activeUser } = useApp();
  const { toast } = useToast();
  const [step, setStep] = useState(0); // 0 = intro, 1..N = questions, N+1 = notes, N+2 = done
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  const totalSteps = SURVEY_QUESTIONS.length + 2; // intro + questions + notes
  const isIntro = step === 0;
  const isDone = step === totalSteps;
  const isNotes = step === SURVEY_QUESTIONS.length + 1;
  const currentQ = !isIntro && !isDone && !isNotes ? SURVEY_QUESTIONS[step - 1] : null;
  const progress = step / (totalSteps - 1);

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/badge/survey", {
      caregiverId,
      clientId,
      submittedByUserId: activeUser.id,
      ...answers,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/badge", caregiverId, clientId] });
      setStep(totalSteps);
    },
    onError: () => toast({ title: "Error", description: "Could not submit survey.", variant: "destructive" }),
  });

  // Store answers by dbKey (maps to actual DB column), also track key for UI state
  const handleAnswer = (optionIndex: number) => {
    if (!currentQ) return;
    const score = optionIndexToScore(optionIndex, currentQ.options.length);
    setAnswers(prev => ({ ...prev, [currentQ.dbKey]: score }));
    // For last question with text input, don't auto-advance
    if (!currentQ.hasTextInput) {
      setTimeout(() => setStep(s => s + 1), 300);
    }
  };

  // For answered check (use dbKey)
  const currentAnswer = currentQ ? answers[currentQ.dbKey] : undefined;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList size={18} className="text-primary" />
            Monthly Care Survey
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        {!isIntro && !isDone && (
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden -mt-2">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        <div className="py-2 min-h-[220px] flex flex-col justify-center">

          {/* Intro */}
          {isIntro && (
            <div className="space-y-4 text-center px-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Heart size={28} className="text-rose-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base">Rate your experience with {caregiverName}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This monthly survey helps build {caregiverName}'s Care Badge — a private record of care quality across four areas. Takes about 2 minutes.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Your responses are private and anonymous from your caregiver.</p>
              <Button className="w-full" onClick={() => setStep(1)}>Begin Survey</Button>
            </div>
          )}

          {/* Question */}
          {currentQ && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide", DIM_COLORS[currentQ.dim])}>
                  {DIM_LABELS[currentQ.dim]}
                </span>
                <span className="text-xs text-muted-foreground">Question {step} of {SURVEY_QUESTIONS.length}</span>
              </div>
              <p className="text-base font-medium text-foreground leading-snug">{currentQ.label}</p>
              <div className="space-y-2">
                {currentQ.options.map((optLabel, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                      answers[currentQ.dbKey] === optionIndexToScore(idx, currentQ.options.length)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted hover:border-primary/30"
                    )}
                    data-testid={`survey-answer-${idx}`}
                  >
                    {optLabel}
                  </button>
                ))}
                {/* Optional text input for final connection question */}
                {currentQ.hasTextInput && (
                  <div className="pt-2 space-y-2">
                    <textarea
                      className="w-full border border-border rounded-xl p-3 text-sm resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      rows={3}
                      placeholder="In your own words..."
                      onChange={e => setNotes(e.target.value)}
                      data-testid="survey-recommend-text"
                    />
                    <Button
                      className="w-full"
                      onClick={() => setStep(s => s + 1)}
                      disabled={answers[currentQ.dbKey] === undefined}
                    >
                      Continue
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {isNotes && (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-foreground">Anything else you'd like to add?</p>
                <p className="text-sm text-muted-foreground mt-0.5">Optional — share any thoughts, stories, or context. This stays private.</p>
              </div>
              <textarea
                className="w-full border border-border rounded-xl p-3 text-sm resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                rows={4}
                placeholder="Dad smiled all morning after Becky brought his favorite music..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                data-testid="survey-notes"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(s => s + 1)}>Skip</Button>
                <Button className="flex-1" onClick={() => { setStep(s => s + 1); }}>Continue</Button>
              </div>
            </div>
          )}

          {/* Review + Submit */}
          {step === SURVEY_QUESTIONS.length + 1 && !isDone && isNotes && null}

          {/* Done */}
          {isDone && !submitMutation.isSuccess && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Survey complete</h3>
                <p className="text-sm text-muted-foreground mt-1">Ready to submit {caregiverName}'s monthly survey?</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Review answers</Button>
                <Button
                  className="flex-1"
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  data-testid="survey-submit"
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Survey"}
                </Button>
              </div>
            </div>
          )}

          {submitMutation.isSuccess && (
            <div className="space-y-3 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto">
                <Heart size={28} className="text-rose-500" />
              </div>
              <h3 className="font-semibold text-foreground">Thank you</h3>
              <p className="text-sm text-muted-foreground">Your feedback has been recorded. {caregiverName}'s badge has been updated.</p>
              <Button className="w-full" onClick={onClose}>Close</Button>
            </div>
          )}

        </div>

        {/* Back navigation */}
        {step > 1 && !isDone && !submitMutation.isSuccess && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 -mt-1"
          >
            <ChevronLeft size={13} /> Back
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Badges Page ──────────────────────────────────────────────────────────

export default function Badges() {
  const { activeUser, selectedClientId } = useApp();
  const { toast } = useToast();
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const isPrimaryFC = activeUser.role === "primary_family";
  const isCaregiver = ["caregiver", "temp_caregiver", "multi_caregiver"].includes(activeUser.role);
  const isSecondaryFamily = activeUser.role === "secondary_family";

  // For CG: use their own ID. For MC/family: use the connected caregiver (demo=1, real=look up)
  const caregiverId = isCaregiver ? activeUser.id : 1;
  const caregiverName = isCaregiver ? activeUser.name : "Your Caregiver";

  const { data: score, isLoading, refetch } = useQuery<BadgeScore>({
    queryKey: ["/api/badge", caregiverId, selectedClientId],
    queryFn: () => apiRequest("GET", `/api/badge/${caregiverId}/client/${selectedClientId}`).then(r => r.json()),
    enabled: !!caregiverId && !!selectedClientId,
  });

  const { data: surveyStatus } = useQuery<{ submitted: boolean }>({
    queryKey: ["/api/badge/survey/status", caregiverId, selectedClientId],
    queryFn: () => apiRequest("GET", `/api/badge/survey/status/${caregiverId}/client/${selectedClientId}`).then(r => r.json()),
    enabled: activeUser.role === "primary_family" && !!caregiverId && !!selectedClientId,
  });

  const recomputeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/badge/${caregiverId}/client/${selectedClientId}/compute`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/badge", caregiverId, selectedClientId] });
      toast({ title: "Badge scores refreshed" });
    },
  });

  // Scope data for Scope Badge display
  const { data: scope } = useQuery<{
    medications: boolean; vitals: boolean; appointments: boolean;
    activityLog: boolean; messaging: boolean;
  }>({
    queryKey: ["/api/scope", selectedClientId, caregiverId],
    queryFn: () => apiRequest("GET", `/api/scope/${selectedClientId}/${caregiverId}`).then(r => r.json()),
    enabled: !!caregiverId && !!selectedClientId,
  });

  const dimensions = score ? [
    {
      key: "communication",
      label: "Communication",
      icon: MessageSquare,
      score: score.communicationScore,
      hearts: score.heartsCommunication,
      color: "text-blue-600 dark:text-blue-400",
      heartColor: "text-blue-500",
      barClass: "bg-blue-500",
      bgClass: "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40",
      subScores: isPrimaryFC ? [
        { label: "Response Speed", value: score.objCommResponseSpeed },
        { label: "Message Quality", value: score.objCommQuality },
        { label: "Thread Participation", value: score.objCommParticipation },
      ] : [],
    },
    {
      key: "dependability",
      label: "Dependability",
      icon: Shield,
      score: score.dependabilityScore,
      hearts: score.heartsDependability,
      color: "text-violet-600 dark:text-violet-400",
      heartColor: "text-violet-500",
      barClass: "bg-violet-500",
      bgClass: "bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/40",
      subScores: isPrimaryFC ? [
        { label: "Shift Consistency", value: score.objDepShiftAccuracy },
        { label: "Flag Record", value: score.objDepFlagScore },
        { label: "Appointment Completion", value: score.objDepAppointments },
      ] : [],
    },
    {
      key: "knowledge",
      label: "Knowledge",
      icon: BookOpen,
      score: score.knowledgeScore,
      hearts: score.heartsKnowledge,
      color: "text-amber-600 dark:text-amber-400",
      heartColor: "text-amber-500",
      barClass: "bg-amber-500",
      bgClass: "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40",
      subScores: isPrimaryFC ? [
        { label: "Medication Timeliness", value: score.objKnwMedication },
        { label: "Vitals Logging", value: score.objKnwVitals },
      ] : [],
    },
    {
      key: "connection",
      label: "Connection",
      icon: Heart,
      score: score.connectionScore,
      hearts: score.heartsConnection,
      color: "text-rose-600 dark:text-rose-400",
      heartColor: "text-rose-500",
      barClass: "bg-rose-500",
      bgClass: "bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/40",
      subScores: isPrimaryFC ? [
        { label: "Portal Engagement Signals", value: score.objConPortalSignals },
      ] : [],
    },
  ] : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Computing badge scores…</p>
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
          <Award size={40} className="text-muted-foreground opacity-25" />
          <p className="font-medium text-muted-foreground">No badge data yet</p>
          <p className="text-sm text-muted-foreground/70 max-w-xs">
            Badge scores are calculated from care activity. They'll appear here once your portal has some history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Award size={20} className="text-rose-500" />
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Care Badge</h1>
            <p className="text-xs text-muted-foreground">Private care quality record · 30-day rolling window</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
        {isPrimaryFC && (
          <button
            onClick={() => recomputeMutation.mutate()}
            disabled={recomputeMutation.isPending}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Refresh scores"
            data-testid="refresh-badge"
          >
            <RefreshCw size={15} className={recomputeMutation.isPending ? "animate-spin" : ""} />
          </button>
        )}
        </div>
      </div>

      {/* Overall score card */}
      {score && (
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/80 p-5 space-y-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              BM
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">{caregiverName}</div>
              <div className="text-xs text-muted-foreground">Primary Caregiver · {score.portalDaysActive} portal days tracked</div>
              <div className="mt-1.5 flex items-center gap-3">
                <HeartsDisplay value={score.heartsOverall} size="lg" />
                <span className={cn("text-2xl font-bold tabular-nums", scoreColor(score.overallScore))} style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  {score.overallScore.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Overall bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Overall Care Score</span>
              {!score.hasMinimumData && <span className="text-amber-600">Needs 14+ days data</span>}
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", barColor(score.overallScore))}
                style={{ width: `${score.overallScore}%` }}
              />
            </div>
          </div>

          {/* Survey CTA for Primary FC */}
          {isPrimaryFC && (
            <div className={cn("rounded-xl p-3 flex items-center justify-between",
              surveyStatus?.submitted
                ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                : "bg-primary/5 border border-primary/20"
            )}>
              {surveyStatus?.submitted ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={15} />
                    <span>Monthly survey submitted</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Next survey in {30 - Math.floor((Date.now() - new Date(score.computedAt).getTime()) / 86400000)} days</span>
                </>
              ) : (
                <>
                  <div className="text-sm">
                    <div className="font-medium text-foreground">Monthly survey ready</div>
                    <div className="text-xs text-muted-foreground">Takes ~2 min · anonymous from caregiver</div>
                  </div>
                  <Button size="sm" onClick={() => setSurveyOpen(true)} data-testid="open-survey-btn">
                    Start Survey
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dimension cards */}
      {score && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Score Breakdown</h2>
          {dimensions.map(dim => {
            const Icon = dim.icon;
            const isExpanded = expanded === dim.key;
            const canExpand = isPrimaryFC && dim.subScores.length > 0;
            return (
              <div
                key={dim.key}
                className={cn("rounded-xl border p-4 transition-all", dim.bgClass, canExpand && "cursor-pointer")}
                onClick={() => canExpand && setExpanded(isExpanded ? null : dim.key)}
                data-testid={`badge-dim-${dim.key}`}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-white/50 dark:bg-black/20 shrink-0")}>
                    <Icon size={16} className={dim.color} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{dim.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <HeartsDisplay value={dim.hearts} size="sm" color={dim.heartColor} />
                        <span className={cn("text-sm font-bold tabular-nums", dim.color)}>
                          {dim.score.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <ScoreBar score={dim.score} color={dim.barClass} />
                  </div>
                </div>

                {/* Expanded objective sub-scores (Primary FC only) */}
                {isExpanded && dim.subScores.length > 0 && (
                  <div className="mt-3 pl-11 space-y-2 border-t border-white/30 dark:border-white/10 pt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Objective signals (portal data)</p>
                    {dim.subScores.map(sub => (
                      <div key={sub.label} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{sub.label}</span>
                          <span className={cn("font-medium", scoreColor(sub.value))}>{sub.value?.toFixed(0) ?? "—"}%</span>
                        </div>
                        <ScoreBar score={sub.value ?? 0} color={dim.barClass + " opacity-60"} />
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Objective data is blended with your monthly survey responses to produce the final score.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Public badge preview */}
      {score && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Public Badge Preview</span>
            <Badge variant="outline" className="text-[10px]">Deployment 4 ready</Badge>
          </div>
          <p className="text-xs text-muted-foreground">This is how {caregiverName}'s badge will appear on the public directory when it launches.</p>
          <div className="bg-muted/40 rounded-lg p-3 flex items-center gap-4 flex-wrap">
            <div className="text-center">
              <HeartsDisplay value={score.heartsOverall} size="md" />
              <div className="text-[10px] text-muted-foreground mt-0.5">Overall</div>
            </div>
            {dimensions.map(dim => (
              <div key={dim.key} className="text-center">
                <HeartsDisplay value={dim.hearts} size="sm" color={dim.heartColor} />
                <div className="text-[10px] text-muted-foreground mt-0.5">{dim.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scope Badge — care breadth indicator */}
      {score && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Scope Badge</span>
            <Badge variant="outline" className="text-[10px]">Care breadth</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Shows which care domains {isCaregiver ? "you are" : `${caregiverName} is`} actively tracking.
            Not a performance grade — a snapshot of care coverage.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "medications", label: "Medications", icon: Pill, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/30" },
              { key: "vitals", label: "Vitals", icon: Activity, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30" },
              { key: "appointments", label: "Appointments", icon: Calendar, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/30" },
              { key: "activityLog", label: "Care Log", icon: ClipboardList, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/30" },
              { key: "messaging", label: "Messaging", icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30" },
            ].map(mod => {
              const isActive = scope ? Boolean(scope[mod.key as keyof typeof scope] ?? true) : true;
              const Icon = mod.icon;
              return (
                <div
                  key={mod.key}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    isActive ? mod.bg + " " + mod.color : "bg-muted/50 border-border text-muted-foreground/50"
                  )}
                  data-testid={`scope-badge-${mod.key}`}
                >
                  <Icon size={11} />
                  {mod.label}
                  {!isActive && <span className="text-[9px] opacity-60 ml-0.5">(paused)</span>}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Paused modules are excluded from badge scoring. Family contact manages scope in Care Scope settings.
          </p>
        </div>
      )}

      {/* Secondary family: simplified view */}
      {isSecondaryFamily && score && (
        <p className="text-xs text-muted-foreground text-center">
          Full score breakdown is visible to the Main Contact only.
        </p>
      )}

      {/* Caregiver own view note */}
      {isCaregiver && (
        <p className="text-xs text-muted-foreground text-center">
          This is your private care score. It is never shared with your clients directly.
        </p>
      )}

      {/* Survey Modal */}
      {surveyOpen && (
        <SurveyModal
          caregiverId={caregiverId}
          clientId={selectedClientId}
          caregiverName={caregiverName}
          onClose={() => setSurveyOpen(false)}
        />
      )}

    </div>
  );
}
