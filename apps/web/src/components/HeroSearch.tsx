"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, Search, Briefcase } from "lucide-react";
import { Autocomplete } from "./Autocomplete";

const QUICK = [
  { label: "Dental clinics in Lahore", qs: "category=dental_clinic&city=Lahore&country=PK" },
  { label: "Restaurants with no website in Dubai", qs: "group=food_and_drink&city=Dubai&country=AE&has_website=false" },
  { label: "Real estate agents in Dubai", qs: "category=real_estate_agent&city=Dubai&country=AE" },
  { label: "Gyms in Austin", qs: "category=gym&city=Austin&country=US" },
];

export function HeroSearch() {
  const router = useRouter();
  const [what, setWhat] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [where, setWhere] = useState("");
  const [city, setCity] = useState<{ city: string; country?: string } | null>(null);
  const [noSite, setNoSite] = useState(false);

  function go(e?: React.FormEvent) {
    e?.preventDefault();
    const qs = new URLSearchParams();
    if (category) qs.set("category", category); else if (what.trim()) qs.set("q", what.trim());
    if (city) { qs.set("city", city.city); if (city.country) qs.set("country", city.country); }
    else if (where.trim()) qs.set("city", where.trim());
    if (noSite) qs.set("has_website", "false");
    router.push(`/search?${qs}`);
  }

  return (
    <div className="w-full">
      <form onSubmit={go}
        className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_20px_60px_-15px_rgba(90,63,242,0.55)] ring-1 ring-white/10 md:flex-row md:items-center">
        <Autocomplete field="category" value={what} placeholder="Business type, e.g. dentist, gym, cafe"
          onChange={(v) => { setWhat(v); setCategory(null); }}
          onPick={(s) => { setWhat(s.label ?? s.value); setCategory(s.value); }}
          icon={<Briefcase className="h-4 w-4" />} className="flex-1"
          inputClassName="w-full rounded-xl border-0 bg-transparent px-3.5 py-3.5 text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0" />
        <div className="hidden h-8 w-px bg-ink-100 md:block" />
        <Autocomplete field="city" value={where} placeholder="City, e.g. Karachi, Dubai, Riyadh"
          onChange={(v) => { setWhere(v); setCity(null); }}
          onPick={(s) => { setWhere(s.value); setCity({ city: s.value, country: s.country }); }}
          icon={<MapPin className="h-4 w-4" />} className="flex-1"
          inputClassName="w-full rounded-xl border-0 bg-transparent px-3.5 py-3.5 text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0" />
        <button className="btn-primary h-12 px-6 text-[15px]" type="submit">
          <Search className="h-4 w-4" /> Find leads
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-ink-200">
          <input type="checkbox" checked={noSite} onChange={(e) => setNoSite(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/10 accent-signal-400" />
          Only businesses <b className="font-semibold text-signal-300">without a website</b>
        </label>
        <span className="hidden text-ink-500 sm:inline">·</span>
        <span className="text-ink-400">Try:</span>
        {QUICK.map((q) => (
          <button key={q.label} type="button" onClick={() => router.push(`/search?${q.qs}`)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-ink-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white">
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}
