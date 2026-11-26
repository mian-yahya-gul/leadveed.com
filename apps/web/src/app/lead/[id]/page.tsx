import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Clock, ExternalLink, Flag, Gauge, Globe, Layers, Mail, MapPin, Phone, Share2, ShieldCheck,
} from "lucide-react";
import { auth } from "@/auth";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { QualityBadge, Signals, SpeedPill, NoWebsiteTag } from "@/components/LeadBits";
import { LeadMap } from "@/components/LeadMap";
import { UnlockButton } from "@/components/UnlockButton";
import { ApiError, getLead } from "@/lib/api";
import { countryName, flag, speedColor } from "@/lib/format";
import type { Lead } from "@/lib/types";

type P = { params: Promise<{ id: string }> };

async function load(id: string) {
  try { return await getLead(id); } catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; }
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const d = await load((await params).id).catch(() => null);
  if (!d) return { title: "Lead not found" };
  const l = d.lead;
  const where = [l.address.city, countryName(l.address.country)].filter(Boolean).join(", ");
  return {
    title: `${l.name}${l.categoryLabel ? ` · ${l.categoryLabel}` : ""}${where ? ` in ${where}` : ""}`,
    description: `${l.name} is a ${l.categoryLabel?.toLowerCase() ?? "business"}${where ? ` in ${where}` : ""}. See phone, website, address and a data quality score of ${l.quality.score}/100 on LeadVeed.`,
  };
}

const BREAKDOWN: Record<string, [string, number]> = {
  confidence: ["Source confidence", 25], phone: ["Phone number", 15], website: ["Own website", 17], email: ["Email", 8],
  address: ["Full address", 12], corroborated: ["Confirmed by 2+ sources", 12], socials: ["Social profiles", 5],
  category: ["Category", 3], fresh: ["Recently updated", 3],
};

