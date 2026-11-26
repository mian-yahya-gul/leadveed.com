"use client";
import { useEffect, useId, useRef, useState } from "react";

export interface Suggestion { value: string; label?: string; country?: string; count: number }

/** Small accessible combobox that asks /api/suggest as you type. */
export function Autocomplete({
  field, value, onChange, onPick, placeholder, country, icon, className = "", inputClassName = "input",
}: {
  field: "city" | "category";
  value: string;
  onChange: (v: string) => void;
  onPick: (s: Suggestion) => void;
  placeholder: string;
  country?: string;
  icon?: React.ReactNode;
  className?: string;
  inputClassName?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({ field, q: value });
      if (country) qs.set("country", country);
      try {
        const r = await fetch(`/api/suggest?${qs}`, { signal: ctl.signal });
        const d = await r.json();
        setItems(d.items ?? []);
        setActive(0);
      } catch { /* aborted */ }
    }, 140);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [value, open, field, country]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (s: Suggestion) => { onPick(s); setOpen(false); };

  return (
    <div ref={box} className={`relative ${className}`}>
      {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">{icon}</span>}
      <input
        role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list"
        className={`${inputClassName} ${icon ? "pl-10" : ""}`} value={value} placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && items[active]) { e.preventDefault(); pick(items[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && items.length > 0 && (
        <ul id={id} role="listbox"
          className="card absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-auto p-1 text-left text-sm text-ink-800">
          {items.map((s, i) => (
            <li key={`${s.value}-${s.country ?? ""}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }} onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 ${i === active ? "bg-brand-50 text-brand-900" : ""}`}>
              <span className="truncate">{s.label ?? s.value}{s.country ? <span className="ml-1.5 text-xs text-ink-400">{s.country}</span> : null}</span>
              <span className="shrink-0 text-xs tabular-nums text-ink-400">{new Intl.NumberFormat("en", { notation: "compact" }).format(s.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
