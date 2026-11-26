"use client";
import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { CURRENCIES, PLANS, type Currency } from "@/lib/plans";

export function PricingCards({ currentPlan }: { currentPlan?: string }) {
  const [cur, setCur] = useState<Currency>("USD");
  const c = CURRENCIES[cur];
  const price = (usd: number) => usd === 0 ? `${c.symbol}0` : `${c.symbol}${new Intl.NumberFormat("en").format(Math.round(usd * c.rate))}`;
  return (
    <>
      <div className="mt-10 flex justify-center">
        <div className="inline-flex rounded-xl bg-ink-100/80 p-1 text-xs font-semibold" role="group" aria-label="Show prices in">
          {(Object.keys(CURRENCIES) as Currency[]).map((k) => (
            <button key={k} onClick={() => setCur(k)} aria-pressed={cur === k}
              className={`rounded-lg px-3 py-1.5 ${cur === k ? "bg-white text-ink-950 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>{k}</button>
          ))}
        </div>
      </div>
      {cur !== "USD" && <p className="mt-3 text-center text-xs text-ink-400">Approximate. You're billed in US dollars; your bank converts.</p>}
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const popular = "popular" in p && p.popular;
          const current = currentPlan === p.id;
          return (
            <div key={p.id} className={`relative flex flex-col rounded-2xl border p-7 ${popular ? "border-brand-500 bg-white shadow-pop ring-4 ring-brand-100" : "card"}`}>
              {popular && <span className="absolute -top-3 left-7 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Most popular</span>}
              <h3 className="font-sans text-lg font-bold text-ink-950">{p.name}</h3>
              <p className="mt-1 text-sm text-ink-500">{p.blurb}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-5xl font-extrabold text-ink-950">{price(p.price)}</span>
                {p.price > 0 && <span className="text-sm text-ink-500">/ month</span>}
              </div>
              <p className="mt-2 text-xs text-ink-500">{p.price ? `${price(p.price / p.credits * 100)} per 100 leads` : "No card needed"}</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-ink-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{f}</li>
                ))}
              </ul>
              {current ? (
                <span className="btn-outline mt-8 w-full cursor-default py-3">Your current plan</span>
              ) : p.id === "free" ? (
                <Link href="/login?signup=1" className="btn-outline mt-8 w-full py-3">Start free</Link>
              ) : (
                <a href={`/api/checkout?plan=${p.id}`} className={`${popular ? "btn-primary" : "btn-outline"} mt-8 w-full py-3`}>Choose {p.name}</a>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
