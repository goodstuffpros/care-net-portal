/**
 * Beta Application form — /apply
 * If ?invite=TOKEN is present:
 *   - Fetches invite context (senderName, clientName, inviteType)
 *   - Pre-fills and locks the role field
 *   - Strips the lengthy beta-screening questions (intent, currentlyInCare)
 *   - After account created + email verified, auto-accepts the invite
 * Normal path: full beta application form with screening questions.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Heart, Mail, Eye, EyeOff, Users, ArrowRight } from "lucide-react";

interface InviteContext {
  valid: boolean;
  senderName: string;
  clientName: string | null;
  inviteType: string;
}

function inviteRoleLabel(inviteType: string): { role: "caregiver" | "family"; display: string } {
  if (inviteType === "mc_to_caregiver") return { role: "caregiver", display: "Caregiver" };
  if (inviteType === "caregiver_to_mc") return { role: "family", display: "Main Contact (Family)" };
  if (inviteType === "mc_to_family")    return { role: "family", display: "Family Member" };
  return { role: "family", display: "Family Member" };
}

export default function ApplyPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Read invite token from URL query param or sessionStorage
  const urlParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const inviteToken = urlParams.get("invite") || sessionStorage.getItem("pending_invite_token") || null;

  const [inviteCtx, setInviteCtx] = useState<InviteContext | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);

  useEffect(() => {
    if (!inviteToken) return;
    apiRequest("GET", `/api/invite/${inviteToken}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) setInviteCtx(data);
        setInviteLoading(false);
      })
      .catch(() => setInviteLoading(false));
  }, [inviteToken]);

  const isInvited = !!inviteCtx?.valid;
  const inviteRole = inviteCtx ? inviteRoleLabel(inviteCtx.inviteType) : null;

  const [stage, setStage] = useState<"form" | "check-email">("form");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "" as "" | "caregiver" | "family" | "both" | "other",
    currentlyInCare: "" as "" | "yes" | "no" | "soon",
    intent: "",
    agreedToConfidentiality: false,
  });

  // Pre-fill role once invite context loads
  useEffect(() => {
    if (inviteRole) setForm(f => ({ ...f, role: inviteRole.role, currentlyInCare: "yes", intent: "Invited by a Care Net Portal member" }));
  }, [inviteCtx]);

  const valid = isInvited
    ? form.name.trim() && form.email.trim() && form.password.length >= 8 && form.agreedToConfidentiality
    : form.name.trim() && form.email.trim() && form.password.length >= 8 && form.role && form.currentlyInCare && form.intent.trim() && form.agreedToConfidentiality;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/apply", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        currentlyInCare: form.currentlyInCare || "yes",
        intent: form.intent.trim() || "Invited by a Care Net Portal member",
        agreedToConfidentiality: form.agreedToConfidentiality,
        inviteToken: inviteToken || undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Submission failed");
      // Keep token in sessionStorage so verify-email handler can auto-accept it
      if (inviteToken) sessionStorage.setItem("pending_invite_token", inviteToken);
      setStage("check-email");
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    try {
      await apiRequest("POST", "/api/auth/resend-verification", { email: form.email.trim() });
      setResendSent(true);
      toast({ title: "Email sent", description: "Check your inbox for a new verification link." });
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setResendLoading(false);
    }
  }

  // ── Loading invite context ──────────────────────────────────────────────────
  if (inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // ── Check-email screen ──────────────────────────────────────────────────────
  if (stage === "check-email") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Check your email</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-1">We sent a verification link to</p>
          <p className="font-medium text-foreground mb-4">{form.email}</p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Click the link to verify your account and get started.{" "}
            {isInvited && "Once verified, you'll be automatically connected to your family's portal."}
            {" "}Check your spam folder if you don't see it.
          </p>
          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={handleResend} disabled={resendLoading || resendSent} data-testid="button-resend">
              {resendLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : resendSent ? "Email resent ✓" : "Resend verification email"}
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate("/login")} data-testid="link-back-login">
              Back to sign in
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-8">The link expires in 24 hours.</p>
        </div>
      </div>
    );
  }

  // ── Application form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          {isInvited ? (
            <>
              <h1 className="text-xl font-semibold text-foreground">You've been invited</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Create your account to join the care team
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-foreground">Apply for Beta Access</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Care Net Portal is in private beta. Tell us a little about yourself.
              </p>
            </>
          )}
        </div>

        {/* Invite context card */}
        {isInvited && inviteCtx && inviteRole && (
          <div className="mb-5 bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">{inviteCtx.senderName} invited you</p>
              {inviteCtx.clientName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Joining as <span className="text-primary font-medium">{inviteRole.display}</span> for{" "}
                  <span className="font-medium">{inviteCtx.clientName}</span>
                </p>
              )}
              {!inviteCtx.clientName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Joining as <span className="text-primary font-medium">{inviteRole.display}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Create your account below — your role and portal access will be set up automatically.
              </p>
            </div>
          </div>
        )}

        {/* Form card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="form-apply">

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="apply-name">Full name</Label>
              <Input id="apply-name" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={loading} data-testid="input-name" />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="apply-email">Email address</Label>
              <Input id="apply-email" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={loading} data-testid="input-email" />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="apply-password">Create a password</Label>
              <div className="relative">
                <Input id="apply-password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} disabled={loading} data-testid="input-password" className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password.length > 0 && form.password.length < 8 && (
                <p className="text-xs text-destructive">Must be at least 8 characters</p>
              )}
            </div>

            {/* Role — locked if invited */}
            {isInvited && inviteRole ? (
              <div className="space-y-1.5">
                <Label>Your role</Label>
                <div className="flex items-center gap-3 rounded-lg border border-primary bg-primary/5 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">{inviteRole.display}</span>
                  <span className="text-xs text-muted-foreground ml-auto">Set by your invite</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>What best describes your role?</Label>
                <RadioGroup value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as any }))} className="space-y-2" data-testid="radio-role">
                  {[
                    { value: "caregiver", label: "I'm a professional caregiver" },
                    { value: "family",    label: "I'm a family member / main contact" },
                    { value: "both",      label: "Both (family caregiver)" },
                    { value: "other",     label: "Other" },
                  ].map(opt => (
                    <div key={opt.value} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <RadioGroupItem value={opt.value} id={`role-${opt.value}`} />
                      <Label htmlFor={`role-${opt.value}`} className="cursor-pointer font-normal">{opt.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Screening questions — hidden for invited users */}
            {!isInvited && (
              <>
                <div className="space-y-2">
                  <Label>Are you currently in an active care situation?</Label>
                  <RadioGroup value={form.currentlyInCare} onValueChange={v => setForm(f => ({ ...f, currentlyInCare: v as any }))} className="flex flex-wrap gap-3" data-testid="radio-care-status">
                    {[
                      { value: "yes",  label: "Yes, currently" },
                      { value: "no",   label: "Not currently" },
                      { value: "soon", label: "Starting soon" },
                    ].map(opt => (
                      <div key={opt.value} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <RadioGroupItem value={opt.value} id={`care-${opt.value}`} />
                        <Label htmlFor={`care-${opt.value}`} className="cursor-pointer font-normal text-sm">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="apply-intent">Why do you want access to Care Net Portal?</Label>
                  <Textarea id="apply-intent" placeholder="Tell us a little about your care situation and what you're hoping to get from the app…" value={form.intent} onChange={e => setForm(f => ({ ...f, intent: e.target.value }))} disabled={loading} className="min-h-[100px] resize-none" data-testid="textarea-intent" />
                </div>
              </>
            )}

            {/* Confidentiality */}
            <div className="flex items-start gap-3 rounded-lg border border-border p-4 bg-muted/30">
              <Checkbox id="agree-confidentiality" checked={form.agreedToConfidentiality} onCheckedChange={v => setForm(f => ({ ...f, agreedToConfidentiality: !!v }))} disabled={loading} data-testid="checkbox-confidentiality" />
              <label htmlFor="agree-confidentiality" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I understand that Care Net Portal is in private beta and I agree to keep my experience confidential. I will not share screenshots, data, or details of the app without permission.
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !valid} data-testid="button-submit-apply">
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</>
                : isInvited
                  ? <><ArrowRight className="w-4 h-4 mr-2" />Create account & join portal</>
                  : "Create account & get started"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="text-primary hover:underline font-medium" data-testid="link-login">
                Sign in
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              By applying you agree to our{" "}
              <a href="#/terms" className="text-primary hover:underline">Terms of Service</a>{", "}
              <a href="#/privacy" className="text-primary hover:underline">Privacy Policy</a>{" and "}
              <a href="#/beta-agreement" className="text-primary hover:underline">Beta User Agreement</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
