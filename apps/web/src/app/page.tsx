import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Building2, Check, Download, Gauge, Globe2, Layers, LineChart, Lock, MapPinned,
  Megaphone, Repeat, Sparkles, Target, X,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { HeroSearch } from "@/components/HeroSearch";
import { QualityBadge, Signals, SpeedPill, NoWebsiteTag } from "@/components/LeadBits";
import { api, getStats, safe } from "@/lib/api";
import { compact, countryName, flag, nf } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import type { SearchResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, preview] = await Promise.all([
    getStats(),
    safe(api<SearchResponse>("/v1/search?city=Dubai&country=AE&has_phone=true&min_quality=70&per_page=6&sort=quality", { userId: null })),
  ]);
  const leads = stats?.leads ?? 0;

  return (
    <>
      <Header dark />
      {/* HERO ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-brand-600/35 blur-[120px]" />
        <div className="absolute -bottom-24 right-[-10%] h-[300px] w-[500px] rounded-full bg-signal-500/10 blur-[100px]" />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-20 text-center sm:px-6 md:pt-28">
          <Link href="/data-licensing"
            className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-ink-200 hover:bg-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-400 shadow-[0_0_10px_2px] shadow-signal-400/60" />
            {stats?.lastImport ? `Fresh data: release ${stats.lastImport.release}` : "Refreshed every month from open, licensed sources"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <h1 className="mx-auto mt-6 max-w-4xl animate-fade-up text-4xl font-extrabold leading-[1.05] sm:text-6xl md:text-7xl [animation-delay:60ms]">
            Find the businesses<br className="hidden sm:block" /> that need{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10 bg-gradient-to-r from-signal-300 via-signal-400 to-brand-300 bg-clip-text text-transparent">what you sell</span>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-8 text-ink-300 [animation-delay:120ms]">
            {leads > 0 ? `${compact(leads)} local businesses` : "Millions of local businesses"} with phone numbers, websites and addresses,
            merged from multiple open sources and scored for quality. Spot the ones with no website or a slow one, and export a clean list in seconds.
          </p>
          <div className="mx-auto mt-10 max-w-4xl animate-fade-up text-left [animation-delay:180ms]">
            <HeroSearch />
          </div>
          <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-6 text-left sm:grid-cols-4">
            <Stat label="Businesses" value={leads ? compact(leads) : "—"} />
            <Stat label="Countries" value={stats ? nf.format(stats.countries) : "—"} />
            <Stat label="With a phone" value={stats ? `${Math.round(stats.shares.phone * 100)}%` : "—"} />
            <Stat label="Avg. quality score" value={stats ? `${stats.avgQuality}/100` : "—"} />
          </dl>
        </div>
      </section>

      {/* PRODUCT PREVIEW --------------------------------------------------- */}
      <section className="relative -mt-10 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-ink-50/70 px-5 py-3 text-xs">
              <span className="font-semibold text-ink-900">Live preview</span>
              <span className="chip">🇦🇪 Dubai</span><span className="chip">Has phone</span><span className="chip">Quality 70+</span>
              <span className="ml-auto text-ink-500">{preview ? `${nf.format(preview.found)} matching businesses` : ""}</span>
            </div>
            <div className="divide-y divide-ink-100">
              {preview?.hits.length ? preview.hits.map((l) => (
                <Link key={l.id} href={`/lead/${l.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 transition hover:bg-brand-50/40 md:grid-cols-[2fr_1.2fr_1fr_auto_auto]">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink-950">{l.name}</div>
                    <div className="truncate text-xs text-ink-500">{l.categoryLabel ?? "Business"} · {l.address.city}</div>
                  </div>
                  <div className="hidden font-mono text-sm text-ink-600 md:block">{l.phones[0] ?? "—"}</div>
                  <div className="hidden md:block">{l.signals.hasWebsite ? <SpeedPill score={l.pagespeed.mobile} /> : <NoWebsiteTag />}</div>
                  <div className="hidden md:block"><Signals lead={l} /></div>
                  <QualityBadge score={l.quality.score} grade={l.quality.grade} />
                </Link>
              )) : (
                <div className="px-5 py-10 text-center text-sm text-ink-500">Search any city to see live results.</div>
              )}
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-ink-100 px-5 py-3.5 text-sm">
              <span className="flex items-center gap-2 text-ink-500"><Lock className="h-4 w-4" /> Contact details unlock with one credit per lead. Re-exports are free.</span>
              <Link href="/search?city=Dubai&country=AE" className="btn-outline btn-sm">Open in search <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* WHY ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="max-w-2xl">
          <p className="eyebrow">Why LeadVeed</p>
          <h2 className="mt-3 text-3xl font-extrabold text-ink-950 sm:text-5xl">Lead data you can actually trust, priced like it should be.</h2>
          <p className="mt-5 text-lg leading-8 text-ink-500">
            Most lead lists are scraped once and sold forever. LeadVeed rebuilds every month from licensed open data, merges duplicates across sources and tells you how good each record is before you spend a credit.
          </p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={Layers} title="Merged from multiple sources" text="Overture Maps and All The Places are matched by phone, website and name within metres, so each business appears once with the best fields from every source." />
          <Feature icon={BadgeCheck} title="A quality score on every lead" text="0 to 100, from source confidence, cross-source confirmation, contact completeness and freshness. Filter out the weak ones before you pay." />
          <Feature icon={Globe2} title="Find businesses with no website" text="The fastest-closing prospects for web designers and agencies. One click filters to businesses with a phone but no site." />
          <Feature icon={Gauge} title="Website speed built in" text="Google PageSpeed scores on lead websites. Pitch a redesign with the number already in hand: ‘your site scores 23 on mobile’." />
          <Feature icon={Repeat} title="Pay once per lead, forever" text="Unlock a lead once and it's yours. Re-export it, add it to lists, download it again next month, never charged twice." />
          <Feature icon={MapPinned} title="Strong in Pakistan and the Gulf" text="Native coverage of Karachi, Lahore, Islamabad, Dubai, Abu Dhabi, Riyadh, Doha and more, with city names cleaned up across scripts." />
        </div>
      </section>

      {/* USE CASES ------------------------------------------------------------ */}
      <section className="bg-ink-50/70">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid items-start gap-14 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <p className="eyebrow">Built for outbound</p>
              <h2 className="mt-3 text-3xl font-extrabold text-ink-950 sm:text-4xl">One search. A list your team can call today.</h2>
              <p className="mt-5 text-lg leading-8 text-ink-500">Pick a niche and a city, narrow it down with the filters that matter for your offer, then export to your CRM or dialer.</p>
              <ol className="mt-10 space-y-6">
                {[
                  ["Search", "Category, city or a radius on the map. Filters for website, phone, email, PageSpeed, quality and new businesses."],
                  ["Check", "See quality, signals and website speed for every result before spending anything."],
                  ["Export", "Unlock and download a clean CSV with phone, website, email, address and coordinates."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-950 font-display text-sm font-bold text-signal-400">{i + 1}</span>
                    <div><div className="font-semibold text-ink-950">{t}</div><p className="mt-1 text-sm leading-6 text-ink-500">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <UseCase icon={Sparkles} title="Web design agencies" text="Restaurants, clinics and salons with no website, or a site scoring under 50 on mobile." query="has_website=false&has_phone=true" />
              <UseCase icon={LineChart} title="SEO and marketing" text="Businesses with a website but weak signals: no socials, slow pages, thin listings." query="has_website=true&has_socials=false" />
              <UseCase icon={Target} title="B2B sales teams" text="Every company of a type in your territory, with a phone and a domain for enrichment." query="has_phone=true&has_website=true&min_quality=70" />
              <UseCase icon={Megaphone} title="New business outreach" text="Places that appeared in the latest monthly release, before your competitors find them." query="new_days=45&sort=newest" />
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON ---------------------------------------------------------- */}
      <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
        <div className="text-center">
          <p className="eyebrow">The difference</p>
          <h2 className="mt-3 text-3xl font-extrabold text-ink-950 sm:text-4xl">What you get versus a typical lead list</h2>
        </div>
        <div className="card mt-12 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
              <tr><th className="px-5 py-3.5 font-semibold" /><th className="px-5 py-3.5 font-semibold text-brand-700">LeadVeed</th><th className="px-5 py-3.5 font-semibold">Typical list</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {[
                ["Refreshed", "Every month, automatically", "Once, when it was scraped"],
                ["Duplicates", "Merged across sources", "Often several per business"],
                ["Quality shown before you pay", true, false, true],
                ["‘No website’ and PageSpeed filters", true, false, true],
                ["Pay again to re-download", false, true, false],
                ["Clear data licences and opt-out", true, false, true],
              ].map(([k, a, b, yesGood]) => (
                <tr key={String(k)}>
                  <td className="px-5 py-3.5 font-medium text-ink-800">{k}</td>
                  <td className="px-5 py-3.5"><Cell v={a as string | boolean} yesGood={yesGood as boolean} strong /></td>
                  <td className="px-5 py-3.5 text-ink-500"><Cell v={b as string | boolean} yesGood={yesGood as boolean} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* COVERAGE ------------------------------------------------------------- */}
      {stats && stats.byCountry.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
          <div className="card p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Coverage</p>
                <h2 className="mt-2 text-2xl font-extrabold text-ink-950">Top countries in the current release</h2>
              </div>
              <Link href="/search" className="btn-outline btn-sm">Browse all <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stats.byCountry.slice(0, 12).map((c) => (
                <Link key={c.country} href={`/search?country=${c.country}`}
                  className="flex items-center justify-between rounded-xl border border-ink-100 px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/40">
                  <span className="flex items-center gap-2.5 font-medium text-ink-800"><span className="text-xl">{flag(c.country)}</span>{countryName(c.country)}</span>
                  <span className="text-sm tabular-nums text-ink-500">{compact(c.n)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PRICING TEASER -------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="grid-bg absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="eyebrow text-signal-400">Simple pricing</p>
              <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Start free. Upgrade when the leads start closing.</h2>
            </div>
            <Link href="/pricing" className="btn-signal">Compare plans <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.id} className={`rounded-2xl border p-6 ${"popular" in p && p.popular ? "border-brand-400 bg-brand-600/20" : "border-white/10 bg-white/[0.03]"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.name}</span>
                  {"popular" in p && p.popular && <span className="rounded-full bg-signal-400 px-2 py-0.5 text-[10px] font-bold uppercase text-ink-950">Popular</span>}
                </div>
                <div className="mt-4 font-display text-4xl font-extrabold">${p.price}<span className="text-base font-medium text-ink-400">{p.price ? "/mo" : ""}</span></div>
                <div className="mt-2 text-sm text-ink-300">{nf.format(p.credits)} lead unlocks{p.price ? " a month" : ""}</div>
                <div className="mt-1 text-xs text-ink-500">{p.price ? `$${(p.price / p.credits * 100).toFixed(1)} per 100 leads` : "No card needed"}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold text-ink-950">Questions</h2>
        <div className="mt-10 divide-y divide-ink-100 rounded-2xl border border-ink-100">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink-900">
                {q}<span className="text-xl font-light text-ink-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-7 text-ink-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-ink-900 px-8 py-14 text-center text-white shadow-pop">
          <div className="grid-bg absolute inset-0 opacity-50" />
          <div className="relative">
            <Building2 className="mx-auto h-10 w-10 text-signal-400" />
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">Your next 25 customers are already listed.</h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-100">Create a free account, run any search, and export 25 leads on us. No card needed.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/login?signup=1" className="btn-signal px-6 py-3 text-[15px]">Get 25 free leads <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/search" className="btn px-6 py-3 text-[15px] text-white ring-1 ring-white/25 hover:bg-white/10"><Download className="h-4 w-4" /> Explore the data</Link>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}

const FAQ: [string, string][] = [
  ["Where does the data come from?", "From Overture Maps Foundation (published under CDLA Permissive 2.0) and All The Places (CC0), two large open datasets of places built from licensed contributions and businesses' own store locators. We don't scrape sites that forbid it and we don't buy from data brokers. See the data licensing page for details."],
  ["How fresh is it?", "Overture publishes a new release every month and All The Places runs every week. LeadVeed imports the latest release automatically, keeps each lead's id stable, and removes businesses that disappear from the sources."],
  ["What does one credit buy?", "One credit unlocks one business: every phone number, website, email and social profile we have for it. Once unlocked it stays unlocked for your account, so exporting it again is free."],
  ["Do you have emails for every business?", "Not yet. Emails come from the source data today, and you can filter for leads that have one. Finding emails from businesses' own websites is next on our roadmap."],
  ["I own a business and want it removed.", "Use the ‘Remove my data’ page. Once you confirm by email we delete the listing and keep it out of future imports."],
  ["Can I pay in PKR or AED?", "Billing is in US dollars through our payment partner, which accepts cards from Pakistan, the UAE and most other countries. The pricing page can show approximate prices in your currency."],
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-white/10 pl-4">
      <dd className="font-display text-2xl font-bold text-white sm:text-3xl">{value}</dd>
      <dt className="mt-1 text-xs uppercase tracking-wider text-ink-400">{label}</dt>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="card group p-6 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 font-sans text-base font-bold text-ink-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-500">{text}</p>
    </div>
  );
}

function UseCase({ icon: Icon, title, text, query }: { icon: any; title: string; text: string; query: string }) {
  return (
    <Link href={`/search?${query}`} className="card group flex flex-col p-6 transition hover:border-brand-200">
      <Icon className="h-6 w-6 text-brand-600" />
      <h3 className="mt-4 font-sans font-bold text-ink-950">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-ink-500">{text}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        Try this search <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Cell({ v, yesGood = true, strong }: { v: string | boolean; yesGood?: boolean; strong?: boolean }) {
  if (typeof v === "string") return <span className={strong ? "font-semibold text-ink-900" : ""}>{v}</span>;
  const good = v === yesGood;
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${good ? "text-emerald-600" : "text-rose-600"}`}>
      {good ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {v ? "Yes" : "No"}
    </span>
  );
}
