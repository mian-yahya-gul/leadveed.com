"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Briefcase, Loader2, MapPin, RotateCcw, Search, X } from "lucide-react";
import { Autocomplete } from "./Autocomplete";
import { countryName, flag, humanize } from "@/lib/format";
import { GROUPS } from "@/lib/groups";

type Tri = "" | "true" | "false";

export function Filters({ countries }: { countries: { country: string; n: number }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [cityInput, setCityInput] = useState("");
  const [catInput, setCatInput] = useState("");
  const [quality, setQuality] = useState(Number(sp.get("min_quality") ?? 0));

  useEffect(() => { setQ(sp.get("q") ?? ""); setQuality(Number(sp.get("min_quality") ?? 0)); }, [sp]);

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") next.delete(k); else next.set(k, v); }
    next.delete("page");
    start(() => router.push(`${pathname}?${next}`, { scroll: false }));
  }

  const country = sp.get("country") ?? "";
  const city = sp.get("city") ?? "";
  const category = sp.get("category") ?? "";
  const group = sp.get("group") ?? "";
  const activeCount = [...sp.keys()].filter((k) => !["page", "sort", "view"].includes(k)).length;

  return (
    <aside className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-sm font-bold text-ink-950">Filters {pending && <Loader2 className="ml-1 inline h-3.5 w-3.5 animate-spin text-brand-500" />}</h2>
        {activeCount > 0 && (
          <button onClick={() => start(() => router.push(pathname))} className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-900">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
        <label className="label" htmlFor="kw">Keyword</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input id="kw" className="input pl-10" placeholder="Name or type of business" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q !== (sp.get("q") ?? "") && set({ q })} />
        </div>
      </form>

      <div>
        <label className="label" htmlFor="country">Country</label>
        <select id="country" className="input" value={country} onChange={(e) => set({ country: e.target.value, city: null })}>
          <option value="">All countries</option>
          {countries.map((c) => <option key={c.country} value={c.country}>{flag(c.country)} {countryName(c.country)}</option>)}
        </select>
      </div>

      <div>
        <label className="label">City</label>
        {city ? (
          <Chip onClear={() => set({ city: null })}><MapPin className="h-3.5 w-3.5" /> {city}</Chip>
        ) : (
          <Autocomplete field="city" value={cityInput} onChange={setCityInput} country={country || undefined}
            placeholder="Start typing a city" icon={<MapPin className="h-4 w-4" />}
            onPick={(s) => { setCityInput(""); set({ city: s.value, country: s.country ?? country }); }} />
        )}
      </div>

      <div>
        <label className="label">Industry</label>
        <select className="input" value={group} onChange={(e) => set({ group: e.target.value })}>
          <option value="">All industries</option>
          {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.label}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Business type</label>
        {category ? (
          <Chip onClear={() => set({ category: null })}><Briefcase className="h-3.5 w-3.5" /> {humanize(category)}</Chip>
        ) : (
          <Autocomplete field="category" value={catInput} onChange={setCatInput} country={country || undefined}
            placeholder="e.g. dental clinic, gym" icon={<Briefcase className="h-4 w-4" />}
            onPick={(s) => { setCatInput(""); set({ category: s.value }); }} />
        )}
      </div>

      <div className="space-y-4 border-t border-ink-100 pt-6">
        <Segment label="Website" value={(sp.get("has_website") ?? "") as Tri} onChange={(v) => set({ has_website: v })}
          options={[["", "Any"], ["true", "Has website"], ["false", "No website"]]} />
        <Segment label="Phone" value={(sp.get("has_phone") ?? "") as Tri} onChange={(v) => set({ has_phone: v })}
          options={[["", "Any"], ["true", "Has phone"]]} />
        <Segment label="Email" value={(sp.get("has_email") ?? "") as Tri} onChange={(v) => set({ has_email: v })}
          options={[["", "Any"], ["true", "Has email"]]} />
        <Segment label="Social profiles" value={(sp.get("has_socials") ?? "") as Tri} onChange={(v) => set({ has_socials: v })}
          options={[["", "Any"], ["true", "Has"], ["false", "None"]]} />
      </div>

      <div className="space-y-4 border-t border-ink-100 pt-6">
        <div>
          <div className="flex items-center justify-between">
            <span className="label mb-0">Minimum quality</span>
            <span className="text-xs font-bold tabular-nums text-brand-700">{quality > 0 ? `${quality}+` : "Any"}</span>
          </div>
          <input type="range" min={0} max={95} step={5} value={quality} aria-label="Minimum quality score"
            onChange={(e) => setQuality(Number(e.target.value))}
            onMouseUp={() => set({ min_quality: quality ? String(quality) : null })}
            onTouchEnd={() => set({ min_quality: quality ? String(quality) : null })}
            onKeyUp={() => set({ min_quality: quality ? String(quality) : null })}
            className="mt-3 w-full accent-brand-600" />
        </div>
        <Toggle label="Slow website (PageSpeed under 50)" checked={sp.get("pagespeed_max") === "49"}
          onChange={(on) => set({ pagespeed_max: on ? "49" : null, has_website: on ? "true" : sp.get("has_website") })} />
        <Toggle label="New in the last 45 days" checked={!!sp.get("new_days")}
          onChange={(on) => set({ new_days: on ? "45" : null })} />
      </div>
    </aside>
  );
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 py-2 pl-3 pr-2 text-sm font-medium text-brand-800">
      <span className="flex min-w-0 items-center gap-1.5 truncate">{children}</span>
      <button onClick={onClear} aria-label="Clear" className="rounded-md p-0.5 hover:bg-brand-100"><X className="h-3.5 w-3.5" /></button>
    </span>
  );
}

function Segment({ label, value, options, onChange }: { label: string; value: Tri; options: [Tri, string][]; onChange: (v: Tri) => void }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="grid rounded-xl bg-ink-100/70 p-1 text-xs font-semibold" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
            className={`rounded-lg px-2 py-1.5 transition ${value === v ? "bg-white text-ink-950 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ink-700">
      {label}
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? "bg-brand-600" : "bg-ink-200"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-1"}`} />
      </button>
    </label>
  );
}
