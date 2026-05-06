/**
 * OnboardingFlow — new caregiver welcome experience
 *
 * Triggers: auto on first login (no onboardingCompletedAt on user).
 * Also accessible from Settings for 30 days post-signup.
 *
 * Two modes:
 *  - "quick"  (default) — 4 screens: Welcome → 3 core actions → Done
 *  - "full"   — 8 screens: all major modules, tech-savvy path
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  X, ChevronRight, ChevronLeft, Timer, ClipboardList,
  MessageSquare, BookHeart, Pill, Activity, Award,
  LayoutDashboard, Sparkles, Heart, Check, GraduationCap
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: string;
  tip?: string;
  actionLabel?: string;
  actionPath?: string;
}

// ── Step definitions ──────────────────────────────────────────────────────────

const QUICK_STEPS: Step[] = [
  {
    id: "welcome",
    icon: <Heart size={32} className="text-white" fill="white" />,
    iconBg: "bg-primary",
    title: "Welcome to Care Net Portal",
    body: "This is your private space to document care, stay connected with the family, and build a professional record you can be proud of.",
    tip: "Everything you do here — every note, every check-in — becomes part of your professional story.",
  },
  {
    id: "clockin",
    icon: <Timer size={32} className="text-white" />,
    iconBg: "bg-teal-600",
    title: "Start every shift with a clock-in",
    body: "The clock-in button is in the sidebar. One tap to begin your shift. One tap to close it. Your hours are tracked automatically.",
    tip: "Clock-ins feed your Dependability score — one of four dimensions in your Care Badge.",
    actionLabel: "Go to Dashboard",
    actionPath: "/",
  },
  {
    id: "activitylog",
    icon: <ClipboardList size={32} className="text-white" />,
    iconBg: "bg-indigo-600",
    title: "Log one thing from each visit",
    body: "After your clock-in, jot a quick note in the Activity Log. It doesn't have to be long — even \"Ate well, good spirits\" is valuable to the family.",
    tip: "Normal, Important, and Urgent flags help the family know what needs their attention.",
    actionLabel: "Open Activity Log",
    actionPath: "/activity",
  },
  {
    id: "messages",
    icon: <MessageSquare size={32} className="text-white" />,
    iconBg: "bg-violet-600",
    title: "Keep the family in the loop",
    body: "Send a brief update through Messages after each visit. Families feel the most at ease when they hear from you directly — even a short message goes a long way.",
    tip: "Response quality matters to your Communication score. A thoughtful reply always beats a one-word answer.",
    actionLabel: "Open Messages",
    actionPath: "/messages",
  },
];

const FULL_EXTRA_STEPS: Step[] = [
  {
    id: "medications",
    icon: <Pill size={32} className="text-white" />,
    iconBg: "bg-rose-500",
    title: "Track medications",
    body: "Log every dose in the Medications module. The family can see what was given and when — no guessing, no missed doses.",
    tip: "Medication accuracy feeds your Knowledge dimension score.",
    actionLabel: "Open Medications",
    actionPath: "/medications",
  },
  {
    id: "vitals",
    icon: <Activity size={32} className="text-white" />,
    iconBg: "bg-emerald-600",
    title: "Record vitals when relevant",
    body: "Blood pressure, temperature, weight, oxygen — log whatever you monitor. Trends are visualized automatically so the family and medical team can see patterns.",
    tip: "Consistent vitals logging shows clinical attentiveness — it shows.",
    actionLabel: "Open Vitals",
    actionPath: "/vitals",
  },
  {
    id: "thoughts",
    icon: <BookHeart size={32} className="text-white" />,
    iconBg: "bg-amber-500",
    title: "Capture the stories",
    body: "When your client shares a memory, a funny story, or something that matters to them — write it down in A Collection of Thoughts. It's private until you choose to gift it to the family.",
    tip: "This is the feature families remember most. It turns the end of care into a lasting gift.",
    actionLabel: "Open Collection of Thoughts",
    actionPath: "/thoughts",
  },
  {
    id: "badges",
    icon: <Award size={32} className="text-white" />,
    iconBg: "bg-primary",
    title: "Your Care Badge builds over time",
    body: "Everything you do in this portal — your response quality, your dependability, how families rate your connection — contributes to your Care Badge. It's your professional reputation, built scientifically.",
    tip: "Connection carries the most weight (32%) because families remember if you were a good human being.",
    actionLabel: "View My Badge",
    actionPath: "/badges",
  },
];

const DONE_STEP: Step = {
  id: "done",
  icon: <Sparkles size={32} className="text-white" />,
  iconBg: "bg-primary",
  title: "You're all set",
  body: "Start with a clock-in. Log one note. Send one message. That's a great first shift on Care Net Portal.",
  tip: "You can revisit this guide from Settings any time in your first 30 days.",
};

// ── Component ────────────────────────────────────────────────────────────────

interface OnboardingFlowProps {
  userId: number;
  onComplete: () => void;
  onNavigate: (path: string) => void;
  onOpenUniversity?: () => void;
}

export default function OnboardingFlow({ userId, onComplete, onNavigate, onOpenUniversity }: OnboardingFlowProps) {
  const [mode, setMode] = useState<"quick" | "full" | null>(null); // null = not yet chosen
  const [stepIndex, setStepIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const completeMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/users/${userId}`, {
        onboardingCompletedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      onComplete();
    },
  });

  // Build steps array based on mode
  const steps: Step[] =
    mode === "quick"
      ? [...QUICK_STEPS, DONE_STEP]
      : mode === "full"
      ? [...QUICK_STEPS, ...FULL_EXTRA_STEPS, DONE_STEP]
      : [];

  const isLastStep = mode !== null && stepIndex === steps.length - 1;
  const progress = mode !== null ? ((stepIndex + 1) / steps.length) * 100 : 0;
  const currentStep = mode !== null ? steps[stepIndex] : null;

  function handleNext() {
    if (isLastStep) {
      completeMutation.mutate();
    } else {
      setStepIndex(i => i + 1);
    }
  }

  function handleBack() {
    if (stepIndex === 0) {
      setMode(null); // back to mode picker
    } else {
      setStepIndex(i => i - 1);
    }
  }

  function handleNavigateAndClose(path: string) {
    completeMutation.mutate();
    onNavigate(path);
  }

  function handleSkip() {
    setLeaving(true);
    setTimeout(() => completeMutation.mutate(), 200);
  }

  // ── Backdrop + container ──────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200",
        leaving ? "opacity-0" : "opacity-100"
      )}
      data-testid="onboarding-overlay"
    >
      <div className="relative w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden">

        {/* Skip button */}
        <button
          data-testid="onboarding-skip"
          onClick={handleSkip}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Skip introduction"
        >
          <X size={18} />
        </button>

        {/* ── Mode picker (before mode is chosen) ── */}
        {mode === null && (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-5">
              <Heart size={30} className="text-white" fill="white" />
            </div>
            <h2
              className="text-xl font-bold text-foreground mb-2"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
            >
              Welcome to Care Net Portal
            </h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              How would you like to get started?
            </p>

            <div className="space-y-3">
              <button
                data-testid="onboarding-mode-quick"
                onClick={() => { setMode("quick"); setStepIndex(0); }}
                className="w-full text-left p-4 rounded-xl border-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                    <Timer size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">Quick start</div>
                    <div className="text-xs text-muted-foreground mt-0.5">3 core actions · 2 minutes</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </button>

              <button
                data-testid="onboarding-mode-full"
                onClick={() => { setMode("full"); setStepIndex(0); }}
                className="w-full text-left p-4 rounded-xl border-2 border-border hover:border-primary/30 hover:bg-muted/40 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <LayoutDashboard size={18} className="text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">Full tour</div>
                    <div className="text-xs text-muted-foreground mt-0.5">All features · 5 minutes</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </button>

              {/* University option */}
              {onOpenUniversity && (
                <button
                  data-testid="onboarding-mode-university"
                  onClick={() => { completeMutation.mutate(); onOpenUniversity(); }}
                  className="w-full text-left p-4 rounded-xl border-2 border-border hover:border-primary/30 hover:bg-muted/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
                      <GraduationCap size={18} className="text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground">Learn with Becky</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Voice-guided · Care Net University</div>
                    </div>
                    <ChevronRight size={16} className="ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              )}
            </div>

            <button
              onClick={handleSkip}
              className="mt-5 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* ── Step view ── */}
        {mode !== null && currentStep && (
          <>
            {/* Progress bar */}
            <div className="h-1 bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="p-8">
              {/* Step counter */}
              <div className="text-xs text-muted-foreground mb-5 font-medium tracking-wide">
                STEP {stepIndex + 1} OF {steps.length}
              </div>

              {/* Icon */}
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-5", currentStep.iconBg)}>
                {currentStep.icon}
              </div>

              {/* Title */}
              <h2
                className="text-lg font-bold text-foreground mb-2"
                style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                data-testid="onboarding-step-title"
              >
                {currentStep.title}
              </h2>

              {/* Body */}
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {currentStep.body}
              </p>

              {/* Tip */}
              {currentStep.tip && (
                <div className="flex gap-2.5 p-3 rounded-lg bg-primary/8 dark:bg-primary/10 border border-primary/15 mb-6">
                  <Sparkles size={14} className="text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 leading-relaxed">{currentStep.tip}</p>
                </div>
              )}

              {/* Done step: dot indicators */}
              {currentStep.id === "done" && (
                <div className="flex justify-center gap-1.5 mb-6">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-colors",
                        i < stepIndex ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="gap-1.5 text-muted-foreground"
                  data-testid="onboarding-back"
                >
                  <ChevronLeft size={15} />
                  Back
                </Button>

                <div className="flex items-center gap-2">
                  {/* Optional navigate-to-feature button */}
                  {currentStep.actionLabel && currentStep.actionPath && currentStep.id !== "done" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNavigateAndClose(currentStep.actionPath!)}
                      data-testid={`onboarding-goto-${currentStep.id}`}
                      className="text-xs gap-1.5"
                    >
                      {currentStep.actionLabel}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={handleNext}
                    disabled={completeMutation.isPending}
                    className="gap-1.5"
                    data-testid="onboarding-next"
                  >
                    {isLastStep ? (
                      <><Check size={14} /> Let's go</>
                    ) : (
                      <>Next <ChevronRight size={14} /></>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
