/**
 * Terms of Service — /terms
 * Accessible from apply form, complete-signup, and footer links.
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart } from "lucide-react";

export default function TermsOfService() {
  const [, navigate] = useLocation();

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

        <h1 className="text-2xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: July 2026</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By accessing or using Care Net Portal ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. These terms apply to all users, including caregivers, family members, and any other individuals who access the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. Beta Program</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Care Net Portal is currently in beta. Access is by invitation only. As a beta user, you acknowledge that the Service may contain bugs, errors, or incomplete features. We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time during the beta period without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. Eligibility</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You must be at least 18 years of age to use Care Net Portal. By using the Service, you represent that you meet this requirement and that the information you provide during registration is accurate and complete.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Accounts and Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. Care Net Portal cannot and will not be liable for any loss or damage arising from your failure to protect your account information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. Appropriate Use</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Care Net Portal is designed to support communication and documentation between caregivers and families. You agree to use the Service only for lawful purposes and in a manner consistent with its intended use. You may not use the Service to:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Share false, misleading, or harmful information about a care recipient</li>
              <li>Violate the privacy or dignity of any individual</li>
              <li>Transmit unsolicited communications or spam</li>
              <li>Attempt to gain unauthorized access to any part of the platform</li>
              <li>Use the platform for any commercial purpose not expressly authorized</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. Care Information and Documentation</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Care Net Portal is a communication and documentation tool. It is not a medical device, clinical record system, or substitute for professional medical advice. Information documented in the platform should not be used as the sole basis for medical decisions. Always consult qualified healthcare professionals for medical guidance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. Confidentiality</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By using Care Net Portal, you agree to treat all information about care recipients with the utmost confidentiality and respect. You may not share, distribute, or disclose information about any individual in the platform without explicit consent from all relevant parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">8. Intellectual Property</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All content, design, features, and functionality of Care Net Portal — including but not limited to text, graphics, logos, and software — are the exclusive property of Care Net Portal and are protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">9. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To the fullest extent permitted by law, Care Net Portal and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service. Our total liability to you for any claims shall not exceed the amount you paid to use the Service in the preceding twelve months.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">10. Termination</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your access to Care Net Portal at any time, with or without cause, and with or without notice. Upon termination, your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">11. Changes to Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update these Terms of Service from time to time. We will notify registered users of significant changes by email. Your continued use of the Service after changes are posted constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">12. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you have questions about these Terms of Service, please contact us at{" "}
              <a href="mailto:portal@carenetportal.com" className="text-primary hover:underline">
                portal@carenetportal.com
              </a>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Care Net Portal · portal@carenetportal.com
          </p>
        </div>
      </div>
    </div>
  );
}
