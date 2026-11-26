import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of service" };

export default function Terms() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of service" updated="26 November 2026">
      <p>These terms govern your use of LeadVeed. By creating an account you agree to them.</p>
      <h2>1. The service</h2>
      <p>LeadVeed lets you search a database of businesses and unlock their contact details using credits. Data comes from open sources and is provided as is; we work hard on accuracy but can&apos;t guarantee every record is current.</p>
      <h2>2. Credits and plans</h2>
      <ul>
        <li>One credit unlocks one business for your account. Leads you have unlocked can be viewed and exported again at no cost.</li>
        <li>Free accounts receive 25 credits once. Paid plans add credits each billing month; unused paid credits roll over one month, up to twice the monthly allowance.</li>
        <li>Subscriptions renew automatically until cancelled. You can cancel any time and keep your plan until the end of the paid period.</li>
        <li>Credits have no cash value and can&apos;t be transferred.</li>
      </ul>
      <h2>3. Acceptable use</h2>
      <ul>
        <li>Use the data for legitimate business-to-business purposes only.</li>
        <li>Follow the laws that apply to your outreach, including anti-spam, telemarketing and data protection laws, consent requirements and do-not-call lists.</li>
        <li>Don&apos;t resell or republish the database as a competing product, and don&apos;t scrape LeadVeed or try to bypass credits or rate limits.</li>
        <li>Keep the source attribution described on our <Link href="/data-licensing">data licensing page</Link> when you redistribute data.</li>
      </ul>
      <h2>4. Accounts</h2>
      <p>You&apos;re responsible for activity on your account. We may suspend accounts that break these terms, with a refund of unused paid credits where the law requires it.</p>
      <h2>5. Liability</h2>
      <p>To the extent the law allows, LeadVeed isn&apos;t liable for indirect or consequential losses, and our total liability is limited to the amount you paid us in the 12 months before the claim.</p>
      <h2>6. Changes</h2>
      <p>We may update these terms and will tell you by email about material changes at least 14 days before they apply.</p>
      <h2>7. Contact</h2>
      <p><a href="mailto:hello@leadveed.com">hello@leadveed.com</a></p>
    </LegalPage>
  );
}
