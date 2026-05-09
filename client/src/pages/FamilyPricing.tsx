/**
 * FamilyPricing — pricing page for Main Contact and Family Members.
 *
 * Completely separate from the CG pricing page.
 * Focused on the Family Care Portal — what families get, how it helps them.
 * No caregiver hourly-rate math. Warm, accessible tone.
 */

import { useState } from "react";
import { useApp } from "@/App";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Check, Heart, MessageSquare, ClipboardList, Calendar,
  Activity, Image, ChevronDown, ChevronUp, Users, Shield,
  Sparkles, Lock, Star, Zap, ArrowRight, BookOpen
} from "lucide-react";

// ── Feature list ─────────────────────────────────────────────────────────────
const FCP_FEATURES = [
  { icon: MessageSquare, text: "Secure messaging — the whole family in one thread" },
  { icon: ClipboardList, text: "Care Log — a real record of every day's care" },
  { icon: Calendar, text: "Schedule visibility — see every shift and appointment" },
  { icon: Activity, text: "Medication & vitals tracking" },
  { icon: Image, text: "Shared photos & videos from daily care" },
  { icon: Sparkles, text: "Monthly CareNet care summaries — the full picture at a glance" },
  { icon: Users, text: "Invite your whole family — siblings, out-of-town relatives" },
  { icon: Shield, text: "Private and secure — only your circle sees your portal" },
];

const FREE_DURING_BETA = [
  "Full portal access during beta",
  "Unlimited family members",
  "All messaging features",
  "Care log and schedule",
  "Medication & vitals view",
];

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: "What is the Family Care portal?",
    a: "The Family Care portal is for families who are coordinating care themselves — without a dedicated hired caregiver. It gives you care logs, a shared family inbox, schedule tracking, medications, and monthly CareNet summaries. Everything you need to stay organized and keep everyone on the same page.",
  },
  {
    q: "I already have a caregiver. Do I need this?",
    a: "If your caregiver is already using Care Net Portal, you're covered — your Family Care access is included in their subscription at no extra cost. This portal is designed for families managing care on their own, or for a transition period before a dedicated caregiver joins.",
  },
  {
    q: "What does it cost after beta?",
    a: "We're finalizing family pricing now. It will be a low monthly subscription — designed to be affordable for any family, regardless of their care situation. We'll notify you well in advance before any charge begins.",
  },
  {
    q: "Can I invite other family members?",
    a: "Yes — invite as many family members as you'd like. Siblings, out-of-town relatives, close friends acting as family. Everyone can see the same updates, care logs, and messages in one place. No more group texts.",
  },
  {
    q: "What happens if we bring in a dedicated caregiver later?",
    a: "Everything migrates automatically. Your care logs, schedule history, and family connections carry over to the caregiver's portal. Nothing is lost, and no one has to start over.",
  },
  {
    q: "Is my family's information private?",
    a: "Completely. Your portal is only visible to people you personally invite. Care Net staff cannot view your private messages or care logs. Your family's data is encrypted and never shared.",
  },
];

// ── FAQ Item ──────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full flex items-start justify-between gap-4 py-4 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-sm font-medium text-foreground">{q}</span>
        {open
          ? <ChevronUp size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronDown size={16} className="text-muted-foreground shrink-0 mt-0.5" />
        }
      </button>
      {open && <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{a}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FamilyPricing() {
  const { activeUser } = useApp();
  const isMC = activeUser.role === "primary_family";

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-10 pb-24">

      {/* ── Header ── */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary mb-1">
          <Heart size={11} className="fill-primary" />
          Family Care Portal
        </div>
        <h1
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          Keep your whole family in the loop
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          One place for care logs, schedules, messages, and updates — instead of a scattered group text thread.
        </p>
      </div>

      {/* ── Beta banner ── */}
      <div className="rounded-2xl border-2 border-primary bg-primary/5 p-6 space-y-5 relative overflow-hidden">
        <div className="absolute top-4 right-4">
          <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-2.5 py-1 rounded-full">
            Beta — Free
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Heart size={16} className="text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Family Care Portal</span>
          </div>
          <div className="flex items-end gap-1 pt-2">
            <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Free</span>
            <span className="text-sm text-muted-foreground mb-1">during beta</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Full access while we're building. Low, transparent pricing announced before beta ends — no surprise charges.
          </p>
        </div>

        <ul className="space-y-2.5">
          {FREE_DURING_BETA.map(f => (
            <li key={f} className="flex items-start gap-2.5 text-xs text-foreground">
              <Check size={13} className="text-primary shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        <Button size="sm" className="w-full text-xs">
          You're already set up — enjoy the portal
        </Button>
      </div>

      {/* ── What's included ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Everything in the Family Care portal
          </h2>
        </div>
        <ul className="px-5 py-4 space-y-3">
          {FCP_FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={13} className="text-primary" />
              </div>
              <span className="text-sm text-foreground leading-snug">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Why families love it ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          <Star size={14} className="text-primary" />
          Built for real family situations
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "No more scattered updates",
              body: "One place for care logs, messages, and schedules. Everyone in your family sees the same thing.",
            },
            {
              title: "Out-of-town family stays close",
              body: "Invite siblings or relatives who live far away. They get the same updates as people who are local.",
            },
            {
              title: "A real record, not a memory",
              body: "Care logs track every shift. When the doctor asks 'has anything changed lately?' — you'll have the answer.",
            },
            {
              title: "Private and yours",
              body: "Only the people you invite can see your portal. Nothing is shared publicly or with other families.",
            },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-muted/20 p-4 space-y-1.5">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Caregiver path ── */}
      <div className="rounded-2xl border border-border bg-card p-5 flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Users size={16} className="text-primary" />
        </div>
        <div className="space-y-1.5 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Ready to bring in a dedicated caregiver?</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When the right time comes, invite a caregiver to connect through your portal. They'll bring their professional profile and your care history carries over — no starting over, no data loss.
          </p>
          <button className="flex items-center gap-1.5 text-xs text-primary font-medium mt-1 hover:underline" data-testid="connect-caregiver-prompt">
            Learn about Care Connect <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* ── Privacy note ── */}
      <div className="rounded-2xl border border-border bg-muted/20 p-5 flex items-start gap-3">
        <Lock size={15} className="text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-foreground">Your family's privacy is protected</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All care data is encrypted. Only people you invite can see your portal.
            Care Net never sells or shares your information. You can export or delete your data at any time.
          </p>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          <Zap size={14} className="text-primary" />
          Common questions
        </h2>
        <div className="rounded-2xl border border-border bg-card px-5 divide-y divide-border">
          {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
        </div>
      </div>

    </div>
  );
}
