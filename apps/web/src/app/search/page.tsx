import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, List, Map as MapIcon, SearchX, ServerCrash, UserPlus } from "lucide-react";
import { auth } from "@/auth";
import { Filters } from "@/components/Filters";
import { Header } from "@/components/Header";
import { LeadMap } from "@/components/LeadMap";
import { ResultsTable } from "@/components/ResultsTable";
import { SortSelect } from "@/components/SortSelect";
import { ApiError, getStats, search } from "@/lib/api";
import { countryName, humanize, nf } from "@/lib/format";
import { groupLabel } from "@/lib/groups";
import type { SearchResponse } from "@/lib/types";

type SP = Record<string, string | string[] | undefined>;

function flat(sp: SP): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) o[k] = v;
  return o;
}

function title(q: Record<string, string>): string {
  const what = q.category ? `${humanize(q.category)} leads` : q.group ? groupLabel(q.group) : q.q ? `“${q.q}”` : "Businesses";
  const where = q.city ?? (q.country ? countryName(q.country) : "");
  const extra = q.has_website === "false" ? " without a website" : "";
  return `${what}${extra}${where ? ` in ${where}` : ""}`;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const q = flat(await searchParams);
  return { title: `${title(q)} — leads`, robots: { index: false } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const q = flat(await searchParams);
  const view = q.view === "map" ? "map" : "list";
  const { view: _v, ...apiQuery } = q;
  const qs = new URLSearchParams({ per_page: "25", ...apiQuery }).toString();
  const [session, stats] = await Promise.all([auth(), getStats()]);

  let data: SearchResponse | null = null;
  let error: "signin" | "down" | null = null;
  try {
    data = await search(qs);
  } catch (e) {
    error = e instanceof ApiError && e.status === 401 ? "signin" : "down";
  }

  const page = Number(q.page ?? 1);
  const pages = data ? Math.max(1, Math.ceil(data.found / data.perPage)) : 1;
  const link = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(q);
    for (const [k, v] of Object.entries(patch)) { if (v === null) n.delete(k); else n.set(k, v); }
    return `/search?${n}`;
  };

  return (
    <>
      <Header />
      <main className="mx-auto grid w-full max-w-[1500px] flex-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[280px_1fr]">
        <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2">
          <Filters countries={stats?.byCountry ?? []} />
        </div>
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-ink-950 sm:text-3xl">{title(q)}</h1>
              <p className="mt-1 text-sm text-ink-500">
                {data ? <><b className="text-ink-800">{nf.format(data.found)}</b> businesses found{data.found >= 100000 ? "+" : ""} · {data.tookMs} ms</> : " "}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SortSelect value={q.sort ?? "relevance"} />
              <div className="flex rounded-xl bg-ink-100/70 p-1 text-xs font-semibold">
                <Link href={link({ view: null })} scroll={false} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${view === "list" ? "bg-white text-ink-950 shadow-sm" : "text-ink-500"}`}><List className="h-3.5 w-3.5" /> List</Link>
                <Link href={link({ view: "map" })} scroll={false} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${view === "map" ? "bg-white text-ink-950 shadow-sm" : "text-ink-500"}`}><MapIcon className="h-3.5 w-3.5" /> Map</Link>
              </div>
            </div>
          </div>

          {data?.facets?.category_label && data.facets.category_label.length > 1 && !q.category && (
            <div className="mb-5 flex flex-wrap gap-2">
              {data.facets.category?.slice(0, 10).map((f) => (
                <Link key={f.value} href={link({ category: f.value, page: null })} scroll={false}
                  className="chip transition hover:border-brand-300 hover:bg-brand-50">
                  {humanize(f.value)} <span className="text-ink-400">{nf.format(f.count)}</span>
                </Link>
              ))}
            </div>
          )}

          {error === "down" && (
            <Empty icon={ServerCrash} title="Search is warming up" text="We couldn't reach the lead database just now. Please try again in a minute." />
          )}
          {error === "signin" && (
            <Empty icon={UserPlus} title="Create a free account to keep browsing" text="Visitors can see the first few pages. Sign up free to see every result and unlock 25 leads.">
              <Link href={`/login?signup=1&next=${encodeURIComponent(link({}))}`} className="btn-primary mt-6">Get 25 free leads</Link>
            </Empty>
          )}
          {data && data.hits.length === 0 && (
            <Empty icon={SearchX} title="No businesses match" text="Try a nearby city, a broader business type, or fewer filters." />
          )}

          {data && data.hits.length > 0 && view === "map" && (
            <div className="mb-6">
              <LeadMap points={data.hits.map((h) => ({ id: h.id, name: h.name, lat: h.location.lat, lon: h.location.lon, score: h.quality.score, href: `/lead/${h.id}` }))} />
              <p className="mt-2 text-xs text-ink-400">Showing this page's {data.hits.length} results on the map.</p>
            </div>
          )}
          {data && data.hits.length > 0 && (
            <ResultsTable initial={data.hits} signedIn={!!session?.user} query={apiQuery} found={data.found} />
          )}

          {data && pages > 1 && (
            <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
              <span className="text-ink-500">Page {page} of {nf.format(Math.min(pages, 500))}</span>
              <div className="flex gap-2">
                {page > 1 && <Link className="btn-outline btn-sm" href={link({ page: String(page - 1) })}><ChevronLeft className="h-4 w-4" /> Previous</Link>}
                {page < Math.min(pages, 500) && <Link className="btn-outline btn-sm" href={link({ page: String(page + 1) })}>Next <ChevronRight className="h-4 w-4" /></Link>}
              </div>
            </nav>
          )}
        </section>
      </main>
    </>
  );
}

function Empty({ icon: Icon, title, text, children }: { icon: any; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon className="h-6 w-6" /></span>
      <h2 className="mt-5 text-xl font-bold text-ink-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-500">{text}</p>
      {children}
    </div>
  );
}
