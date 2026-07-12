/**
 * Privacy Policy — /privacy
 * Accessible from apply form, complete-signup, and footer links.
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart } from "lucide-react";

export default function PrivacyPolicy() {
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

        <h1 className="text-2xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: July 2026</p>

        <div className="space-y-8 text-foreground">

          <section>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Care Net Portal is built on trust. The people who use this platform are sharing some of the most personal aspects of their lives — the care of someone they love. We take that responsibility seriously. This Privacy Policy explains what information we collect, how we use it, and how we protect it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              We collect information you provide directly to us, including:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Name and email address when you apply for or create an account</li>
              <li>Your role (caregiver, family member) and care situation during application</li>
              <li>Care logs, schedules, messages, and documentation you enter into the platform</li>
              <li>Account activity including logins and session information</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">
              We do not collect payment information, social security numbers, or medical record numbers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              We use the information we collect to:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Provide, maintain, and improve the Care Net Portal platform</li>
              <li>Send transactional emails such as account invites, verifications, and password resets</li>
              <li>Respond to your questions and support requests</li>
              <li>Monitor platform health and prevent abuse</li>
              <li>Understand how the platform is being used so we can make it better</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">
              We do not sell your personal information. We do not use your information for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. Care Recipient Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Information about care recipients entered into the platform — including health notes, schedules, medications, and care logs — is treated with the highest level of confidentiality. This information is accessible only to authorized users within the same care circle. We do not access, review, or share this information except as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Information Sharing</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              We do not share your personal information with third parties except in the following limited circumstances:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li><span className="font-medium text-foreground">Service providers</span> — We use Resend to deliver transactional emails on our behalf. They do not use your data for any other purpose.</li>
              <li><span className="font-medium text-foreground">Legal requirements</span> — We may disclose information if required by law or in response to valid legal process.</li>
              <li><span className="font-medium text-foreground">Safety</span> — We may share information when we believe it is necessary to protect the safety of any person.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. Data Storage and Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your data is stored on secure servers hosted by Railway. We use industry-standard security measures including encrypted connections (HTTPS), hashed passwords, and session-based authentication. No security system is impenetrable, but we take every reasonable precaution to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. Cookies and Sessions</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use a single session cookie (<code className="text-xs bg-muted px-1 py-0.5 rounded">cn_session</code>) to keep you logged in. This cookie is httpOnly, meaning it cannot be accessed by JavaScript, and expires after 30 days. We do not use tracking cookies or third-party analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. Your Rights</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              You have the right to:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and associated data</li>
              <li>Withdraw consent for any data processing based on consent</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:portal@carenetportal.com" className="text-primary hover:underline">
                portal@carenetportal.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">8. Children's Privacy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Care Net Portal is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child has provided us personal information, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">9. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy as the platform evolves. We will notify registered users of material changes by email. Your continued use of Care Net Portal after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">10. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you have questions or concerns about this Privacy Policy, please contact us at{" "}
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
