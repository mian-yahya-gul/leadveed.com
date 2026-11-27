import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PricingCards } from "@/components/PricingCards";
import { getMe } from "@/lib/api";

export const metadata: Metadata = { title: "Pricing", description: "Start free with 25 leads. Paid plans from $19 a month." };

export default async function Pricing() {
  const me = await getMe();
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-3 text-4xl font-extrabold text-ink-950 sm:text-5xl">Pay for leads, not for seats</h1>
          <p className="mt-5 text-lg text-ink-500">One credit unlocks one business, every contact detail we have. Unlocked leads stay yours: re-export them any time for free.</p>
        </div>
        <PricingCards currentPlan={me?.user.plan} />
        <div className="mx-auto mt-20 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            ["What counts as a credit?", "Unlocking one business. Searching, filtering, viewing quality scores and re-exporting leads you already unlocked are free."],
            ["Do credits roll over?", "Unused paid credits carry into the next month, up to twice your monthly allowance."],
            ["Can I cancel?", "Any time, from the billing portal. You keep your plan until the end of the period you paid for, and you keep every lead you unlocked."],
          ].map(([q, a]) => (
            <div key={q} className="card p-6"><h3 className="font-sans font-bold text-ink-950">{q}</h3><p className="mt-2 text-sm leading-6 text-ink-500">{a}</p></div>
          ))}
        </div>
        <p className="mt-12 text-center text-sm text-ink-500">Payments are processed securely by Paddle, our merchant of record. Cards from Pakistan, the Gulf and most countries are accepted.</p>
      </main>
      <Footer />
    </>
  );
}
