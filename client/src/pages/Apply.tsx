/**
 * Beta Application form — /apply
 * Intake questions: role, currently in care, intent, confidentiality agreement.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Heart, CheckCircle2 } from "lucide-react";

export default function ApplyPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "" as "" | "caregiver" | "family" | "both" | "other",
    currentlyInCare: "" as "" | "yes" | "no" | "soon",
    intent: "",
    agreedToConfidentiality: false,
  });

  const valid =
    form.name.trim() &&
    form.email.trim() &&
    form.role &&
    form.currentlyInCare &&
    form.intent.trim() &&
    form.agreedToConfidentiality;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/apply", {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        currentlyInCare: form.currentlyInCare,
        intent: form.intent.trim(),
        agreedToConfidentiality: form.agreedToConfidentiality,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Submission failed");
      }
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Application received</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Thank you for applying to the Care Net Portal beta. We review every application personally and will be in touch at <strong>{form.email}</strong> soon.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => navigate("/login")}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Apply for Beta Access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Care Net Portal is in private beta. Tell us a little about yourself.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="form-apply">

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="apply-name">Full name</Label>
              <Input
                id="apply-name"
                placeholder="Your name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                disabled={loading}
                data-testid="input-name"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="apply-email">Email address</Label>
              <Input
                id="apply-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={loading}
                data-testid="input-email"
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label>What best describes your role?</Label>
              <RadioGroup
                value={form.role}
                onValueChange={v => setForm(f => ({ ...f, role: v as any }))}
                className="space-y-2"
                data-testid="radio-role"
              >
                {[
                  { value: "caregiver", label: "I'm a professional caregiver" },
                  { value: "family", label: "I'm a family member / main contact" },
                  { value: "both", label: "Both (family caregiver)" },
                  { value: "other", label: "Other" },
                ].map(opt => (
                  <div key={opt.value} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <RadioGroupItem value={opt.value} id={`role-${opt.value}`} />
                    <Label htmlFor={`role-${opt.value}`} className="cursor-pointer font-normal">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Currently in care */}
            <div className="space-y-2">
              <Label>Are you currently in an active care situation?</Label>
              <RadioGroup
                value={form.currentlyInCare}
                onValueChange={v => setForm(f => ({ ...f, currentlyInCare: v as any }))}
                className="flex flex-wrap gap-3"
                data-testid="radio-care-status"
              >
                {[
                  { value: "yes", label: "Yes, currently" },
                  { value: "no", label: "Not currently" },
                  { value: "soon", label: "Starting soon" },
                ].map(opt => (
                  <div key={opt.value} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <RadioGroupItem value={opt.value} id={`care-${opt.value}`} />
                    <Label htmlFor={`care-${opt.value}`} className="cursor-pointer font-normal text-sm">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Intent */}
            <div className="space-y-1.5">
              <Label htmlFor="apply-intent">
                Why do you want access to Care Net Portal?
              </Label>
              <Textarea
                id="apply-intent"
                placeholder="Tell us a little about your care situation and what you're hoping to get from the app…"
                value={form.intent}
                onChange={e => setForm(f => ({ ...f, intent: e.target.value }))}
                disabled={loading}
                className="min-h-[100px] resize-none"
                data-testid="textarea-intent"
              />
            </div>

            {/* Confidentiality agreement */}
            <div className="flex items-start gap-3 rounded-lg border border-border p-4 bg-muted/30">
              <Checkbox
                id="agree-confidentiality"
                checked={form.agreedToConfidentiality}
                onCheckedChange={v => setForm(f => ({ ...f, agreedToConfidentiality: !!v }))}
                disabled={loading}
                data-testid="checkbox-confidentiality"
              />
              <label htmlFor="agree-confidentiality" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I understand that Care Net Portal is in private beta and I agree to keep my experience confidential. I will not share screenshots, data, or details of the app without permission.
              </label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !valid}
              data-testid="button-submit-apply"
            >
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : "Submit application"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-primary hover:underline font-medium"
                data-testid="link-login"
              >
                Sign in
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              By applying you agree to our{" "}
              <a href="#/terms" className="text-primary hover:underline">Terms of Service</a>
              {", "}
              <a href="#/privacy" className="text-primary hover:underline">Privacy Policy</a>
              {" and "}
              <a href="#/beta-agreement" className="text-primary hover:underline">Beta User Agreement</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
