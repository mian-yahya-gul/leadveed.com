import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy policy" updated="26 November 2026">
      <p>This policy explains what personal data LeadVeed handles, why, and the choices you have. It covers two groups of people: our customers, and people connected to the businesses listed in our database.</p>

      <h2>1. Business listings</h2>
      <p>
        Our database describes businesses: their names, categories, addresses, phone numbers, websites and public social profiles, taken from the open sources listed on our{" "}
        <Link href="/data-licensing">data licensing page</Link>. Some listings, such as sole traders, may include information that identifies a person.
      </p>
      <ul>
        <li><b>Why we process it:</b> to help businesses find and contact other businesses (our legitimate interest, and our customers&apos;), using information the business has already made public.</li>
        <li><b>What we don&apos;t do:</b> we don&apos;t collect private individuals&apos; home details, sensitive data, or data from sources that forbid reuse.</li>
        <li><b>Your choices:</b> you can ask us to remove a listing at any time through <Link href="/remove-my-data">Remove my data</Link>, or ask what we hold about you by emailing <a href="mailto:privacy@leadveed.com">privacy@leadveed.com</a>. Removed listings are kept out of future imports.</li>
      </ul>

      <h2>2. Customers</h2>
      <ul>
        <li><b>Account data:</b> your name, email address and profile picture from your sign-in provider.</li>
        <li><b>Usage data:</b> the searches you run, the leads you unlock and export, your lists and your credit history, so the product works and your bill is right.</li>
        <li><b>Payments:</b> handled by Paddle (Paddle.com) as merchant of record. We never see or store your card details.</li>
        <li><b>Email:</b> sign-in links and account messages are sent through Resend.</li>
        <li><b>Security:</b> Cloudflare protects the site from abuse and may process your IP address for that purpose.</li>
      </ul>
      <p>We don&apos;t sell customer data, and we don&apos;t use advertising trackers.</p>

      <h2>3. Retention</h2>
      <p>We keep account data while your account is open and delete it within 30 days of you closing it, except records we must keep for tax and accounting.</p>

      <h2>4. Your rights</h2>
      <p>Depending on where you live you may have the right to access, correct, delete or export your data, and to object to processing. Email <a href="mailto:privacy@leadveed.com">privacy@leadveed.com</a> and we&apos;ll reply within 30 days.</p>

      <h2>5. Contact</h2>
      <p>LeadVeed · <a href="mailto:privacy@leadveed.com">privacy@leadveed.com</a></p>
    </LegalPage>
  );
}
