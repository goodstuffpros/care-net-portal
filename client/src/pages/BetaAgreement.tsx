/**
 * Beta User Agreement — /beta-agreement
 * Accessible from apply form, complete-signup, and footer links.
 */

import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart } from "lucide-react";

export default function BetaAgreement() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2 text-primary font-semibold text-lg">
            <Heart className="w-5 h-5 fill-primary" />
            Care Net Portal
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button
          variant="ghost"
          size="sm"
          className="mb-8 -ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        <h1 className="text-2xl font-bold text-foreground mb-2">Beta User Agreement</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: May 2026 · Beta Program</p>

        <div className="space-y-8 text-foreground">

          <section className="bg-primary/5 border border-primary/20 rounded-lg p-5">
            <p className="text-sm text-foreground leading-relaxed">
              Thank you for being part of the Care Net Portal beta program. This agreement explains what it means to be a beta user, what we ask of you, and how we will work together during this early phase of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. What Beta Access Means</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              As a beta user, you are receiving early access to Care Net Portal before its public release. The platform is functional and being used in real care situations, but it is still being refined. You may encounter features that are incomplete, behaviors that change between updates, or occasional errors. We appreciate your patience and understanding as we work to improve the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. Confidentiality</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By participating in the beta program, you agree to keep all non-public aspects of Care Net Portal confidential. This includes unreleased features, the platform's design and functionality, and any feedback sessions or communications with the Care Net Portal team. Please do not share screenshots, videos, or descriptions of the platform publicly without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. Feedback</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your feedback is one of the most valuable things you can give us. We ask that you share your honest experience — what works, what doesn't, what's missing, and what matters most to you. By submitting feedback, you grant Care Net Portal a non-exclusive, royalty-free license to use your feedback to improve the platform. You will not receive compensation for feedback, but your input directly shapes what this platform becomes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Real Care Use</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you are using Care Net Portal in an active care situation, we want you to know that we take that seriously. The platform is designed to support — not replace — the judgment of caregivers and families. Always use your own professional and personal judgment in care decisions. Care Net Portal does not provide medical advice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. Data During Beta</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Data you enter during the beta period will be preserved to the best of our ability. However, as a beta user you acknowledge that data loss is possible in the event of a significant system issue. We strongly encourage caregivers to maintain their own backup records of critical care information during this period.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. No Warranty</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Care Net Portal beta is provided "as is" without warranty of any kind. We do our best to keep the platform running reliably, but we cannot guarantee uninterrupted access during the beta period. We will communicate planned maintenance and unexpected outages as promptly as possible.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. Beta Access May End</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We reserve the right to end the beta program or remove individual users from beta access at our discretion. Users who violate the terms of this agreement, misuse the platform, or behave in a way that harms other users or care recipients may have their access revoked immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">8. Transition to Full Release</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When Care Net Portal exits beta, your account and data will transition to the full release. We will communicate pricing and any changes to terms well in advance of the full launch. Beta users will receive advance notice and consideration for early access to launch pricing.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">9. Relationship with Other Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This Beta User Agreement supplements our{" "}
              <a href="#/terms" className="text-primary hover:underline">Terms of Service</a>{" "}
              and{" "}
              <a href="#/privacy" className="text-primary hover:underline">Privacy Policy</a>.
              {" "}In the event of any conflict, this agreement governs your participation in the beta program.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">10. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you have questions about the beta program or this agreement, please reach out at{" "}
              <a href="mailto:portal@carenetportal.com" className="text-primary hover:underline">
                portal@carenetportal.com
              </a>.
              {" "}We read every message.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Care Net Portal · Beta Program · portal@carenetportal.com
          </p>
        </div>
      </div>
    </div>
  );
}
