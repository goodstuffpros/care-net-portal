/**
 * Onboarding Wizard — shown to new real auth users on first login.
 * Collects role + basic profile, then shows a role-specific welcome tour.
 * onboardingCompletedAt null → show wizard. Set → never shown again.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, ChevronRight, Users, Briefcase, CheckCircle2, CalendarDays, NotebookPen, MessageSquare, Activity, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface OnboardingProps {
  email: string;
  onComplete: () => void;
  initialRole?: Role; // pre-set from signup — skips role selection step
}

type Role = "caregiver" | "primary_family" | "secondary_family";

const ROLES: { value: Role; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "caregiver",
    label: "Caregiver",
    description: "I provide care professionally or personally",
    icon: <Briefcase className="w-5 h-5" />,
  },
  {
    value: "primary_family",
    label: "Main Contact (MC)",
    description: "I'm the primary family contact managing care",
    icon: <Heart className="w-5 h-5" />,
  },
  {
    value: "secondary_family",
    label: "Family Member",
    description: "I'm a family member staying informed",
    icon: <Users className="w-5 h-5" />,
  },
];

// Tour steps per role
const CG_TOUR = [
  { icon: <CalendarDays className="w-6 h-6 text-primary" />, title: "Schedule", body: "Every shift, appointment, and task lives here. You'll always know what's coming and what's done." },
  { icon: <NotebookPen className="w-6 h-6 text-primary" />, title: "Care Log", body: "Document care as it happens. Quick entries that keep the whole family informed without a single phone call." },
  { icon: <MessageSquare className="w-6 h-6 text-primary" />, title: "Messages", body: "Direct communication with the family — clear, documented, and always in context." },
  { icon: <Activity className="w-6 h-6 text-primary" />, title: "Vitals", body: "Log and track health data over time. Patterns you'd never catch otherwise become visible." },
  { icon: <Sparkles className="w-6 h-6 text-primary" />, title: "Care Net University", body: "Before your first client, this is your home base. Learn the tools, practice in the demo, get ready." },
];

const MC_TOUR = [
  { icon: <CalendarDays className="w-6 h-6 text-primary" />, title: "Schedule", body: "See exactly what's happening, when. No more wondering what's going on during a shift." },
  { icon: <NotebookPen className="w-6 h-6 text-primary" />, title: "Care Log", body: "Every care entry from your caregiver, in real time. You're always in the loop — without interrupting anyone." },
  { icon: <MessageSquare className="w-6 h-6 text-primary" />, title: "Messages", body: "Talk directly with your caregiver. Clear threads, no lost texts, no confusion." },
  { icon: <Activity className="w-6 h-6 text-primary" />, title: "Vitals", body: "Health trends over time, right in front of you. Bring this to any doctor's appointment." },
  { icon: <Heart className="w-6 h-6 text-primary" />, title: "Your Care Circle", body: "Invite your caregiver and other family members. Everyone on the same page, always." },
];

type Step = "role" | "profile" | "tour" | "done";

export default function Onboarding({ email, onComplete, initialRole }: OnboardingProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(initialRole ? "profile" : "role");
  const [role, setRole] = useState<Role | null>(initialRole ?? null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tourIndex, setTourIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const tourSteps = role === "caregiver" ? CG_TOUR : MC_TOUR;
  const isLastTourStep = tourIndex === tourSteps.length - 1;

  async function saveProfile() {
    if (!name.trim() || !role) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/onboarding/profile", { name: name.trim(), phone: phone.trim(), role });
      setStep("tour");
    } catch (e: any) {
      toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function completeOnboarding() {
    try {
      await apiRequest("POST", "/api/onboarding/complete", {});
    } catch {}
    // Full reload so RealAuthGate re-checks session and enters the real app
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">

      {/* Logo */}
      <div className="flex items-center gap-2 text-primary font-semibold text-lg mb-10">
        <Heart className="w-5 h-5 fill-primary" />
        Care Net Portal
      </div>

      {/* ── Step 1: Role selection ── */}
      {step === "role" && (
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h1 className="text-xl font-bold text-foreground text-center mb-2">Welcome to Care Net Portal</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Let's get you set up. First — which best describes you?
          </p>
          <div className="space-y-3">
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                data-testid={`role-${r.value}`}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                  role === r.value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className={cn("p-2 rounded-lg", role === r.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {r.icon}
                </div>
                <div>
                  <div className="font-medium text-foreground text-sm">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.description}</div>
                </div>
                {role === r.value && <CheckCircle2 className="w-5 h-5 text-primary ml-auto shrink-0" />}
              </button>
            ))}
          </div>
          <Button
            className="w-full mt-6"
            disabled={!role}
            onClick={() => setStep("profile")}
            data-testid="btn-next-role"
          >
            Continue <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Profile basics ── */}
      {step === "profile" && (
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h1 className="text-xl font-bold text-foreground text-center mb-2">Tell us about yourself</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            This is how you'll appear to others in your care circle.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium">Your full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First and last name"
                className="mt-1.5"
                data-testid="input-name"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone number <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="mt-1.5"
                data-testid="input-phone"
                type="tel"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <Input value={email} disabled className="mt-1.5 opacity-60" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            {!initialRole && (
              <Button variant="outline" onClick={() => setStep("role")} className="flex-1">
                Back
              </Button>
            )}
            <Button
              className="flex-1"
              disabled={!name.trim() || saving}
              onClick={saveProfile}
              data-testid="btn-save-profile"
            >
              {saving ? "Saving…" : "Continue"}
              {!saving && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Tour ── */}
      {step === "tour" && (
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          {tourIndex === 0 && (
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">🎉</div>
              <h1 className="text-xl font-bold text-foreground mb-2">
                If you did that, you can do everything in this app!
              </h1>
              <p className="text-sm text-muted-foreground">
                Here's a quick look at what's waiting for you.
              </p>
            </div>
          )}

          {/* Tour card */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-primary/10 rounded-xl p-3">
                {tourSteps[tourIndex].icon}
              </div>
              <h2 className="text-base font-semibold text-foreground">{tourSteps[tourIndex].title}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {tourSteps[tourIndex].body}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all",
                  i === tourIndex ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          <Button
            className="w-full"
            onClick={() => {
              if (isLastTourStep) {
                setStep("done");
              } else {
                setTourIndex(i => i + 1);
              }
            }}
            data-testid="btn-tour-next"
          >
            {isLastTourStep ? "Take me in" : "Next"}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>

          {!isLastTourStep && (
            <button
              onClick={() => setStep("done")}
              className="w-full text-center text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
              data-testid="btn-skip-tour"
            >
              Skip tour
            </button>
          )}
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === "done" && (
        <div className="w-full max-w-md text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-5xl mb-4">🌟</div>
          <h1 className="text-xl font-bold text-foreground mb-3">You're all set</h1>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            {role === "caregiver"
              ? "Head to Care Net University to get started. Your first client portal is waiting for you when you're ready."
              : "Your care circle is ready to be built. Start by setting up your loved one's profile and inviting your caregiver."}
          </p>
          <Button
            className="w-full"
            onClick={completeOnboarding}
            data-testid="btn-enter-app"
          >
            <Heart className="w-4 h-4 mr-2 fill-current" />
            Enter Care Net Portal
          </Button>
        </div>
      )}

    </div>
  );
}
