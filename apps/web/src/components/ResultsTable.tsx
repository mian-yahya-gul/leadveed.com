"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, ExternalLink, FolderPlus, Loader2, Lock, Unlock, X } from "lucide-react";
import { NoWebsiteTag, QualityBadge, Signals, SpeedPill } from "./LeadBits";
import { flag, nf } from "@/lib/format";
import type { Lead } from "@/lib/types";

interface Props {
  initial: Lead[];
  signedIn: boolean;
  query: Record<string, string>;
  found: number;
}

export function ResultsTable({ initial, signedIn, query, found }: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string; action?: { label: string; href: string } } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => { setLeads(initial); setSel(new Set()); }, [initial]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const allSelected = leads.length > 0 && leads.every((l) => sel.has(l.id));
  const lockedSelected = useMemo(() => leads.filter((l) => sel.has(l.id) && !l.unlocked).length, [leads, sel]);

  function needLogin() {
    router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }

  async function unlock(ids: string[]) {
    if (!signedIn) return needLogin();
    setBusy(ids.length === 1 ? ids[0] : "bulk");
    try {
      const r = await fetch("/api/unlock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) });
      const d = await r.json();
      if (r.status === 402) {
        setToast({ kind: "err", text: `You need ${d.needed} credits and have ${d.balance}.`, action: { label: "Get more credits", href: "/pricing" } });
        return;
      }
      if (!r.ok) throw new Error(d.error ?? "failed");
      const map = new Map<string, Lead>(d.leads.map((l: Lead) => [l.id, l]));
      setLeads((ls) => ls.map((l) => map.get(l.id) ?? l));
      setToast({ kind: "ok", text: d.charged ? `Unlocked ${d.charged} lead${d.charged > 1 ? "s" : ""}. ${nf.format(d.balance)} credits left.` : "Already unlocked, no credits used." });
      router.refresh();
    } catch {
      setToast({ kind: "err", text: "Something went wrong. Please try again." });
    } finally { setBusy(null); }
  }

  function addToList() {
    if (!signedIn) return needLogin();
    setListOpen(true);
  }

  return (
    <div className="relative">
      {/* bulk bar */}
      <div className={`sticky top-16 z-20 -mx-px mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${sel.size ? "border-brand-200 bg-brand-50/95 backdrop-blur" : "border-transparent"}`}>
        <label className="inline-flex cursor-pointer items-center gap-2 pl-1 font-medium text-ink-700">
          <input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={allSelected}
            onChange={() => setSel(allSelected ? new Set() : new Set(leads.map((l) => l.id)))} />
          {sel.size ? `${sel.size} selected` : "Select page"}
        </label>
        {sel.size > 0 && (
          <>
            <button className="btn-primary btn-sm" disabled={busy === "bulk"} onClick={() => unlock([...sel])}>
              {busy === "bulk" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
              Unlock {lockedSelected ? `(${lockedSelected} credit${lockedSelected > 1 ? "s" : ""})` : ""}
            </button>
            <button className="btn-outline btn-sm" onClick={addToList}><FolderPlus className="h-3.5 w-3.5" /> Add to list</button>
            <button className="btn-ghost btn-sm" onClick={() => setSel(new Set())}>Clear</button>
          </>
        )}
        <button className="btn-outline btn-sm ml-auto" onClick={() => (signedIn ? setExportOpen(true) : needLogin())}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="px-2 py-3">Business</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Website</th>
                <th className="px-3 py-3">Signals</th>
                <th className="px-3 py-3">Quality</th>
                <th className="px-3 py-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {leads.map((l) => (
                <tr key={l.id} className={`group transition ${sel.has(l.id) ? "bg-brand-50/50" : "hover:bg-ink-50/60"}`}>
                  <td className="px-4 py-3.5 align-top">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-brand-600" aria-label={`Select ${l.name}`} checked={sel.has(l.id)}
                      onChange={() => setSel((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} />
                  </td>
                  <td className="max-w-[230px] px-2 py-3.5 align-top">
                    <Link href={`/lead/${l.id}`} className="block truncate font-semibold text-ink-950 hover:text-brand-700">{l.name}</Link>
                    <div className="mt-0.5 truncate text-xs text-ink-500">{l.categoryLabel ?? "Business"}{l.brand && l.brand !== l.name ? ` · ${l.brand}` : ""}</div>
                  </td>
                  <td className="max-w-[170px] px-3 py-3.5 align-top">
                    <div className="truncate text-ink-800">{flag(l.address.country)} {l.address.city ?? "—"}</div>
                    <div className="truncate text-xs text-ink-400">{l.address.street ?? ""}</div>
                  </td>
                  <td className="px-3 py-3.5 align-top font-mono text-[13px]">
                    {l.phones[0] ? (
                      l.unlocked ? <a href={`tel:${l.phones[0].replace(/[^\d+]/g, "")}`} className="text-ink-900 hover:text-brand-700">{l.phones[0]}</a>
                        : <span className="text-ink-500">{l.phones[0]}</span>
                    ) : <span className="text-ink-300">—</span>}
                  </td>
                  <td className="max-w-[160px] px-3 py-3.5 align-top">
                    {l.websites[0] ? (
                      <div className="flex items-center gap-2">
                        {l.unlocked
                          ? <a href={l.websites[0].startsWith("http") ? l.websites[0] : `https://${l.websites[0]}`} target="_blank" rel="noreferrer nofollow"
                              className="inline-flex min-w-0 items-center gap-1 truncate text-brand-700 hover:underline">
                              <span className="truncate">{(l.domain ?? l.websites[0]).replace(/^https?:\/\/(www\.)?/, "")}</span><ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          : <span className="truncate text-ink-500">{l.websites[0]}</span>}
                        <SpeedPill score={l.pagespeed.mobile} />
                      </div>
                    ) : <NoWebsiteTag />}
                  </td>
                  <td className="px-3 py-3.5 align-top"><Signals lead={l} /></td>
                  <td className="px-3 py-3.5 align-top"><QualityBadge score={l.quality.score} grade={l.quality.grade} /></td>
                  <td className="px-3 py-3.5 text-right align-top">
                    {l.unlocked ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><Check className="h-3.5 w-3.5" /> Unlocked</span>
                    ) : (
                      <button onClick={() => unlock([l.id])} disabled={busy === l.id}
                        className="btn-outline btn-sm border-brand-200 text-brand-700 hover:border-brand-400 hover:bg-brand-50">
                        {busy === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Unlock
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {exportOpen && <ExportDialog query={query} found={found}
        selected={sel.size ? [...sel] : Object.keys(query).length ? [] : leads.map((l) => l.id)}
        allowQuery={Object.keys(query).length > 0} onClose={() => setExportOpen(false)} onDone={(t) => { setToast(t); router.refresh(); }} />}

      {listOpen && <ListDialog ids={[...sel]} onClose={() => setListOpen(false)} onDone={setToast} />}

      {toast && (
        <div role="status" className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 animate-fade-up items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-pop ${toast.kind === "ok" ? "bg-ink-950 text-white" : "bg-rose-600 text-white"}`}>
          {toast.text}
          {toast.action && <Link href={toast.action.href} className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold hover:bg-white/25">{toast.action.label}</Link>}
          <button onClick={() => setToast(null)} aria-label="Dismiss"><X className="h-4 w-4 opacity-70" /></button>
        </div>
      )}
    </div>
  );
}

function ExportDialog({ query, found, selected, allowQuery, onClose, onDone }: {
  query: Record<string, string>; found: number; selected: string[]; allowQuery: boolean;
  onClose: () => void; onDone: (t: { kind: "ok" | "err"; text: string; action?: { label: string; href: string } }) => void;
}) {
  const [mode, setMode] = useState<"selected" | "query">(selected.length ? "selected" : "query");
  const [limit, setLimit] = useState(Math.min(found, 100));
  const [preview, setPreview] = useState<{ rows: number; alreadyUnlocked: number; cost: number; balance: number; cap: number } | null>(null);
  const [working, setWorking] = useState(false);

  const body = useMemo(() => (mode === "selected" ? { ids: selected } : { query, limit }), [mode, selected, query, limit]);

  useEffect(() => {
    const ctl = new AbortController();
    setPreview(null);
    const t = setTimeout(() => {
      fetch("/api/export", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, preview: true }) })
        .then((r) => r.json()).then(setPreview).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [body]);

  async function run() {
    setWorking(true);
    try {
      const partial = preview ? preview.cost > preview.balance : false;
      const r = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, partial }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        onDone({ kind: "err", text: d.error === "not_enough_credits" ? "Not enough credits for this export." : "Export failed.", action: { label: "Get credits", href: "/pricing" } });
        return onClose();
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? "leadveed.csv";
      a.click();
      URL.revokeObjectURL(url);
      onDone({ kind: "ok", text: `Downloaded. ${r.headers.get("x-credits-charged") ?? 0} credits used, ${r.headers.get("x-credits-balance") ?? "?"} left.` });
      onClose();
    } finally { setWorking(false); }
  }

  const short = preview && preview.cost > preview.balance;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md animate-fade-up p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="exp-title">
        <div className="flex items-start justify-between">
          <h3 id="exp-title" className="text-lg font-bold text-ink-950">Export to CSV</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-ink-400 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 space-y-3">
          {selected.length > 0 && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-200 p-3 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50/50">
              <input type="radio" name="m" checked={mode === "selected"} onChange={() => setMode("selected")} className="accent-brand-600" />
              <span className="text-sm"><b>{selected.length} selected</b> leads</span>
            </label>
          )}
          {allowQuery && <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-200 p-3 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50/50">
            <input type="radio" name="m" checked={mode === "query"} onChange={() => setMode("query")} className="accent-brand-600" />
            <span className="flex flex-1 items-center gap-2 text-sm">
              Top
              <input type="number" min={1} max={Math.min(found, 15000)} value={limit} disabled={mode !== "query"}
                onChange={(e) => setLimit(Math.max(1, Math.min(Number(e.target.value) || 1, found, 15000)))}
                className="input w-24 py-1.5" />
              of {nf.format(found)} results
            </span>
          </label>}
        </div>
        <div className="mt-5 rounded-xl bg-ink-50 p-4 text-sm">
          {preview ? (
            <dl className="space-y-1.5">
              <Row k="Rows" v={nf.format(preview.rows)} />
              <Row k="Already unlocked (free)" v={nf.format(preview.alreadyUnlocked)} />
              <Row k="Credits needed" v={<b className="text-ink-950">{nf.format(preview.cost)}</b>} />
              <Row k="Your balance" v={nf.format(preview.balance)} />
              {preview.rows >= preview.cap && <p className="pt-1 text-xs text-ink-500">Your plan exports up to {nf.format(preview.cap)} rows at a time.</p>}
              {short && <p className="pt-1 text-xs font-medium text-amber-700">You'll get the first {nf.format(preview.balance + preview.alreadyUnlocked)} rows. <Link className="underline" href="/pricing">Top up</Link> for the rest.</p>}
            </dl>
          ) : <div className="flex items-center gap-2 text-ink-500"><Loader2 className="h-4 w-4 animate-spin" /> Working out the cost…</div>}
        </div>
        <button className="btn-primary mt-5 w-full py-3" disabled={!preview || working || (preview.balance === 0 && preview.alreadyUnlocked === 0)} onClick={run}>
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download CSV
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between"><dt className="text-ink-500">{k}</dt><dd className="tabular-nums">{v}</dd></div>;
}

function ListDialog({ ids, onClose, onDone }: {
  ids: string[]; onClose: () => void;
  onDone: (t: { kind: "ok" | "err"; text: string; action?: { label: string; href: string } }) => void;
}) {
  const [lists, setLists] = useState<{ id: number; name: string; size: number }[] | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetch("/api/lists").then((r) => r.json()).then((d) => setLists(d.lists ?? [])).catch(() => setLists([])); }, []);

  async function save(list?: { id: number; name: string }) {
    setSaving(true);
    try {
      let target = list;
      if (!target) {
        const r = await fetch("/api/lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
        target = (await r.json()).list;
      }
      await fetch(`/api/lists/${target!.id}/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) });
      onDone({ kind: "ok", text: `Added ${ids.length} lead${ids.length > 1 ? "s" : ""} to “${target!.name}”.`, action: { label: "Open list", href: `/dashboard/lists/${target!.id}` } });
      onClose();
    } catch {
      onDone({ kind: "err", text: "Couldn't save to the list." });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-sm animate-fade-up p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className="text-lg font-bold text-ink-950">Add {ids.length} to a list</h3>
        <div className="mt-4 max-h-60 space-y-1.5 overflow-auto">
          {lists === null && <div className="skeleton h-10" />}
          {lists?.map((l) => (
            <button key={l.id} disabled={saving} onClick={() => save(l)}
              className="flex w-full items-center justify-between rounded-xl border border-ink-200 px-3 py-2.5 text-left text-sm hover:border-brand-300 hover:bg-brand-50/50">
              <span className="font-medium text-ink-900">{l.name}</span><span className="text-xs text-ink-400">{l.size} leads</span>
            </button>
          ))}
        </div>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save(); }}>
          <input className="input" placeholder="New list name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <button className="btn-primary" disabled={!name.trim() || saving}>Create</button>
        </form>
      </div>
    </div>
  );
}
