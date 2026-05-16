/**
 * Beta Application form — /apply
 * If ?invite=TOKEN is present:
 *   - Fetches invite context (senderName, clientName, inviteType)
 *   - Pre-fills and locks the role field
 *   - Strips the lengthy beta-screening questions (intent, currentlyInCare)
 *   - After account created + email verified, auto-accepts the invite
 * Normal path: full beta application form — 2 roles only (CG or MC).
 *              Secondary FM arrives via invite only — no cold signup path.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Heart, Mail, Eye, EyeOff, Users, ArrowRight, Briefcase, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InviteContext {
  valid: boolean;
  senderName: string;
  clientName: string | null;
  inviteType: string;
}

function inviteRoleLabel(inviteType: string): { role: "caregiver" | "family" | "self_managed"; display: string } {
  if (inviteType === "mc_to_caregiver") return { role: "caregiver", display: "Caregiver" };
  if (inviteType === "caregiver_to_mc") return { role: "family", display: "Main Contact (Family)" };
  if (inviteType === "mc_to_family")    return { role: "family", display: "Family Member" };
  if (inviteType === "mc_to_self_cg")  return { role: "self_managed", display: "Self-Caregiver" };
  if (inviteType === "self_care_to_mc") return { role: "family", display: "Main Contact" };
  return { role: "family", display: "Family Member" };
}

type SignupRole = "caregiver" | "family" | "self_managed";

const SIGNUP_ROLES: {
  value: SignupRole;
  label: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  checkedColor: string;
}[] = [
  {
    value: "caregiver",
    label: "Professional Caregiver",
    subtitle: "Not a family member",
    description: "I provide paid, professional care. I'll be connecting with a client's family through the portal.",
    icon: <Briefcase className="w-6 h-6" />,
    color: "border-border bg-card hover:border-teal-400/50",
    checkedColor: "border-teal-600 bg-teal-50 dark:bg-teal-950/30 ring-1 ring-teal-600/30",
  },
  {
    value: "family",
    label: "Main Contact",
    subtitle: "Family member — primary decision maker",
    description: "I'm the primary person managing care for a loved one. I may be coordinating with a professional caregiver, or I may be handling everything myself — either way, this portal is built for me.",
    icon: <Heart className="w-6 h-6" />,
    color: "border-border bg-card hover:border-rose-400/50",
    checkedColor: "border-rose-500 bg-rose-50 dark:bg-rose-950/30 ring-1 ring-rose-500/30",
  },
  {
    value: "self_managed",
    label: "Self-Managed Care",
    subtitle: "I manage my own care",
    description: "I am the care recipient and I manage my own record. I'll create my own care profile and optionally invite a family member to stay informed in the background.",
    icon: <UserCog className="w-6 h-6" />,
    color: "border-border bg-card hover:border-emerald-400/50",
    checkedColor: "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-600/30",
  },
];

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

  const [stage, setStage] = useState<"role" | "form" | "check-email">("role");
  const [selectedRole, setSelectedRole] = useState<SignupRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "" as "" | "caregiver" | "family" | "self_managed",
    currentlyInCare: "yes" as "yes" | "no" | "soon",
    intent: "",
    agreedToConfidentiality: false,
  });

  // Pre-fill role once invite context loads — skip role selection screen
  useEffect(() => {
    if (inviteRole) {
      setSelectedRole(inviteRole.role);
      setForm(f => ({ ...f, role: inviteRole.role, currentlyInCare: "yes", intent: "Invited by a Care Net Portal member" }));
      setStage("form");
    }
  }, [inviteCtx]);

  // When role is selected on role screen, advance to form
  function handleRoleSelect(role: SignupRole) {
    setSelectedRole(role);
    setForm(f => ({ ...f, role }));
    setStage("form");
  }

  const isSelfManaged = selectedRole === "self_managed";
  const valid = isInvited
    ? form.name.trim() && form.email.trim() && form.password.length >= 8 && form.agreedToConfidentiality
    : isSelfManaged
      ? form.name.trim() && form.email.trim() && form.password.length >= 8 && form.agreedToConfidentiality
      : form.name.trim() && form.email.trim() && form.password.length >= 8 && form.role && form.intent.trim() && form.agreedToConfidentiality;

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
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

  // ── Role selection screen ────────────────────────────────────────────────────
  if (stage === "role") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Welcome to Care Net Portal</h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
              Before we get started — which best describes you?
            </p>
          </div>

          {/* Role cards */}
          <div className="space-y-4 mb-8">
            {SIGNUP_ROLES.map((r) => {
              const isSelected = selectedRole === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => handleRoleSelect(r.value)}
                  data-testid={`role-card-${r.value}`}
                  className={cn(
                    "w-full text-left rounded-2xl border-2 p-5 transition-all duration-200",
                    isSelected ? r.checkedColor : r.color
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      r.value === "caregiver"
                        ? isSelected ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"
                        : r.value === "self_managed"
                          ? isSelected ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                          : isSelected ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground text-base">{r.label}</p>
                          <p className={cn(
                            "text-xs font-medium mt-0.5",
                            r.value === "caregiver"
                              ? isSelected ? "text-teal-600" : "text-muted-foreground"
                              : r.value === "self_managed"
                                ? isSelected ? "text-emerald-600" : "text-muted-foreground"
                                : isSelected ? "text-rose-500" : "text-muted-foreground"
                          )}>{r.subtitle}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className={cn(
                            "w-5 h-5 flex-shrink-0 mt-0.5",
                            r.value === "caregiver" ? "text-teal-600" : r.value === "self_managed" ? "text-emerald-600" : "text-rose-500"
                          )} />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{r.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Family member note */}
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 mb-8">
            <Users className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Secondary family members</span> are invited by the Main Contact from inside the portal — no sign-up needed until then.
            </p>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button onClick={() => navigate("/login")} className="text-primary hover:underline font-medium">
              Sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Application form ────────────────────────────────────────────────────────
  const roleInfo = SIGNUP_ROLES.find(r => r.value === selectedRole);
  const isMC = selectedRole === "family";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className={cn(
            "inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4",
            isSelfManaged ? "bg-emerald-600/10" : isMC ? "bg-rose-500/10" : "bg-teal-600/10"
          )}>
            {isSelfManaged
              ? <UserCog className="w-6 h-6 text-emerald-600" />
              : isMC
                ? <Heart className="w-6 h-6 text-rose-500" />
                : <Briefcase className="w-6 h-6 text-teal-600" />
            }
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
              <h1 className="text-xl font-semibold text-foreground">
                {isSelfManaged
                  ? "Create your Self-Managed Care account"
                  : isMC
                    ? "Create your Main Contact account"
                    : "Create your Caregiver account"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isSelfManaged
                  ? "You'll set up your own care profile right after this."
                  : isMC
                    ? "You'll set up your loved one's profile right after this. A professional caregiver is optional."
                    : "You'll connect with your client's family once they invite you."}
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

        {/* Role badge — non-invited users see what they chose */}
        {!isInvited && roleInfo && (
          <div className={cn(
            "mb-5 rounded-xl border px-4 py-3 flex items-center gap-3",
            isSelfManaged
              ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900"
              : isMC
                ? "border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900"
                : "border-teal-200 bg-teal-50 dark:bg-teal-950/20 dark:border-teal-900"
          )}>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              isSelfManaged ? "bg-emerald-600 text-white" : isMC ? "bg-rose-500 text-white" : "bg-teal-600 text-white"
            )}>
              {roleInfo.icon}
            </div>
            <div className="flex-1">
              <p className={cn(
                "text-sm font-semibold",
                isSelfManaged ? "text-emerald-700 dark:text-emerald-400" : isMC ? "text-rose-700 dark:text-rose-400" : "text-teal-700 dark:text-teal-400"
              )}>{roleInfo.label}</p>
              <p className="text-xs text-muted-foreground">{roleInfo.subtitle}</p>
            </div>
            <button
              onClick={() => setStage("role")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Change
            </button>
          </div>
        )}

        {/* Form card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="space-y-6" data-testid="form-apply">

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

            {/* Why do you want access — only for non-invited, non-self-managed signup */}
            {!isInvited && !isSelfManaged && (
              <div className="space-y-1.5">
                <Label htmlFor="apply-intent">
                  {isMC
                    ? "Tell us a little about your care situation"
                    : "Tell us about your caregiving background"}
                </Label>
                <Textarea
                  id="apply-intent"
                  placeholder={isMC
                    ? "Who are you caring for, and what brings you to Care Net Portal?"
                    : "How long have you been a caregiver, and what types of care do you provide?"}
                  value={form.intent}
                  onChange={e => setForm(f => ({ ...f, intent: e.target.value }))}
                  disabled={loading}
                  className="min-h-[90px] resize-none"
                  data-testid="textarea-intent"
                />
              </div>
            )}

            {/* Confidentiality */}
            <div className="flex items-start gap-3 rounded-lg border border-border p-4 bg-muted/30">
              <Checkbox id="agree-confidentiality" checked={form.agreedToConfidentiality} onCheckedChange={v => setForm(f => ({ ...f, agreedToConfidentiality: !!v }))} disabled={loading} data-testid="checkbox-confidentiality" />
              <label htmlFor="agree-confidentiality" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I understand that Care Net Portal is in private beta and I agree to keep my experience confidential. I will not share screenshots, data, or details of the app without permission.
              </label>
            </div>

            <Button type="button" className={cn(
              "w-full",
              isSelfManaged ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : isMC ? "bg-rose-600 hover:bg-rose-700 text-white"
              : "bg-teal-600 hover:bg-teal-700 text-white"
            )} disabled={loading || !valid} onClick={() => handleSubmit()} data-testid="button-submit-apply">
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</>
                : isInvited
                  ? <><ArrowRight className="w-4 h-4 mr-2" />Create account & join portal</>
                  : <><ArrowRight className="w-4 h-4 mr-2" />Create account & get started</>}
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
