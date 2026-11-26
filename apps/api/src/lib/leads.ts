import { pool } from "./db.js";

export interface LeadRow {
  id: string;
  name: string;
  category: string | null;
  category_label: string | null;
  category_group: string | null;
  brand: string | null;
  street: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string | null;
  lat: number;
  lon: number;
  phones: string[];
  websites: string[];
  emails: string[];
  socials: string[];
  domain: string | null;
  opening_hours: string | null;
  operating_status: string | null;
  sources: Array<{ dataset: string; [k: string]: unknown }>;
  source_count: number;
  quality_score: number;
  quality: Record<string, number>;
  pagespeed_mobile: number | null;
  pagespeed_desktop: number | null;
  pagespeed_metrics: Record<string, unknown> | null;
  pagespeed_checked_at: string | null;
  first_seen: string;
  last_seen: string;
  release: string | null;
}

export interface Lead {
  id: string;
  name: string;
  category: string | null;
  categoryLabel: string | null;
  categoryGroup: string | null;
  brand: string | null;
  address: { street: string | null; city: string | null; region: string | null; postcode: string | null; country: string | null };
  location: { lat: number; lon: number };
  phones: string[];
  websites: string[];
  emails: string[];
  socials: string[];
  domain: string | null;
  openingHours: string | null;
  operatingStatus: string | null;
  signals: { hasPhone: boolean; hasWebsite: boolean; hasEmail: boolean; hasSocials: boolean };
  sources: string[];
  sourceCount: number;
  quality: { score: number; grade: "A" | "B" | "C" | "D"; breakdown: Record<string, number> };
  pagespeed: { mobile: number | null; desktop: number | null; metrics: Record<string, unknown> | null; checkedAt: string | null };
  firstSeen: string;
  lastSeen: string;
  unlocked: boolean;
}

export function grade(score: number): "A" | "B" | "C" | "D" {
  return score >= 75 ? "A" : score >= 55 ? "B" : score >= 35 ? "C" : "D";
}

/** "+92 300 1234567" -> "+92 300 ••• ••67". Keeps enough to recognise the shape. */
export function maskPhone(p: string): string {
  let seen = 0;
  const digits = p.replace(/\D/g, "").length;
  return p.replace(/\d/g, (d) => {
    seen++;
    return seen <= Math.min(5, Math.max(2, digits - 6)) || seen > digits - 2 ? d : "•";
  });
}

export function maskEmail(e: string): string {
  const [user, host = ""] = e.split("@");
  const tld = host.includes(".") ? host.slice(host.lastIndexOf(".")) : "";
  return `${user.slice(0, 1)}•••@•••${tld}`;
}

export function maskUrl(u: string): string {
  const m = u.match(/^(?:https?:\/\/)?(?:www\.)?([^/?#]+)/i);
  const host = m?.[1] ?? u;
  const tld = host.includes(".") ? host.slice(host.lastIndexOf(".")) : "";
  return `•••••••${tld}`;
}

export function toLead(r: LeadRow, unlocked: boolean): Lead {
  const lead: Lead = {
    id: r.id,
    name: r.name,
    category: r.category,
    categoryLabel: r.category_label,
    categoryGroup: r.category_group,
    brand: r.brand,
    address: { street: r.street, city: r.city, region: r.region, postcode: r.postcode, country: r.country },
    location: { lat: r.lat, lon: r.lon },
    phones: r.phones ?? [],
    websites: r.websites ?? [],
    emails: r.emails ?? [],
    socials: r.socials ?? [],
    domain: r.domain,
    openingHours: r.opening_hours,
    operatingStatus: r.operating_status,
    signals: {
      hasPhone: (r.phones ?? []).length > 0,
      hasWebsite: (r.websites ?? []).length > 0,
      hasEmail: (r.emails ?? []).length > 0,
      hasSocials: (r.socials ?? []).length > 0,
    },
    sources: [...new Set((r.sources ?? []).map((s) => s.dataset))],
    sourceCount: r.source_count,
    quality: { score: r.quality_score, grade: grade(r.quality_score), breakdown: r.quality ?? {} },
    pagespeed: {
      mobile: r.pagespeed_mobile, desktop: r.pagespeed_desktop,
      metrics: r.pagespeed_metrics, checkedAt: r.pagespeed_checked_at,
    },
    firstSeen: String(r.first_seen).slice(0, 10),
    lastSeen: String(r.last_seen).slice(0, 10),
    unlocked,
  };
  return unlocked ? lead : mask(lead);
}

export function mask(l: Lead): Lead {
  return {
    ...l,
    phones: l.phones.map(maskPhone),
    emails: l.emails.map(maskEmail),
    websites: l.websites.map(maskUrl),
    socials: l.socials.map(() => "•••"),
    domain: l.domain ? maskUrl(l.domain) : null,
    unlocked: false,
  };
}

const LEAD_COLS = `id, name, category, category_label, category_group, brand, street, city, region, postcode, country,
  lat, lon, phones, websites, emails, socials, domain, opening_hours, operating_status, sources, source_count,
  quality_score, quality, pagespeed_mobile, pagespeed_desktop, pagespeed_metrics, pagespeed_checked_at,
  first_seen, last_seen, release`;

export async function getRows(ids: string[]): Promise<LeadRow[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool.query<LeadRow>(`SELECT ${LEAD_COLS} FROM places WHERE id = ANY($1)`, [ids]);
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function unlockedSet(userId: string | null, ids: string[]): Promise<Set<string>> {
  if (!userId || ids.length === 0) return new Set();
  const { rows } = await pool.query<{ place_id: string }>(
    "SELECT place_id FROM unlocks WHERE user_id = $1 AND place_id = ANY($2)", [userId, ids]);
  return new Set(rows.map((r) => r.place_id));
}

export async function similar(row: LeadRow, limit = 6): Promise<LeadRow[]> {
  const { rows } = await pool.query<LeadRow>(
    `SELECT ${LEAD_COLS} FROM places
     WHERE id <> $1 AND category IS NOT DISTINCT FROM $2
       AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, 5000)
     ORDER BY quality_score DESC LIMIT $5`,
    [row.id, row.category, row.lat, row.lon, limit]);
  return rows;
}

export const CSV_HEADER = [
  "leadveed_id", "name", "category", "brand", "phone", "phone_2", "website", "email", "street", "city", "region",
  "postcode", "country", "latitude", "longitude", "quality_score", "quality_grade", "pagespeed_mobile",
  "facebook_or_social", "opening_hours", "sources", "first_seen", "lead_url",
];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Guard against spreadsheet formula injection from third-party data.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d[\d\s().-]*$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvRow(r: LeadRow, siteUrl: string): string {
  return [
    r.id, r.name, r.category_label, r.brand, r.phones?.[0], r.phones?.[1], r.websites?.[0], r.emails?.[0],
    r.street, r.city, r.region, r.postcode, r.country, r.lat, r.lon, r.quality_score, grade(r.quality_score),
    r.pagespeed_mobile, r.socials?.[0], r.opening_hours,
    [...new Set((r.sources ?? []).map((s) => s.dataset))].join("+"), String(r.first_seen).slice(0, 10),
    `${siteUrl}/lead/${r.id}`,
  ].map(csvCell).join(",");
}
