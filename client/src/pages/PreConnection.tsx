/**
 * PreConnectionScreen — shown to real auth users who have completed onboarding
 * but are not yet connected to a care circle (clientId is null).
 *
 * CG role  → CNU is home base + invite family button
 * MC role  → invite caregiver button + "tell us about your loved one" prompt
 */

import { useState } from "react";
import { Heart, GraduationCap, UserPlus, Copy, Check, ChevronRight, BookOpen, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PreConnectionProps {
  name: string;
  role: string;
  email: string;
  onGoToUniversity?: () => void;
}

function isCG(role: string) {
  return role === "caregiver" || role === "temp_caregiver" || role === "multi_caregiver";
}

function isMC(role: string) {
  return role === "primary_family" || role === "secondary_family";
}

export default function PreConnectionScreen({ name, role, email, onGoToUniversity }: PreConnectionProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const firstName = name.split(" ")[0];

  // Placeholder invite link — will be replaced by real referral system
  const inviteLink = `https://care-net-portal-production.up.railway.app/#/apply?ref=${encodeURIComponent(email)}`;

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast({ title: "Link copied", description: "Share it with your connection to get started." });
      setTimeout(() => setCopied(false), 3000);
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
        <Heart className="w-5 h-5 fill-primary text-primary" />
        <span className="font-semibold text-foreground text-sm">Care Net Portal</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-lg mx-auto w-full">

        {/* Greeting */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-xl font-bold text-primary">
              {name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
            </span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-1">You're in, {firstName}.</h1>
          <p className="text-sm text-muted-foreground">
            {isCG(role)
              ? "Your portal is ready. Start learning while you wait for your first connection."
              : "Your portal is ready. Invite your caregiver to connect and get started."}
          </p>
        </div>

        {/* CG experience */}
        {isCG(role) && (
          <div className="w-full space-y-3">
            {/* CNU primary card */}
            <button
              onClick={onGoToUniversity}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-primary/8 border border-primary/20 hover:bg-primary/12 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Care Net University</p>
                <p className="text-xs text-muted-foreground">Learn the portal with Becky's voice guides — your home base until your first connection.</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
            </button>

            {/* Invite family card */}
            <div className="w-full p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Invite a Family Contact</p>
                  <p className="text-xs text-muted-foreground">Share your invite link so they can join your care circle.</p>
                </div>
              </div>
              <Button
                onClick={copyInviteLink}
                variant="outline"
                size="sm"
                className="w-full gap-2"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Invite Link"}
              </Button>
            </div>

            {/* Demo note */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50 border border-border">
              <Sparkles className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Want to explore the full app first?{" "}
                <button
                  onClick={onGoToUniversity}
                  className="text-primary underline underline-offset-2 hover:no-underline"
                >
                  Open Care Net University
                </button>{" "}
                — it includes a live demo you can walk through.
              </p>
            </div>
          </div>
        )}

        {/* MC experience */}
        {isMC(role) && (
          <div className="w-full space-y-3">
            {/* Invite caregiver card */}
            <div className="w-full p-4 rounded-xl bg-primary/8 border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Invite Your Caregiver</p>
                  <p className="text-xs text-muted-foreground">Share this link and your portals will connect once they sign up.</p>
                </div>
              </div>
              <Button
                onClick={copyInviteLink}
                size="sm"
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Invite Link"}
              </Button>
            </div>

            {/* Explore demo card */}
            <div className="w-full p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Explore the Portal</p>
                  <p className="text-xs text-muted-foreground">See exactly what you and your caregiver will use every day.</p>
                </div>
              </div>
              <Button
                onClick={onGoToUniversity}
                variant="outline"
                size="sm"
                className="w-full gap-2"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Open Care Net University
              </Button>
            </div>

            {/* Team note */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50 border border-border">
              <Users className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                You can also invite other family members once your caregiver is connected. Everyone stays on the same page.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