export default async function LeadPage({ params }: P) {
  const { id } = await params;
  const [data, session] = await Promise.all([load(id), auth()]);
  if (!data) notFound();
  const { lead: l, similar } = data;
  const signedIn = !!session?.user;
  const address = [l.address.street, l.address.city, l.address.region, l.address.postcode, countryName(l.address.country)].filter(Boolean).join(", ");
  const ld = {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: l.name,
    address: { "@type": "PostalAddress", streetAddress: l.address.street ?? undefined, addressLocality: l.address.city ?? undefined, postalCode: l.address.postcode ?? undefined, addressCountry: l.address.country ?? undefined },
    geo: { "@type": "GeoCoordinates", latitude: l.location.lat, longitude: l.location.lon },
  };

  return (
    <>
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Link href={`/search?${new URLSearchParams({ ...(l.category ? { category: l.category } : {}), ...(l.address.city ? { city: l.address.city } : {}), ...(l.address.country ? { country: l.address.country } : {}) })}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Similar businesses in {l.address.city ?? "this area"}
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
              <span className="chip">{l.categoryLabel ?? "Business"}</span>
              {l.brand && l.brand !== l.name && <span className="chip">Brand: {l.brand}</span>}
              {l.operatingStatus === "temporarily_closed" && <span className="chip border-amber-200 bg-amber-50 text-amber-800">Temporarily closed</span>}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-ink-950 sm:text-4xl">{l.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-ink-500"><MapPin className="h-4 w-4 shrink-0" />{flag(l.address.country)} {address || "Address not listed"}</p>
          </div>
          <div className="flex items-center gap-3">
            <Signals lead={l} />
            <QualityBadge score={l.quality.score} grade={l.quality.grade} size="lg" />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-6">
            {/* Contact */}
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-sans text-sm font-bold uppercase tracking-wider text-ink-500">Contact details</h2>
                {l.unlocked && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><ShieldCheck className="h-4 w-4" /> Unlocked</span>}
              </div>
              <dl className="mt-5 divide-y divide-ink-100">
                <ContactRow icon={Phone} label="Phone" values={l.phones} unlocked={l.unlocked} href={(v) => `tel:${v.replace(/[^\d+]/g, "")}`} />
                <ContactRow icon={Globe} label="Website" values={l.websites} unlocked={l.unlocked} href={(v) => (v.startsWith("http") ? v : `https://${v}`)} empty={<NoWebsiteTag />} />
                <ContactRow icon={Mail} label="Email" values={l.emails} unlocked={l.unlocked} href={(v) => `mailto:${v}`} />
                <ContactRow icon={Share2} label="Social" values={l.socials} unlocked={l.unlocked} href={(v) => v} />
                {l.openingHours && <div className="flex gap-4 py-3.5"><dt className="flex w-28 shrink-0 items-center gap-2 text-sm text-ink-500"><Clock className="h-4 w-4" /> Hours</dt><dd className="text-sm text-ink-800">{l.openingHours}</dd></div>}
              </dl>
              {!l.unlocked && <div className="mt-5"><UnlockButton id={l.id} signedIn={signedIn} /></div>}
            </section>

            <LeadMap points={[{ id: l.id, name: l.name, lat: l.location.lat, lon: l.location.lon, score: l.quality.score }]} zoom={15} className="h-80" />

            {similar.length > 0 && (
              <section className="card p-6">
                <h2 className="font-sans text-sm font-bold uppercase tracking-wider text-ink-500">Similar businesses within 5 km</h2>
                <ul className="mt-4 divide-y divide-ink-100">
                  {similar.map((s: Lead) => (
                    <li key={s.id}>
                      <Link href={`/lead/${s.id}`} className="flex items-center justify-between gap-4 py-3 hover:text-brand-700">
                        <span className="min-w-0"><span className="block truncate font-semibold text-ink-900">{s.name}</span>
                          <span className="block truncate text-xs text-ink-500">{s.address.street ?? s.address.city}</span></span>
                        <span className="flex shrink-0 items-center gap-3">{s.signals.hasWebsite ? <SpeedPill score={s.pagespeed.mobile} /> : <NoWebsiteTag />}<QualityBadge score={s.quality.score} grade={s.quality.grade} /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="space-y-6">
            {/* Quality */}
            <section className="card p-6" id="quality">
              <h2 className="font-sans text-sm font-bold uppercase tracking-wider text-ink-500">Data quality</h2>
              <div className="mt-4 flex items-end gap-3">
                <span className="font-display text-5xl font-extrabold text-ink-950">{l.quality.score}</span>
                <span className="pb-2 text-sm text-ink-500">/ 100 · grade {l.quality.grade}</span>
              </div>
              <ul className="mt-5 space-y-3">
                {Object.entries(BREAKDOWN).map(([k, [label, max]]) => {
                  const v = Math.max(0, l.quality.breakdown[k] ?? 0);
                  return (
                    <li key={k}>
                      <div className="flex justify-between text-xs"><span className="text-ink-600">{label}</span><span className="tabular-nums text-ink-400">{Math.round(v)}/{max}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400" style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
              {(l.quality.breakdown.status ?? 0) < 0 && <p className="mt-4 text-xs text-amber-700">Marked temporarily closed by a source.</p>}
            </section>

            {/* PageSpeed */}
            <section className="card p-6">
              <h2 className="flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wider text-ink-500"><Gauge className="h-4 w-4" /> Website speed</h2>
              {l.pagespeed.mobile !== null ? (
                <div className="mt-4 flex items-center gap-5">
                  <Ring value={l.pagespeed.mobile} />
                  <div className="text-sm text-ink-600">
                    <p className="font-semibold text-ink-900">Google PageSpeed, mobile</p>
                    <p className="mt-1">{l.pagespeed.mobile < 50 ? "Slow. A strong opener for a redesign or speed-up pitch." : l.pagespeed.mobile < 90 ? "Average. Room to improve." : "Fast."}</p>
                    {l.pagespeed.checkedAt && <p className="mt-1 text-xs text-ink-400">Checked {new Date(l.pagespeed.checkedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-500">{l.signals.hasWebsite ? "Not checked yet. Leads people unlock are checked first, usually within a day." : "This business has no website listed, which makes it a good prospect for web design."}</p>
              )}
            </section>

            {/* Sources */}
            <section className="card p-6">
              <h2 className="flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wider text-ink-500"><Layers className="h-4 w-4" /> Sources</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {l.sources.map((s) => (
                  <li key={s} className="flex items-center justify-between">
                    <span className="font-medium text-ink-800">{s === "overture" ? "Overture Maps Foundation" : s === "alltheplaces" ? "All The Places" : s}</span>
                    <span className="text-xs text-ink-400">{s === "overture" ? "CDLA Permissive 2.0" : s === "alltheplaces" ? "CC0" : ""}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-5 text-ink-400">First seen {l.firstSeen} · last confirmed {l.lastSeen}</p>
            </section>

            <Link href={`/remove-my-data?lead=${l.id}`} className="flex items-center gap-2 px-1 text-xs text-ink-400 hover:text-ink-700">
              <Flag className="h-3.5 w-3.5" /> Is this your business? Request removal
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function ContactRow({ icon: Icon, label, values, unlocked, href, empty }: {
  icon: any; label: string; values: string[]; unlocked: boolean; href: (v: string) => string; empty?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-3.5">
      <dt className="flex w-28 shrink-0 items-center gap-2 text-sm text-ink-500"><Icon className="h-4 w-4" /> {label}</dt>
      <dd className="min-w-0 flex-1 space-y-1 text-sm">
        {values.length === 0 ? (empty ?? <span className="text-ink-300">Not found</span>) : values.slice(0, 4).map((v) => (
          unlocked ? (
            <a key={v} href={href(v)} target={label === "Phone" || label === "Email" ? undefined : "_blank"} rel="noreferrer nofollow"
              className="flex items-center gap-1.5 truncate font-medium text-ink-900 hover:text-brand-700">
              <span className="truncate">{v}</span>{label !== "Phone" && label !== "Email" && <ExternalLink className="h-3 w-3 shrink-0 text-ink-400" />}
            </a>
          ) : (
            <span key={v} className="block truncate font-mono text-ink-400 [filter:blur(0.3px)]">{v}</span>
          )
        ))}
      </dd>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" className="h-20 w-20 shrink-0 -rotate-90">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#eef0f7" strokeWidth="7" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className={speedColor(value)} />
      <text x="36" y="36" textAnchor="middle" dominantBaseline="central" className={`rotate-90 fill-current font-display text-[20px] font-bold ${speedColor(value)}`} style={{ transformOrigin: "36px 36px" }}>{value}</text>
    </svg>
  );
}
