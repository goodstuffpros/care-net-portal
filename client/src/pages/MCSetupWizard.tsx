/**
 * MCSetupWizard — shown to MC/family users after personal onboarding.
 * New flow (per David's redesign, May 2026):
 *
 *   1. client-profile  — Create your loved one's profile (REQUIRED, no skip)
 *   2. personal-profile — Your own info (name, phone) — already set in onboarding,
 *                         but shows a confirmation / light review
 *   3. care-team       — Invite caregiver (email) + option to invite family
 *   4. done            — Celebration, encouragement to explore
 *
 * The MC cannot leave this wizard until client-profile is complete.
 * Care-team invites are email-only (no copy-link per platform rules).
 */

import { useState } from "react";
import {
  Heart, ChevronRight, ChevronLeft, User, Calendar, Stethoscope,
  Users, UserPlus, Briefcase, ArrowRight, CheckCircle2, Mail, Loader2, X, Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { THEME_CONFIG } from "@/lib/portalThemes";

interface MCSetupProps {
  name: string;
  email: string;
  onComplete: () => void;
}

type Step = "client-profile" | "care-team" | "done";

const RELATIONSHIPS = [
  "Parent", "Spouse / Partner", "Sibling", "Grandparent",
  "Child", "Relative", "Friend", "Other"
];

// Progress: client-profile(1), care-team(2)
function ProgressBar({ step }: { step: Step }) {
  const steps: Step[] = ["client-profile", "care-team"];
  const current = steps.indexOf(step);
  if (current < 0) return null;
  return (
    <div className="flex items-center gap-1.5 justify-center mb-8">
      {steps.map((s, i) => {
        const done = current > i;
        const active = current === i;
        return (
          <div
            key={s}
            className={cn(
              "rounded-full transition-all duration-300",
              active ? "w-5 h-2 bg-rose-500" :
              done   ? "w-2 h-2 bg-rose-300" :
                       "w-2 h-2 bg-muted"
            )}
          />
        );
      })}
    </div>
  );
}

// Shared layout
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
        <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
        <span className="font-semibold text-foreground text-sm">Care Net Portal</span>
        <span className="ml-auto text-xs text-muted-foreground">Setting up your care circle</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function MCSetupWizard({ name, email, onComplete }: MCSetupProps) {
  const { toast } = useToast();
  const firstName = name.split(" ")[0] || "there";

  const [step, setStep] = useState<Step>("client-profile");
  const [saving, setSaving] = useState(false);
  const [clientCreated, setClientCreated] = useState(false);

  // Client profile fields
  const [clientName, setClientName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [clientDob, setClientDob] = useState("");
  const [clientCondition, setClientCondition] = useState("");
  const [colorTheme, setColorTheme] = useState("teal");

  // CG token follow-through (set when backend auto-connects CG who sent the invite)
  const [cgLinked, setCgLinked] = useState<{ cgName: string; cgId: number } | null>(null);

  // Care team invite state
  const [cgEmail, setCgEmail] = useState("");
  const [cgSending, setCgSending] = useState(false);
  const [cgSent, setCgSent] = useState(false);
  const [familyEmails, setFamilyEmails] = useState<string[]>([""]);
  const [familySending, setFamilySending] = useState(false);
  const [familySentCount, setFamilySentCount] = useState(0);

  // ── Step 1: Create client profile ─────────────────────────────────────────
  async function handleCreateClient() {
    if (!clientName.trim()) return;
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/mc/setup", {
        clientName: clientName.trim(),
        clientDob: clientDob || null,
        clientCondition: clientCondition.trim() || null,
        clientRelationship: relationship || null,
        carePathChoice: "has_caregiver",
        colorTheme: colorTheme,
      });
      const data = await res.json();
      if (data.cgLinked) setCgLinked(data.cgLinked);
      setClientCreated(true);
      setStep("care-team");
    } catch (e: any) {
      toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Care team: send CG invite ──────────────────────────────────────────────
  async function sendCGInvite() {
    if (!cgEmail.trim()) return;
    setCgSending(true);
    try {
      await apiRequest("POST", "/api/invite/create", {
        inviteType: "mc_to_caregiver",
        invitedEmail: cgEmail.trim(),
      });
      setCgSent(true);
      toast({ title: "Invite sent", description: `An invitation was sent to ${cgEmail.trim()}.` });
    } catch (e: any) {
      toast({ title: "Could not send invite", description: e.message, variant: "destructive" });
    } finally {
      setCgSending(false);
    }
  }

  // ── Care team: send family invites ─────────────────────────────────────────
  async function sendFamilyInvites() {
    const validEmails = familyEmails.filter(e => e.trim());
    if (!validEmails.length) return;
    setFamilySending(true);
    let sent = 0;
    for (const fe of validEmails) {
      try {
        await apiRequest("POST", "/api/invite/create", {
          inviteType: "mc_to_family",
          invitedEmail: fe.trim(),
        });
        sent++;
      } catch {
        // silently skip individual failures
      }
    }
    setFamilySentCount(sent);
    setFamilySending(false);
    if (sent > 0) toast({ title: `${sent} invite${sent > 1 ? "s" : ""} sent`, description: "Family members will receive an email invitation." });
  }

  function addFamilyEmail() {
    setFamilyEmails(prev => [...prev, ""]);
  }

  function updateFamilyEmail(i: number, val: string) {
    setFamilyEmails(prev => prev.map((e, idx) => idx === i ? val : e));
  }

  function removeFamilyEmail(i: number) {
    setFamilyEmails(prev => prev.filter((_, idx) => idx !== i));
  }

  function enterPortal() {
    window.location.href = "/";
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Step 1: Client Profile
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "client-profile") {
    return (
      <Layout>
        <ProgressBar step="client-profile" />

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <User className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">First — tell us about your loved one</h2>
              <p className="text-xs text-muted-foreground">The portal is built around them.</p>
            </div>
          </div>
          <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 px-4 py-2.5">
            <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">
              This step is required before you can explore the portal.
            </p>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4 mb-8">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">
              Their full name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="client-name"
              placeholder="Full name"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              autoFocus
              data-testid="input-client-name"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Your relationship to them</Label>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIPS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRelationship(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    relationship === r
                      ? "bg-rose-500 text-white border-rose-500"
                      : "bg-background text-foreground/70 border-border hover:border-rose-300"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Portal color */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-muted-foreground" />
              Portal color
            </Label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(THEME_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColorTheme(key)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    colorTheme === key
                      ? `${cfg.accent} text-white border-transparent`
                      : "bg-background text-foreground/70 border-border hover:border-foreground/30"
                  )}
                >
                  <span className={cn("w-2.5 h-2.5 rounded-full", colorTheme === key ? "bg-white/70" : cfg.accent)} />
                  {cfg.label}
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

        <Button
          onClick={handleCreateClient}
          disabled={!clientName.trim() || saving}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2"
          data-testid="btn-create-client"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Creating profile…</>
          ) : (
            <>Continue <ChevronRight className="w-4 h-4" /></>
          )}
        </Button>
      </Layout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Step 2: Care Team — invite CG + family
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "care-team") {
    const allFamilyValid = familyEmails.filter(e => e.trim()).length > 0;
    return (
      <Layout>
        <ProgressBar step="care-team" />

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Build your care team</h2>
              <p className="text-xs text-muted-foreground">Invite your caregiver and family members.</p>
            </div>
          </div>
        </div>

        {/* Caregiver invite — or CG token follow-through confirmation */}
        {cgLinked ? (
          <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 p-5 mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">
                  {cgLinked.cgName} is already connected
                </p>
                <p className="text-xs text-teal-700 dark:text-teal-400 mt-0.5">
                  Because they invited you, they've been added to your care team automatically.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="w-4 h-4 text-teal-600" />
              <p className="text-sm font-semibold text-foreground">Invite your caregiver</p>
              {cgSent && <CheckCircle2 className="w-4 h-4 text-teal-600 ml-auto" />}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Optional. If you work with a professional caregiver, invite them here. They'll get an email to connect their portal to yours.
            </p>
            {cgSent ? (
              <div className="rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 px-4 py-2.5">
                <p className="text-xs text-teal-700 dark:text-teal-400 font-medium flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  Invite sent to {cgEmail}
                </p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="caregiver@example.com"
                  value={cgEmail}
                  onChange={e => setCgEmail(e.target.value)}
                  className="flex-1"
                  data-testid="input-cg-email"
                />
                <Button
                  onClick={sendCGInvite}
                  disabled={!cgEmail.trim() || cgSending}
                  className="bg-teal-600 hover:bg-teal-700 text-white flex-shrink-0"
                  data-testid="btn-send-cg-invite"
                >
                  {cgSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Family member invites — only show if CG not already auto-connected */}
        {!cgLinked && <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-rose-500" />
            <p className="text-sm font-semibold text-foreground">Invite family members</p>
            {familySentCount > 0 && <CheckCircle2 className="w-4 h-4 text-rose-500 ml-auto" />}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Secondary family members can view care logs, schedules, and messages — keeping everyone in the loop.
          </p>

          {familySentCount > 0 ? (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 px-4 py-2.5">
              <p className="text-xs text-rose-700 dark:text-rose-400 font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                {familySentCount} invite{familySentCount > 1 ? "s" : ""} sent
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-3">
                {familyEmails.map((fe, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="family@example.com"
                      value={fe}
                      onChange={e => updateFamilyEmail(i, e.target.value)}
                      className="flex-1"
                      data-testid={`input-family-email-${i}`}
                    />
                    {familyEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFamilyEmail(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addFamilyEmail}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add another
                </button>
                <Button
                  onClick={sendFamilyInvites}
                  disabled={!allFamilyValid || familySending}
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  data-testid="btn-send-family-invites"
                >
                  {familySending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Sending…</> : "Send invites"}
                </Button>
              </div>
            </>
          )}
        </div>}

        {/* Actions */}
        <Button
          onClick={() => setStep("done")}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2"
          data-testid="btn-care-team-next"
        >
          {cgLinked || cgSent || familySentCount > 0 ? "Enter my portal" : "Skip for now — I'll do this later"}
          <ChevronRight className="w-4 h-4" />
        </Button>

        {(cgLinked || cgSent || familySentCount > 0) && (
          <p className="text-xs text-center text-muted-foreground mt-3">
            You can invite more people from the Care Team page at any time.
          </p>
        )}
      </Layout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Step 3: Done
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "done") {
    return (
      <Layout>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {clientName}'s portal is ready.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto mb-2">
            {cgLinked
              ? `${cgLinked.cgName} has been added to your care team.`
              : cgSent
              ? `Your caregiver will receive an email invitation. Once they accept, your portals will connect automatically.`
              : `You can invite your caregiver and family members at any time from the Care Team page.`}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto mb-8">
            Start exploring — your dashboard, care log, and schedule are ready for you.
          </p>

          <Button
            onClick={enterPortal}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2"
            data-testid="btn-enter-portal"
          >
            <Heart className="w-4 h-4 fill-white/30" />
            Enter Care Net Portal
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </Layout>
    );
  }

  return null;
}
