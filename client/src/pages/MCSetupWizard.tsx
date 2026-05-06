/**
 * MCSetupWizard — shown to MC/family users after onboarding wizard.
 * Builds their care circle before they enter the portal.
 *
 * Steps:
 *   1. welcome     — warm intro, sets expectations ("3 minutes")
 *   2. loved-one   — name, relationship, optional DOB + condition
 *   3. care-path   — "I have a caregiver" | "I'm managing care myself"
 *   4. family      — optional: invite secondary family members
 *   5. done        — celebration, enter portal
 */

import { useState } from "react";
import {
  Heart, ChevronRight, ChevronLeft, User, Calendar, Stethoscope,
  Users, UserPlus, Check, Copy, Briefcase, Home, Sparkles, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MCSetupProps {
  name: string;
  email: string;
  onComplete: () => void;
}

type Step = "welcome" | "loved-one" | "care-path" | "family" | "done";
type CarePath = "has_caregiver" | "self_managing" | null;

const RELATIONSHIPS = [
  "Parent", "Spouse / Partner", "Sibling", "Grandparent",
  "Child", "Relative", "Friend", "Other"
];

const STEP_ORDER: Step[] = ["welcome", "loved-one", "care-path", "family", "done"];

function ProgressDots({ current }: { current: Step }) {
  const steps: Step[] = ["loved-one", "care-path", "family"];
  return (
    <div className="flex items-center gap-1.5 justify-center mb-8">
      {steps.map((s) => {
        const idx = STEP_ORDER.indexOf(s);
        const curIdx = STEP_ORDER.indexOf(current);
        const done = curIdx > idx;
        const active = current === s;
        return (
          <div
            key={s}
            className={cn(
              "rounded-full transition-all duration-300",
              active ? "w-5 h-2 bg-primary" :
              done   ? "w-2 h-2 bg-primary/50" :
                       "w-2 h-2 bg-muted"
            )}
          />
        );
      })}
    </div>
  );
}

export default function MCSetupWizard({ name, email, onComplete }: MCSetupProps) {
  const { toast } = useToast();
  const firstName = name.split(" ")[0];

  const [step, setStep] = useState<Step>("welcome");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Loved one fields
  const [clientName, setClientName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [clientDob, setClientDob] = useState("");
  const [clientCondition, setClientCondition] = useState("");

  // Care path
  const [carePath, setCarePath] = useState<CarePath>(null);

  // Invite link
  const inviteLink = `https://care-net-portal-production.up.railway.app/#/apply?ref=${encodeURIComponent(email)}`;

  function copyInvite() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast({ title: "Link copied", description: "Send it to your caregiver to connect your portals." });
      setTimeout(() => setCopied(false), 3000);
    });
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await apiRequest("POST", "/api/mc/setup", {
        clientName: clientName.trim(),
        clientDob: clientDob || null,
        clientCondition: clientCondition.trim() || null,
        clientRelationship: relationship || null,
        carePathChoice: carePath || "self_managing",
      });
      setStep("done");
    } catch (e: any) {
      toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function enterPortal() {
    // Full reload — RealAuthGate re-checks session, now has clientId set
    window.location.href = "/";
  }

  // ── Step: Welcome ────────────────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <Layout>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-5">
            <Heart className="w-7 h-7 text-rose-500 fill-rose-500/20" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Welcome, {firstName}.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Let's set up your care circle. We'll ask you a few things about your loved one and how you'd like to use the portal.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">About 3 minutes</p>
        </div>

        <div className="space-y-2.5 mb-8 text-sm">
          {[
            { icon: <User className="w-4 h-4" />, text: "Tell us about your loved one" },
            { icon: <Briefcase className="w-4 h-4" />, text: "Choose how you'll manage care" },
            { icon: <Users className="w-4 h-4" />, text: "Option to invite family members" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/40">
              <span className="text-muted-foreground">{icon}</span>
              <span className="text-foreground/80">{text}</span>
            </div>
          ))}
        </div>

        <Button onClick={() => setStep("loved-one")} className="w-full gap-2">
          Get started <ArrowRight className="w-4 h-4" />
        </Button>
      </Layout>
    );
  }

  // ── Step: Loved One ──────────────────────────────────────────────────────
  if (step === "loved-one") {
    return (
      <Layout>
        <ProgressDots current="loved-one" />
        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-1">Tell us about your loved one</h2>
          <p className="text-sm text-muted-foreground">This is who the portal is built around.</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Their name <span className="text-rose-400">*</span></Label>
            <Input
              id="client-name"
              placeholder="Full name"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Your relationship to them</Label>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIPS.map(r => (
                <button
                  key={r}
                  onClick={() => setRelationship(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    relationship === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground/70 border-border hover:border-primary/40"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-dob" className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Date of birth <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="client-dob"
              type="date"
              value={clientDob}
              onChange={e => setClientDob(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-condition" className="flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-muted-foreground" />
              Primary condition or care need <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="client-condition"
              placeholder="e.g. Dementia, post-surgery recovery, aging in place"
              value={clientCondition}
              onChange={e => setClientCondition(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("welcome")} className="gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            onClick={() => setStep("care-path")}
            disabled={!clientName.trim()}
            className="flex-1 gap-2"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </Layout>
    );
  }

  // ── Step: Care Path ──────────────────────────────────────────────────────
  if (step === "care-path") {
    return (
      <Layout>
        <ProgressDots current="care-path" />
        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-1">How are you managing care?</h2>
          <p className="text-sm text-muted-foreground">
            This helps us set up {clientName}'s portal the right way.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <button
            onClick={() => setCarePath("has_caregiver")}
            className={cn(
              "w-full text-left p-4 rounded-xl border transition-all",
              carePath === "has_caregiver"
                ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-primary/30"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                carePath === "has_caregiver" ? "bg-primary" : "bg-muted"
              )}>
                <Briefcase className={cn("w-4 h-4", carePath === "has_caregiver" ? "text-primary-foreground" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">I have a professional caregiver</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You'll invite them to connect their portal with yours. They manage care, you stay informed.
                </p>
              </div>
              {carePath === "has_caregiver" && (
                <Check className="w-4 h-4 text-primary ml-auto flex-shrink-0 mt-1" />
              )}
            </div>
          </button>

          <button
            onClick={() => setCarePath("self_managing")}
            className={cn(
              "w-full text-left p-4 rounded-xl border transition-all",
              carePath === "self_managing"
                ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-primary/30"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                carePath === "self_managing" ? "bg-primary" : "bg-muted"
              )}>
                <Home className={cn("w-4 h-4", carePath === "self_managing" ? "text-primary-foreground" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">I'm managing care myself</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Family members provide care. You can still invite family to stay in the loop, and connect a caregiver later if needed.
                </p>
              </div>
              {carePath === "self_managing" && (
                <Check className="w-4 h-4 text-primary ml-auto flex-shrink-0 mt-1" />
              )}
            </div>
          </button>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("loved-one")} className="gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            onClick={() => setStep("family")}
            disabled={!carePath}
            className="flex-1 gap-2"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </Layout>
    );
  }

  // ── Step: Family ─────────────────────────────────────────────────────────
  if (step === "family") {
    return (
      <Layout>
        <ProgressDots current="family" />
        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-1">
            {carePath === "has_caregiver" ? "Invite your caregiver" : "Invite family members"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {carePath === "has_caregiver"
              ? "Share this link with your caregiver. When they sign up, your portals connect automatically."
              : "Want to keep other family members in the loop? Share this link with them."}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card mb-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Your invite link</p>
          <p className="text-xs text-foreground/70 break-all font-mono bg-muted rounded-md px-3 py-2 mb-3 select-all">
            {inviteLink}
          </p>
          <Button onClick={copyInvite} variant="outline" size="sm" className="w-full gap-2">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy invite link"}
          </Button>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 mb-8">
          <Sparkles className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            You can also invite people from inside the portal at any time. This step is optional.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("care-path")} className="gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            onClick={handleFinish}
            disabled={saving}
            className="flex-1 gap-2"
          >
            {saving ? "Setting up…" : "Enter my portal"}
            {!saving && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </Layout>
    );
  }

  // ── Step: Done ───────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <Layout>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {clientName}'s portal is ready.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto mb-8">
            {carePath === "has_caregiver"
              ? "Once your caregiver accepts your invite, both portals will connect and you'll each see each other's updates in real time."
              : "Your family portal is set up. You can invite family members or a caregiver at any time from inside the portal."}
          </p>

          {carePath === "has_caregiver" && !copied && (
            <div className="mb-6">
              <Button onClick={copyInvite} variant="outline" size="sm" className="gap-2 mx-auto">
                <Copy className="w-3.5 h-3.5" />
                Copy caregiver invite link
              </Button>
            </div>
          )}

          <Button onClick={enterPortal} className="w-full gap-2 bg-rose-600 hover:bg-rose-700 text-white">
            <Heart className="w-4 h-4 fill-white/30" />
            Enter Care Net Portal
          </Button>
        </div>
      </Layout>
    );
  }

  return null;
}

// ── Shared layout wrapper ────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
        <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
        <span className="font-semibold text-foreground text-sm">Care Net Portal</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
