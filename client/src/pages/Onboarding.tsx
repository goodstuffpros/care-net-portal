/**
 * Onboarding Wizard — shown to new real auth users on first login.
 * Role is already set at signup — no role selection step here.
 *
 * Branches:
 *   - self_managed: Personal Profile → Client Setup (own record) → Done
 *   - caregiver:    Personal Profile → Done (connect when MC invites)
 *   - family (MC):  Personal Profile → Done (MC setup wizard follows)
 *
 * onboardingCompletedAt null → show wizard. Set → never shown again.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heart, ChevronRight, Briefcase, CheckCircle2, UserCog, Mail, SkipForward } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface OnboardingProps {
  email: string;
  onComplete: () => void;
  initialRole?: string; // pre-set from signup
}

export default function Onboarding({ email, onComplete, initialRole }: OnboardingProps) {
  const { toast } = useToast();

  const isCG = initialRole === "caregiver" || initialRole === "multi_caregiver" || initialRole === "temp_caregiver";
  const isSelfManaged = initialRole === "self_managed" || initialRole === "self_care";
  const roleLabel = isCG ? "Caregiver" : isSelfManaged ? "Self-Managed Care" : "Main Contact";

  // ── Shared profile state ────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Self-managed client setup state ────────────────────────────────────────
  const [clientName, setClientName] = useState("");
  const [clientDob, setClientDob] = useState("");
  const [clientCondition, setClientCondition] = useState("");
  const [inviteMcEmail, setInviteMcEmail] = useState("");
  const [setupSaving, setSetupSaving] = useState(false);

  // ── Step machine ────────────────────────────────────────────────────────────
  type Step = "profile" | "client_setup" | "done";
  const [step, setStep] = useState<Step>("profile");

  // CG invite follow-through — set when CG arrived via mc_to_caregiver invite
  const [connectedClientName, setConnectedClientName] = useState<string | null>(null);

  // ── Save profile ────────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const profileRole = isSelfManaged ? "caregiver" : (initialRole || "primary_family");
      await apiRequest("POST", "/api/onboarding/profile", {
        name: name.trim(),
        phone: phone.trim(),
        role: profileRole,
      });

      if (isSelfManaged) {
        // Pre-fill client name from user's own name
        setClientName(name.trim());
        setStep("client_setup");
      } else {
        const completeRes = await apiRequest("POST", "/api/onboarding/complete", {});
        const completeData = await completeRes.json();
        if (completeData.connectedClient?.clientName) {
          setConnectedClientName(completeData.connectedClient.clientName);
        }
        setStep("done");
      }
    } catch (e: any) {
      toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Save self-care client setup ─────────────────────────────────────────────
  async function saveSelfCareSetup() {
    if (!clientName.trim()) return;
    setSetupSaving(true);
    try {
      await apiRequest("POST", "/api/onboarding/self-care-setup", {
        clientName: clientName.trim(),
        clientDob: clientDob.trim() || undefined,
        clientCondition: clientCondition.trim() || undefined,
        inviteMcEmail: inviteMcEmail.trim() || undefined,
      });
      setStep("done");
    } catch (e: any) {
      toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
    } finally {
      setSetupSaving(false);
    }
  }

  function enterApp() {
    // Full reload so RealAuthGate re-checks session
    // self_care lands on Client Profile so they can complete their record right away
    if (isSelfManaged) {
      window.location.href = "/#/portal";
    } else {
      window.location.href = "/";
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
        <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
        <span className="font-semibold text-foreground text-sm">Care Net Portal</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* ── Step: Profile ── */}
          {step === "profile" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">

              {/* Role badge */}
              <div className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 mb-8 border",
                isSelfManaged
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
                  : isCG
                    ? "bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900"
                    : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  isSelfManaged ? "bg-emerald-600 text-white" : isCG ? "bg-teal-600 text-white" : "bg-rose-500 text-white"
                )}>
                  {isSelfManaged
                    ? <UserCog className="w-4 h-4" />
                    : isCG
                      ? <Briefcase className="w-4 h-4" />
                      : <Heart className="w-4 h-4" />
                  }
                </div>
                <div>
                  <p className={cn(
                    "text-sm font-semibold",
                    isSelfManaged ? "text-emerald-700 dark:text-emerald-400"
                    : isCG ? "text-teal-700 dark:text-teal-400"
                    : "text-rose-700 dark:text-rose-400"
                  )}>
                    Signing up as: {roleLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isSelfManaged
                      ? "Next, you'll create your own care record."
                      : isCG
                        ? "You'll connect with a client's family after they invite you."
                        : "You'll set up your loved one's profile right after this."}
                  </p>
                </div>
              </div>

              <h1 className="text-xl font-bold text-foreground mb-2">Tell us about yourself</h1>
              <p className="text-sm text-muted-foreground mb-8">
                This is how you'll appear to others in your care circle.
              </p>

              <div className="space-y-4 mb-8">
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

              <Button
                className={cn(
                  "w-full",
                  isSelfManaged ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : isCG ? "bg-teal-600 hover:bg-teal-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
                )}
                disabled={!name.trim() || saving}
                onClick={saveProfile}
                data-testid="btn-save-profile"
              >
                {saving ? "Saving…" : "Continue"}
                {!saving && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          )}

          {/* ── Step: Self-Care Client Setup ── */}
          {step === "client_setup" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">

              <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-8 border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                  <UserCog className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Your care record</p>
                  <p className="text-xs text-muted-foreground">This record belongs to you — you're both the caregiver and the care recipient.</p>
                </div>
              </div>

              <h1 className="text-xl font-bold text-foreground mb-2">Set up your care record</h1>
              <p className="text-sm text-muted-foreground mb-8">
                This is the profile your care circle will see. You can update it any time.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <Label htmlFor="client-name" className="text-sm font-medium">Your name (as care recipient)</Label>
                  <Input
                    id="client-name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="First and last name"
                    className="mt-1.5"
                    data-testid="input-client-name"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="client-dob" className="text-sm font-medium">
                    Date of birth <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="client-dob"
                    type="date"
                    value={clientDob}
                    onChange={(e) => setClientDob(e.target.value)}
                    className="mt-1.5"
                    data-testid="input-client-dob"
                  />
                </div>
                <div>
                  <Label htmlFor="client-condition" className="text-sm font-medium">
                    Primary condition or reason for care <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="client-condition"
                    value={clientCondition}
                    onChange={(e) => setClientCondition(e.target.value)}
                    placeholder="e.g. Type 2 diabetes, post-surgery recovery"
                    className="mt-1.5"
                    data-testid="input-client-condition"
                  />
                </div>
              </div>

              {/* Optional MC invite */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 mb-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm font-medium text-foreground">Invite a family member as Main Contact</p>
                  <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A Main Contact can see your care record and support you from the background. You stay fully in control — they can't change anything without your permission.
                </p>
                <Input
                  type="email"
                  placeholder="mom@example.com"
                  value={inviteMcEmail}
                  onChange={(e) => setInviteMcEmail(e.target.value)}
                  data-testid="input-invite-mc-email"
                />
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!clientName.trim() || setupSaving}
                  onClick={saveSelfCareSetup}
                  data-testid="btn-save-self-care-setup"
                >
                  {setupSaving ? "Setting up…" : inviteMcEmail.trim() ? "Set up & send invite" : "Set up my care record"}
                  {!setupSaving && <ChevronRight className="w-4 h-4 ml-1" />}
                </Button>
                {inviteMcEmail.trim() && (
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground text-center flex items-center justify-center gap-1"
                    onClick={() => { setInviteMcEmail(""); saveSelfCareSetup(); }}
                    disabled={setupSaving}
                    data-testid="btn-skip-mc-invite"
                  >
                    <SkipForward className="w-3 h-3" /> Skip for now — I'll invite them later
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6",
                isSelfManaged ? "bg-emerald-600/10 border border-emerald-600/20"
                : isCG ? "bg-teal-600/10 border border-teal-600/20"
                : "bg-rose-500/10 border border-rose-500/20"
              )}>
                <CheckCircle2 className={cn(
                  "w-8 h-8",
                  isSelfManaged ? "text-emerald-600" : isCG ? "text-teal-600" : "text-rose-500"
                )} />
              </div>

              <h1 className="text-xl font-bold text-foreground mb-3">
                If you did that, you can do everything in this app!
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-sm mx-auto">
                {isSelfManaged
                  ? "Your care record is ready. You're in full control of your portal. Head to Care Net University to get familiar with the tools."
                  : isCG
                    ? connectedClientName
                      ? `You're already connected to ${connectedClientName}'s portal. Head to Care Net University to get familiar with the tools.`
                      : "Your profile is set up. When a Main Contact invites you, your portals will connect automatically. Head to Care Net University to get familiar with the tools."
                    : "Your profile is ready. Next, you'll set up your loved one's profile — that's the heart of everything in Care Net Portal."}
              </p>

              <Button
                className={cn(
                  "w-full",
                  isSelfManaged ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : isCG ? "bg-teal-600 hover:bg-teal-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
                )}
                onClick={enterApp}
                data-testid="btn-enter-app"
              >
                {isSelfManaged ? (
                  <><UserCog className="w-4 h-4 mr-2" />Enter Care Net Portal</>
                ) : isCG ? (
                  <><Briefcase className="w-4 h-4 mr-2" />Enter Care Net Portal</>
                ) : (
                  <><Heart className="w-4 h-4 mr-2 fill-current" />Set up my loved one's profile</>
                )}
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
