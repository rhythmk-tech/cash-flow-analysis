import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Terms of Service — Cash Flow Forecaster",
};

export default function TermsPage() {
  return (
    <div className="legal-shell">
      <nav className="legal-nav">
        <div className="brand">
          <div className="brand-mark">CF</div>
          <span className="landing-nav-name">Cash Flow Forecaster</span>
        </div>
        <Link className="btn-secondary" href="/">
          Back to home
        </Link>
      </nav>

      <div className="legal-content">
        <h1 className="display">Terms of Service</h1>
        <p className="legal-updated">
          Last updated: <span className="legal-placeholder">[EFFECTIVE DATE]</span>
        </p>

        <div className="tip insight legal-draft-notice">
          <span className="tip-icon">
            <AlertTriangle size={15} />
          </span>
          <p>
            <strong>Draft — not yet reviewed by counsel.</strong>{" "}
            This page is placeholder content generated to scaffold real Terms of Service. Every bracketed field needs to be filled in, and the substance — especially the liability, indemnification, and dispute-resolution sections — needs review by a lawyer licensed in your jurisdiction before this is relied on.
          </p>
        </div>

        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of Cash Flow Forecaster (the &quot;Service&quot;), operated by{" "}
          <span className="legal-placeholder">[COMPANY LEGAL NAME]</span>{" "}
          (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an account or using the Service, you agree to be bound by these Terms. If you are using the Service on behalf of a company, you represent that you have authority to bind that company to these Terms.
        </p>

        <h2>1. The Service</h2>
        <p>
          Cash Flow Forecaster lets you record income and expense line items and generates weekly cash flow forecasts, scenarios, and reports from the data you enter. The Service does not connect to your bank accounts, move money, or provide financial, tax, or investment advice. Forecasts are only as accurate as the data you provide.
        </p>

        <h2>2. Accounts</h2>
        <ul>
          <li>You must provide accurate information when creating an account and keep your login credentials confidential.</li>
          <li>You&apos;re responsible for all activity that happens under your account, including actions taken by teammates you invite.</li>
          <li>
            You must notify us promptly at{" "}
            <span className="legal-placeholder">[CONTACT EMAIL]</span>{" "}
            if you suspect unauthorized access to your account.
          </li>
          <li>You must be at least 18 years old to create an account.</li>
        </ul>

        <h2>3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
          <li>Attempt to gain unauthorized access to another company&apos;s data or workspace.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service.</li>
          <li>Reverse-engineer, scrape, or resell the Service without our written permission.</li>
          <li>Upload malicious code or attempt to probe, scan, or test the vulnerability of the Service.</li>
        </ul>

        <h2>4. Your data</h2>
        <p>
          You retain ownership of the data you enter into the Service (&quot;Customer Data&quot;). You grant us a limited license to host, process, and display Customer Data solely to provide and improve the Service. See our{" "}
          <Link href="/privacy">Privacy Policy</Link>{" "}
          for how we handle personal information.
        </p>

        <h2>5. Team members and roles</h2>
        <p>
          Account owners may invite teammates and assign roles that control what each person can view or edit. You&apos;re responsible for managing who has access to your company&apos;s workspace and for removing access when appropriate.
        </p>

        <h2>6. Fees</h2>
        <p>
          <span className="legal-placeholder">
            [DESCRIBE PRICING/BILLING TERMS ONCE A PAID PLAN EXISTS — currently no payment processing is implemented. Remove this section if the Service remains free, or replace with real subscription/billing/refund/cancellation terms.]
          </span>
        </p>

        <h2>7. Termination</h2>
        <p>
          You may stop using the Service and request account deletion at any time. We may suspend or terminate your access if you violate these Terms, or if required by law.{" "}
          <span className="legal-placeholder">[DESCRIBE DATA HANDLING ON TERMINATION ONCE ACCOUNT DELETION IS BUILT]</span>
        </p>

        <h2>8. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. FORECASTS GENERATED BY THE SERVICE ARE ESTIMATES BASED ON THE DATA YOU PROVIDE AND ARE NOT FINANCIAL ADVICE — YOU ARE SOLELY RESPONSIBLE FOR FINANCIAL DECISIONS MADE USING THE SERVICE.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          <span className="legal-placeholder">
            [TO THE MAXIMUM EXTENT PERMITTED BY LAW — STANDARD LIABILITY CAP LANGUAGE GOES HERE. Needs jurisdiction-specific drafting by counsel; do not use boilerplate without review.]
          </span>
        </p>

        <h2>10. Indemnification</h2>
        <p>
          You agree to indemnify and hold us harmless from any claims, damages, or expenses arising from your use of the Service or violation of these Terms.{" "}
          <span className="legal-placeholder">[NEEDS COUNSEL REVIEW]</span>
        </p>

        <h2>11. Governing law &amp; dispute resolution</h2>
        <p>
          These Terms are governed by the laws of{" "}
          <span className="legal-placeholder">[JURISDICTION]</span>, without regard to conflict-of-law principles.{" "}
          <span className="legal-placeholder">[ADD ARBITRATION/VENUE CLAUSE IF DESIRED — NEEDS COUNSEL REVIEW]</span>
        </p>

        <h2>12. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms. We will notify you of material changes by{" "}
          <span className="legal-placeholder">[NOTIFICATION METHOD]</span>.
        </p>

        <h2>13. Contact us</h2>
        <p>
          Questions about these Terms? Contact us at{" "}
          <span className="legal-placeholder">[CONTACT EMAIL]</span>.
        </p>
      </div>
    </div>
  );
}
