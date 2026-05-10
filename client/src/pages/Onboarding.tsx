/**
 * Onboarding Wizard — shown to new real auth users on first login.
 * Role is already set at signup — no role selection step here.
 * Steps: Personal Profile → done message → enter app.
 * onboardingCompletedAt null → show wizard. Set → never shown again.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, ChevronRight, Briefcase, CheckCircle2 } from "lucide-react";
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
  const [step, setStep] = useState<"profile" | "done">("profile");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const isCG = initialRole === "caregiver";
  const roleLabel = isCG ? "Caregiver" : "Main Contact";

  async function saveProfile() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/onboarding/profile", {
        name: name.trim(),
        phone: phone.trim(),
        role: initialRole || "primary_family",
      });
      await apiRequest("POST", "/api/onboarding/complete", {});
      setStep("done");
    } catch (e: any) {
      toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function enterApp() {
    // Full reload so RealAuthGate re-checks session
    window.location.href = "/";
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
                isCG
                  ? "bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900"
                  : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  isCG ? "bg-teal-600 text-white" : "bg-rose-500 text-white"
                )}>
                  {isCG ? <Briefcase className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", isCG ? "text-teal-700 dark:text-teal-400" : "text-rose-700 dark:text-rose-400")}>
                    Signing up as: {roleLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isCG
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
                  isCG ? "bg-teal-600 hover:bg-teal-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
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

          {/* ── Step: Done ── */}
          {step === "done" && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6",
                isCG ? "bg-teal-600/10 border border-teal-600/20" : "bg-rose-500/10 border border-rose-500/20"
              )}>
                <CheckCircle2 className={cn("w-8 h-8", isCG ? "text-teal-600" : "text-rose-500")} />
              </div>

              <h1 className="text-xl font-bold text-foreground mb-3">
                If you did that, you can do everything in this app!
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-sm mx-auto">
                {isCG
                  ? "Your profile is set up. When a Main Contact invites you, your portals will connect automatically. Head to Care Net University to get familiar with the tools."
                  : "Your profile is ready. Next, you'll set up your loved one's profile — that's the heart of everything in Care Net Portal."}
              </p>

              <Button
                className={cn(
                  "w-full",
                  isCG ? "bg-teal-600 hover:bg-teal-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
                )}
                onClick={enterApp}
                data-testid="btn-enter-app"
              >
                {isCG ? (
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
