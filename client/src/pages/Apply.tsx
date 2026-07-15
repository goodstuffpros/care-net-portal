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
import { Loader2, Heart, Mail, Eye, EyeOff, Users, ArrowRight, Briefcase, CheckCircle2, UserCog, AlertTriangle, ChevronLeft } from "lucide-react";
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
    description: "I coordinate care for a family member — with a professional caregiver or on my own. This is my portal.",
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

  // ── Decision tree state ───────────────────────────────────────────────────
  type TreeScreen = "welcome" | "q1" | "q2_family" | "q2_self" | "done";
  const [treeScreen, setTreeScreen] = useState<TreeScreen>("welcome");
  const [treeHistory, setTreeHistory] = useState<TreeScreen[]>([]);

  function goTo(next: TreeScreen) {
    setTreeHistory(h => [...h, treeScreen]);
    setTreeScreen(next);
  }
  function goBack() {
    const prev = treeHistory[treeHistory.length - 1];
    if (prev) {
      setTreeHistory(h => h.slice(0, -1));
      setTreeScreen(prev);
    }
  }
  function pickRole(role: SignupRole) {
    setSelectedRole(role);
    setForm(f => ({ ...f, role }));
    setStage("form");
  }

  // Total screens per path (for progress bar)
  const TREE_TOTAL: Record<TreeScreen, number> = {
    welcome: 0, q1: 1, q2_family: 2, q2_self: 2, done: 3,
  };
  const treeStep = TREE_TOTAL[treeScreen] ?? 0;
  const treeTotal = 3;
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
  // Self-managed is allowed without an invite token — SC can sign up cold
  function handleRoleSelect(role: SignupRole) {
    setSelectedRole(role);
    setForm(f => ({ ...f, role }));
    setStage("form");
  }

  const isSelfManaged = selectedRole === "self_managed";
  const baseValid = !!(form.name.trim() && form.email.trim() && form.password.length >= 8 && form.agreedToConfidentiality);
  const valid = isInvited || isSelfManaged || form.role === "self_managed"
    ? baseValid
    : baseValid && !!(form.role && form.intent.trim());

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

  // ── Decision tree role selection ────────────────────────────────────────────
  if (stage === "role") {

    // Shared shell for every tree screen
    const TreeShell = ({ children, showBack = false }: { children: React.ReactNode; showBack?: boolean }) => (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md">
          {/* Already have account */}
          <button onClick={() => navigate("/login")}
            className="w-full mb-5 py-3 rounded-xl border-2 border-teal-500 text-teal-600 dark:text-teal-400 font-semibold text-sm hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors"
            data-testid="link-login-prominent">
            Already have an account? Sign in
          </button>

          {/* Progress bar (hidden on welcome) */}
          {treeScreen !== "welcome" && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                {showBack && (
                  <button onClick={goBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft size={14} /> Back
                  </button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">Step {treeStep} of {treeTotal}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full transition-all duration-300" style={{ width: `${(treeStep / treeTotal) * 100}%` }} />
              </div>
            </div>
          )}

          {children}
        </div>
      </div>
    );

    // ── WELCOME screen ──────────────────────────────────────────────────────
    if (treeScreen === "welcome") return (
      <TreeShell>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 mb-5">
            <Heart className="w-7 h-7 text-teal-600" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-3">You're already doing the hard work.</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Caring for someone you love — or doing it professionally — takes more out of you than most people know. Care Net Portal was built to carry some of that weight with you.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/20 px-5 py-4 mb-6 text-center">
          <p className="text-sm text-foreground leading-relaxed">
            Before we get you set up, we have a few quick questions. Your answers help us build the right experience for your situation.
          </p>
          <p className="text-xs text-muted-foreground mt-2">About 2 minutes — and it's the most tedious part of the whole app. Everything after this gets easier.</p>
        </div>
        <button onClick={() => goTo("q1")}
          className="w-full py-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          data-testid="btn-get-started">
          Let's get started <ArrowRight size={16} />
        </button>
        <p className="text-center text-xs text-muted-foreground mt-4">You can always change your settings later.</p>
      </TreeShell>
    );

    // ── Q1: Professional caregiver? ─────────────────────────────────────────
    if (treeScreen === "q1") return (
      <TreeShell showBack>
        <div className="mb-7">
          <h2 className="text-lg font-bold text-foreground mb-1.5">Which best describes you?</h2>
          <p className="text-sm text-muted-foreground">This helps us set up the right experience before you create your account.</p>
        </div>
        <div className="space-y-3">
          <button onClick={() => pickRole("family")}
            className="w-full text-left rounded-2xl border-2 border-border hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 p-5 transition-all duration-200 group"
            data-testid="q1-family">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-muted group-hover:bg-teal-100 dark:group-hover:bg-teal-900/40 flex items-center justify-center shrink-0 transition-colors">
                <Heart className="w-5 h-5 text-muted-foreground group-hover:text-teal-600 transition-colors" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">I coordinate care for a loved one</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Family member or primary contact</p>
              </div>
            </div>
          </button>

          <button onClick={() => goTo("q2_self")}
            className="w-full text-left rounded-2xl border-2 border-border hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 p-5 transition-all duration-200 group"
            data-testid="q1-self">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-muted group-hover:bg-teal-100 dark:group-hover:bg-teal-900/40 flex items-center justify-center shrink-0 transition-colors">
                <UserCog className="w-5 h-5 text-muted-foreground group-hover:text-teal-600 transition-colors" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">I manage my own health and care</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Self-directed care</p>
              </div>
            </div>
          </button>

          <button onClick={() => pickRole("caregiver")}
            className="w-full text-left rounded-2xl border-2 border-border hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 p-5 transition-all duration-200 group"
            data-testid="q1-cg">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-muted group-hover:bg-teal-100 dark:group-hover:bg-teal-900/40 flex items-center justify-center shrink-0 transition-colors">
                <Briefcase className="w-5 h-5 text-muted-foreground group-hover:text-teal-600 transition-colors" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">I'm a professional caregiver</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Hired by a family</p>
              </div>
            </div>
          </button>
        </div>
      </TreeShell>
    );

    // ── Q2 Self: invite required or self-signup ─────────────────────────────
    if (treeScreen === "q2_self") return (
      <TreeShell showBack>
        <div className="mb-7">
          <h2 className="text-lg font-bold text-foreground mb-1.5">How are you arriving?</h2>
          <p className="text-sm text-muted-foreground">Were you invited by someone, or are you setting this up on your own?</p>
        </div>
        <div className="space-y-3">
          <button onClick={() => pickRole("self_managed")}
            className="w-full text-left rounded-2xl border-2 border-border hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 p-5 transition-all duration-200 group"
            data-testid="q2-self-own">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-muted group-hover:bg-teal-100 dark:group-hover:bg-teal-900/40 flex items-center justify-center shrink-0 transition-colors">
                <UserCog className="w-5 h-5 text-muted-foreground group-hover:text-teal-600 transition-colors" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">I'm setting up my own portal</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">I'll create my care profile and optionally invite a trusted person to monitor it.</p>
              </div>
            </div>
          </button>

          <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">I was invited by my Main Contact</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">If someone has already set up a portal for you, use the invitation link they sent — it will bring you here with everything already connected.</p>
              </div>
            </div>
          </div>
        </div>
      </TreeShell>
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
              onClick={() => { setStage("role"); setTreeScreen("q1"); }}
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

            {/* Terms agreement */}
            <div className="flex items-start gap-3 rounded-lg border border-border p-4 bg-muted/30">
              <Checkbox id="agree-confidentiality" checked={form.agreedToConfidentiality} onCheckedChange={v => setForm(f => ({ ...f, agreedToConfidentiality: !!v }))} disabled={loading} data-testid="checkbox-confidentiality" />
              <label htmlFor="agree-confidentiality" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I have read and agree to the{" "}
                <a href="#/terms" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>Terms of Service</a>,{" "}
                <a href="#/privacy" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>Privacy Policy</a>, and{" "}
                <a href="#/beta-agreement" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>Beta User Agreement</a>.
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

          </div>
        </div>
      </div>
    </div>
  );
}
