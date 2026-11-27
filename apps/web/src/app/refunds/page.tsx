import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Refund policy" };

export default function Refunds() {
  return (
    <LegalPage eyebrow="Legal" title="Refund policy" updated="27 November 2026">
      <p>We want you to be happy with LeadVeed. If you&apos;re not, this is how refunds and cancellations work.</p>
      <h2>14-day refunds</h2>
      <p>If you&apos;re not satisfied, ask for a refund within 14 days of a payment and we&apos;ll refund that payment in full, whether it was your first month or a renewal. Credits added by a refunded payment are removed from your account.</p>
      <h2>Cancelling</h2>
      <p>You can cancel your subscription at any time from the Billing link on your dashboard. You keep your plan and credits until the end of the period you&apos;ve paid for, and you won&apos;t be charged again.</p>
      <h2>How to ask</h2>
      <p>Email <a href="mailto:hello@leadveed.com">hello@leadveed.com</a> from the address on your account, or reply to your receipt. Our payment partner Paddle can also process refund requests directly through the link on your receipt.</p>
      <h2>Who processes payments</h2>
      <p>Our order process is conducted by our online reseller Paddle.com. Paddle.com is the merchant of record for all our orders and handles customer service inquiries and returns related to payments. See also our <Link href="/terms">terms of service</Link>.</p>
    </LegalPage>
  );
}
