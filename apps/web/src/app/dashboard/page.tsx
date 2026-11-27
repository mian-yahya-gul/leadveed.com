import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Coins, Download, FolderOpen, Sparkles, Unlock } from "lucide-react";
import { auth } from "@/auth";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { QualityBadge } from "@/components/LeadBits";
import { api, getMe, safe } from "@/lib/api";
import { flag, nf } from "@/lib/format";
import type { Lead } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

const REASONS: Record<string, string> = {
  signup: "Welcome credits", unlock: "Unlocked leads", export: "CSV export", plan_refill: "Monthly credits",
  plan_start: "Plan started", plan_upgrade: "Plan upgrade", refund: "Refund", admin: "Adjustment",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  if (!(await auth())?.user) redirect("/login?next=/dashboard");
  const sp = await searchParams;
  const [me, lists, unlocked, searches] = await Promise.all([
    getMe(),
    safe(api<{ lists: { id: number; name: string; size: number; created_at: string }[] }>("/v1/me/lists")),
    safe(api<{ leads: Lead[] }>("/v1/me/unlocked")),
    safe(api<{ searches: { id: number; name: string; query: Record<string, string> }[] }>("/v1/me/searches")),
  ]);
  if (!me) {
    return (<><Header /><main className="mx-auto max-w-3xl flex-1 px-4 py-20 text-center text-ink-500">We couldn't load your account. Please refresh in a moment.</main></>);
  }
  const pct = Math.min(100, (me.user.credits / Math.max(me.plan.credits, 1)) * 100);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        {sp.upgraded && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-signal-300/50 px-5 py-4 text-sm font-medium text-ink-900">
            <Sparkles className="h-5 w-5" /> Thanks for upgrading! Your new credits appear here as soon as the payment confirms.
          </div>
        )}
        <h1 className="text-3xl font-extrabold text-ink-950">{me.user.name ? `Hi, ${me.user.name.split(" ")[0]}` : "Welcome back"}</h1>
        <p className="mt-1 text-ink-500">{me.user.email}</p>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="card relative overflow-hidden p-6 md:col-span-1">
            <div className="flex items-center justify-between text-sm text-ink-500"><span className="flex items-center gap-2"><Coins className="h-4 w-4" /> Credits</span><span className="chip">{me.plan.name} plan</span></div>
            <div className="mt-3 font-display text-5xl font-extrabold text-ink-950">{nf.format(me.user.credits)}</div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${pct}%` }} /></div>
            <p className="mt-2 text-xs text-ink-500">{me.plan.id === "free" ? "One-time welcome credits" : `${nf.format(me.plan.credits)} added each month`}</p>
            <div className="mt-5 flex gap-2">
              <Link href="/pricing" className="btn-primary btn-sm">{me.plan.id === "free" ? "Upgrade" : "Change plan"}</Link>
              {me.plan.id !== "free" && process.env.PADDLE_CUSTOMER_PORTAL && <a href={process.env.PADDLE_CUSTOMER_PORTAL} className="btn-outline btn-sm">Billing</a>}
            </div>
          </div>
          <Kpi icon={Unlock} label="Leads unlocked" value={me.counts.unlocked} />
          <Kpi icon={FolderOpen} label="Lists" value={me.counts.lists} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <h2 className="font-sans font-bold text-ink-950">Recently unlocked</h2>
              <Link href="/search" className="text-sm font-semibold text-brand-700">Find more <ArrowRight className="inline h-3.5 w-3.5" /></Link>
            </div>
            {unlocked?.leads.length ? (
              <ul className="divide-y divide-ink-100">
                {unlocked.leads.slice(0, 12).map((l) => (
                  <li key={l.id}>
                    <Link href={`/lead/${l.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-3 hover:bg-ink-50 sm:grid-cols-[1.4fr_1fr_auto]">
                      <span className="min-w-0"><span className="block truncate font-semibold text-ink-900">{l.name}</span><span className="block truncate text-xs text-ink-500">{l.categoryLabel} · {flag(l.address.country)} {l.address.city}</span></span>
                      <span className="hidden truncate font-mono text-sm text-ink-600 sm:block">{l.phones[0] ?? l.websites[0] ?? "—"}</span>
                      <QualityBadge score={l.quality.score} grade={l.quality.grade} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="px-6 py-12 text-center text-sm text-ink-500">Nothing yet. <Link href="/search" className="font-semibold text-brand-700">Run your first search</Link>.</p>}
          </section>

          <div className="space-y-6">
            <section className="card p-6" id="lists">
              <h2 className="font-sans font-bold text-ink-950">Lists</h2>
              {lists?.lists.length ? (
                <ul className="mt-4 space-y-2">
                  {lists.lists.map((l) => (
                    <li key={l.id}><Link href={`/dashboard/lists/${l.id}`} className="flex items-center justify-between rounded-xl border border-ink-100 px-4 py-3 text-sm hover:border-brand-200 hover:bg-brand-50/40"><span className="font-medium text-ink-900">{l.name}</span><span className="text-ink-400">{l.size}</span></Link></li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-ink-500">Select leads in search results and choose “Add to list”.</p>}
            </section>
            {searches?.searches.length ? (
              <section className="card p-6">
                <h2 className="font-sans font-bold text-ink-950">Saved searches</h2>
                <ul className="mt-4 space-y-2 text-sm">
                  {searches.searches.map((s) => <li key={s.id}><Link className="font-medium text-brand-700 hover:underline" href={`/search?${new URLSearchParams(s.query)}`}>{s.name}</Link></li>)}
                </ul>
              </section>
            ) : null}
            <section className="card p-6">
              <h2 className="font-sans font-bold text-ink-950">Credit history</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                {me.ledger.slice(0, 8).map((e, i) => (
                  <li key={i} className="flex justify-between"><span className="text-ink-600">{REASONS[e.reason] ?? e.reason} <span className="text-xs text-ink-400">· {new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></span>
                    <span className={`font-semibold tabular-nums ${e.delta > 0 ? "text-emerald-600" : "text-ink-700"}`}>{e.delta > 0 ? "+" : ""}{nf.format(e.delta)}</span></li>
                ))}
              </ul>
            </section>
            {me.exports.length > 0 && (
              <section className="card p-6">
                <h2 className="flex items-center gap-2 font-sans font-bold text-ink-950"><Download className="h-4 w-4" /> Exports</h2>
                <ul className="mt-4 space-y-2 text-sm text-ink-600">
                  {me.exports.slice(0, 6).map((x) => <li key={x.id} className="flex justify-between"><span>{nf.format(x.rows)} rows</span><span className="text-xs text-ink-400">{new Date(x.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span></li>)}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="card p-6">
      <span className="flex items-center gap-2 text-sm text-ink-500"><Icon className="h-4 w-4" /> {label}</span>
      <div className="mt-3 font-display text-5xl font-extrabold text-ink-950">{nf.format(value)}</div>
    </div>
  );
}
