/**
 * Pricing Page — Caregiver-as-customer model
 * Caregivers get the app free forever. They pay $19.99/month per active client portal.
 * Families never pay a subscription — cost is built into the caregiver's hourly rate.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Check, Heart, Users, Building2, Sparkles, Shield,
  MessageSquare, ClipboardList, Calendar, Activity,
  Image, Archive, Award, ChevronDown, ChevronUp,
  BadgeDollarSign, Zap, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Feature list helpers ──────────────────────────────────────────────────────

const PORTAL_FEATURES = [
  { icon: MessageSquare, text: "Secure family messaging with priority labels" },
  { icon: ClipboardList, text: "Care log — daily entries, late-entry flagging" },
  { icon: Calendar, text: "Schedule management with shift tracking" },
  { icon: Activity, text: "Medication & vitals tracking" },
  { icon: Image, text: "Media sharing — photos, videos, updates" },
  { icon: Archive, text: "Monthly AI care summaries" },
  { icon: Award, text: "Badge system — transparent performance scoring" },
  { icon: Shield, text: "Flag system — yellow/red accountability alerts" },
  { icon: Sparkles, text: "Care Scope — module-level accountability controls" },
  { icon: Heart, text: "\"A Collection of Thoughts\" — caregiver journal" },
];

const CAREGIVER_FREE_FEATURES = [
  "Full caregiver account — free forever",
  "Public profile in the Care Net directory",
  "Scope Badge — showcase your range of care",
  "Caregiver onboarding & certification display",
  "App access across all devices",
  "Voice-assisted log entries and messaging",
];

const FAQ = [
  {
    q: "Why does the caregiver pay instead of the family?",
    a: "Because Care Net is a professional tool — just like a nurse carries their own stethoscope. A caregiver who brings the app to a client interview has a concrete competitive advantage. The $19.99/month cost is easily built into a slightly higher hourly rate, and families get a premium care experience without a subscription of their own.",
  },
  {
    q: "How does a caregiver explain the cost to a family?",
    a: "The typical private caregiver charges around $25/hour and communicates through group texts and a notebook on the kitchen table. A Care Net caregiver can walk into an interview, show the app, and justify $27.50/hour — giving the family organized logs, real-time messaging, monthly summaries, and a transparent performance record. The math works out strongly in the caregiver's favor.",
  },
  {
    q: "What if a caregiver has more than one client?",
    a: "Each client gets their own portal at $19.99/month. A caregiver with two clients pays $39.98/month and manages both from a single account. Each client's portal is completely private and separate.",
  },
  {
    q: "Does the family pay anything?",
    a: "No. Families access their loved one's portal through the caregiver's account at no cost. There is no family subscription. The only exception is the Family Care portal — a standalone option for families managing care without a dedicated caregiver.",
  },
  {
    q: "What is the Family Care portal?",
    a: "For families managing a loved one's care themselves — without a hired caregiver — we offer a standalone Family Care portal. This gives families the same organization tools (care log, messaging, medication tracking, schedule) without the badge and scoring system. When a dedicated caregiver joins later, everything migrates seamlessly via Care Connect.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no contracts or cancellation fees. Cancel a client portal at any time and billing stops at the end of that billing period.",
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
      {open && (
        <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Pricing() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-12">

      {/* Header */}
      <div className="text-center space-y-3">
        <h1
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          Simple, honest pricing
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Care Net is a professional tool built for caregivers. The app is free —
          you pay only for each active client portal you manage.
        </p>
      </div>

      {/* Main pricing cards */}
      <div className="grid gap-5 md:grid-cols-2">

        {/* Caregiver Account — Free */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Heart size={16} className="text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">Caregiver Account</span>
            </div>
            <div className="flex items-end gap-1 pt-2">
              <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Free</span>
              <span className="text-sm text-muted-foreground mb-1">forever</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your professional identity on Care Net. No credit card required.
            </p>
          </div>

          <ul className="space-y-2.5">
            {CAREGIVER_FREE_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-xs text-foreground">
                <Check size={13} className="text-primary shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <Button variant="outline" size="sm" className="w-full text-xs">
            Create Free Account
          </Button>
        </div>

        {/* Client Portal — $19.99/mo */}
        <div className="rounded-2xl border-2 border-primary bg-card p-6 space-y-5 relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-2.5 py-1 rounded-full">
              Per Client
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users size={16} className="text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">Client Portal</span>
            </div>
            <div className="flex items-end gap-1 pt-2">
              <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>$19.99</span>
              <span className="text-sm text-muted-foreground mb-1">/ month per client</span>
            </div>
            <p className="text-xs text-muted-foreground">
              One portal per client. Cancel anytime. Family access included at no extra cost.
            </p>
          </div>

          <ul className="space-y-2.5">
            {PORTAL_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-xs text-foreground">
                <Check size={13} className="text-primary shrink-0 mt-0.5" />
                {text}
              </li>
            ))}
          </ul>

          <Button size="sm" className="w-full text-xs">
            Add Client Portal
          </Button>
        </div>
      </div>

      {/* The math — caregiver value story */}
      <div className="rounded-2xl border border-border bg-muted/30 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BadgeDollarSign size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            How the math works for you
          </h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The average private caregiver charges around <strong className="text-foreground">$25/hour</strong> and
          communicates through group texts and a notebook on the kitchen table.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Typical rate", value: "$25.00/hr", sub: "Notebook + group texts", muted: true },
            { label: "Care Net rate", value: "$27.50/hr", sub: "App, logs, summaries, messaging", muted: false },
            { label: "Portal cost", value: "$19.99/mo", sub: "~$0.65/day per client", muted: true },
            { label: "Monthly gain", value: "+$350/mo", sub: "At 40 hrs/week, $2.50/hr increase", muted: false },
          ].map(({ label, value, sub, muted }) => (
            <div key={label} className={cn(
              "rounded-xl p-3 space-y-0.5",
              muted ? "bg-muted/50 border border-border" : "bg-primary/10 border border-primary/20"
            )}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={cn("text-base font-bold", muted ? "text-foreground" : "text-primary")}
                style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Walk into a client interview, show the app, and let the family see exactly what they're getting.
          The portal sells itself — and the $19.99/month pays for itself many times over.
        </p>
      </div>

      {/* Family Care portal callout */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 flex items-center justify-center shrink-0">
            <Star size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Managing care without a dedicated caregiver?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The <strong className="text-foreground">Family Care portal</strong> is built for families who are
              coordinating care themselves — handling medications, appointments, and updates through a sea of
              group texts. Get organized, keep a real record, and share updates with family members in one place.
              When you're ready to bring in a dedicated caregiver, everything migrates over automatically via Care Connect.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button variant="outline" size="sm" className="text-xs">Learn about Family Care</Button>
          <span className="text-xs text-muted-foreground">Separate pricing — coming soon</span>
        </div>
      </div>

      {/* Agency / multi-client callout */}
      <div className="rounded-2xl border border-border bg-card p-6 flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 size={16} className="text-primary" />
        </div>
        <div className="space-y-1.5 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Agencies & multi-caregiver teams</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Running a care agency or managing multiple caregivers across clients? We offer custom team pricing,
            shared client access, and admin-level reporting. Reach out to discuss.
          </p>
          <Button variant="outline" size="sm" className="text-xs mt-2">Contact Us</Button>
        </div>
      </div>

      {/* FAQ */}
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
