import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { RemovalForm } from "@/components/RemovalForm";

export const metadata: Metadata = { title: "Remove my data", description: "Ask LeadVeed to remove a business listing." };

export default async function RemoveMyData({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead } = await searchParams;
  return (
    <>
      <Header />
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="eyebrow">Privacy</p>
          <h1 className="mt-3 text-4xl font-extrabold text-ink-950">Remove a listing</h1>
          <p className="mt-5 leading-7 text-ink-600">If you own or represent a business listed on LeadVeed, you can ask us to remove it. We&apos;ll email you a link to confirm, then delete the listing and keep it out of future monthly imports.</p>
          <ul className="mt-8 space-y-3 text-sm text-ink-600">
            <li>• It&apos;s free and takes about a minute.</li>
            <li>• Customers who already exported the lead are asked by our terms to honour opt-outs.</li>
            <li>• To correct details rather than remove them, update the original source; changes arrive with the next release.</li>
          </ul>
        </div>
        <RemovalForm lead={lead && /^lv_[a-f0-9]{16}$/.test(lead) ? lead : undefined} />
      </main>
      <Footer />
    </>
  );
}
