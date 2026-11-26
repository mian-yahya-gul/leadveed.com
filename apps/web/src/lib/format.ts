const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  try { return regionNames.of(code.toUpperCase()) ?? code; } catch { return code; }
}

export function flag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export const nf = new Intl.NumberFormat("en");
export function compact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function humanize(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function gradeColor(grade: string): string {
  return grade === "A" ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : grade === "B" ? "bg-lime-50 text-lime-800 ring-lime-200"
    : grade === "C" ? "bg-amber-50 text-amber-800 ring-amber-200"
    : "bg-rose-50 text-rose-700 ring-rose-200";
}

export function speedColor(score: number | null): string {
  if (score === null) return "text-ink-400";
  return score >= 90 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600";
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://leadveed.com";
