import { z } from "zod";
import { config } from "../config.js";
import { pool } from "./db.js";

const bool = z.enum(["true", "false", "1", "0", "yes", "no", "any"]).optional()
  .transform((v) => (v === undefined || v === "any" ? undefined : ["true", "1", "yes"].includes(v)));
const csv = z.string().optional().transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));

export const SearchQuery = z.object({
  q: z.string().max(120).optional().default(""),
  country: csv,                       // ISO alpha-2, comma separated
  city: csv,
  category: csv,                      // category keys, e.g. dentist,orthodontist
  group: csv,                         // top-level groups, e.g. health_care
  has_website: bool,
  has_phone: bool,
  has_email: bool,
  has_socials: bool,
  min_quality: z.coerce.number().int().min(0).max(100).optional(),
  pagespeed_max: z.coerce.number().int().min(0).max(100).optional(),   // "slow websites" filter
  new_days: z.coerce.number().int().min(1).max(3650).optional(),       // first seen in the last N days
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  radius_km: z.coerce.number().min(0.1).max(500).optional(),
  sort: z.enum(["relevance", "quality", "newest", "name", "distance"]).optional().default("relevance"),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(25),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export interface Facet { value: string; count: number }
export interface SearchResult {
  found: number;
  page: number;
  perPage: number;
  ids: string[];
  facets: Record<string, Facet[]>;
  tookMs: number;
  backend: "typesense" | "postgres";
}

// ---------------------------------------------------------------------------
// Typesense
// ---------------------------------------------------------------------------
const tsEscape = (v: string) => "`" + v.replace(/`/g, "") + "`";

export function typesenseParams(q: SearchQuery): Record<string, string> {
  const f: string[] = [];
  if (q.country.length) f.push(`country:[${q.country.map((c) => tsEscape(c.toUpperCase())).join(",")}]`);
  if (q.city.length) f.push(`city:[${q.city.map(tsEscape).join(",")}]`);
  // a category matches itself and everything under it (dental_clinic also finds general_dentistry)
  if (q.category.length) f.push(`categories:[${q.category.map(tsEscape).join(",")}]`);
  if (q.group.length) f.push(`category_group:[${q.group.map(tsEscape).join(",")}]`);
  for (const k of ["has_website", "has_phone", "has_email", "has_socials"] as const) {
    if (q[k] !== undefined) f.push(`${k}:${q[k]}`);
  }
  if (q.min_quality !== undefined) f.push(`quality_score:>=${q.min_quality}`);
  if (q.pagespeed_max !== undefined) f.push(`pagespeed:<=${q.pagespeed_max}`);
  if (q.new_days !== undefined) f.push(`first_seen:>=${Math.floor(Date.now() / 1000) - q.new_days * 86400}`);
  const geo = q.lat !== undefined && q.lon !== undefined;
  if (geo && q.radius_km) f.push(`location:(${q.lat}, ${q.lon}, ${q.radius_km} km)`);

  const sort =
    q.sort === "quality" ? "quality_score:desc" :
    q.sort === "newest" ? "first_seen:desc,quality_score:desc" :
    q.sort === "distance" && geo ? `location(${q.lat}, ${q.lon}):asc` :
    q.q ? "_text_match:desc,quality_score:desc" : "quality_score:desc";

  return {
    q: q.q || "*",
    query_by: "name,category_label,brand,city",
    query_by_weights: "4,3,2,1",
    filter_by: f.join(" && "),
    sort_by: sort,
    facet_by: "country,city,category_label,category,category_group,has_website,has_phone,has_email",
    max_facet_values: "12",
    page: String(q.page),
    per_page: String(q.per_page),
    include_fields: "id",
    num_typos: "1",
    prefix: "true",
    exhaustive_search: "false",
    search_cutoff_ms: "800",
  };
}

async function typesenseSearch(q: SearchQuery): Promise<SearchResult> {
  const t0 = Date.now();
  const url = `${config.typesenseUrl}/collections/places/documents/search?${new URLSearchParams(typesenseParams(q))}`;
  const r = await fetch(url, { headers: { "X-TYPESENSE-API-KEY": config.typesenseKey } });
  if (!r.ok) throw new Error(`Typesense ${r.status}: ${await r.text()}`);
  const d = (await r.json()) as {
    found: number;
    hits: Array<{ document: { id: string } }>;
    facet_counts: Array<{ field_name: string; counts: Array<{ value: string; count: number }> }>;
  };
  const facets: Record<string, Facet[]> = {};
  for (const fc of d.facet_counts ?? []) facets[fc.field_name] = fc.counts.map((c) => ({ value: c.value, count: c.count }));
  return { found: d.found, page: q.page, perPage: q.per_page, ids: d.hits.map((h) => h.document.id), facets,
    tookMs: Date.now() - t0, backend: "typesense" };
}

// ---------------------------------------------------------------------------
// Postgres fallback (used when Typesense is not configured, e.g. small installs and tests)
// ---------------------------------------------------------------------------
export function postgresWhere(q: SearchQuery): { where: string; params: unknown[] } {
  const w: string[] = [];
  const p: unknown[] = [];
  const add = (sql: string, v: unknown) => { p.push(v); w.push(sql.replace("?", `$${p.length}`)); };
  // q is always $1 when present; the ORDER BY for relevance relies on that.
  if (q.q) { p.push(q.q); w.push("(name_norm % lower($1) OR name ILIKE '%' || $1 || '%')"); }
  if (q.country.length) add("country = ANY(?)", q.country.map((c) => c.toUpperCase()));
  if (q.city.length) add("lower(city) = ANY(?)", q.city.map((c) => c.toLowerCase()));
  if (q.category.length) add("categories && ?::text[]", q.category);
  if (q.group.length) add("category_group = ANY(?)", q.group);
  if (q.has_website !== undefined) w.push(q.has_website ? "cardinality(websites) > 0" : "cardinality(websites) = 0");
  if (q.has_phone !== undefined) w.push(q.has_phone ? "cardinality(phones) > 0" : "cardinality(phones) = 0");
  if (q.has_email !== undefined) w.push(q.has_email ? "cardinality(emails) > 0" : "cardinality(emails) = 0");
  if (q.has_socials !== undefined) w.push(q.has_socials ? "cardinality(socials) > 0" : "cardinality(socials) = 0");
  if (q.min_quality !== undefined) add("quality_score >= ?", q.min_quality);
  if (q.pagespeed_max !== undefined) add("pagespeed_mobile <= ?", q.pagespeed_max);
  if (q.new_days !== undefined) add("first_seen >= current_date - ?::int", q.new_days);
  if (q.lat !== undefined && q.lon !== undefined && q.radius_km) {
    p.push(q.lon, q.lat, q.radius_km * 1000);
    w.push(`ST_DWithin(geom, ST_SetSRID(ST_MakePoint($${p.length - 2}, $${p.length - 1}), 4326)::geography, $${p.length})`);
  }
  return { where: w.length ? "WHERE " + w.join(" AND ") : "", params: p };
}

async function postgresSearch(q: SearchQuery): Promise<SearchResult> {
  const t0 = Date.now();
  const { where, params } = postgresWhere(q);
  const geo = q.lat !== undefined && q.lon !== undefined;
  const order =
    q.sort === "newest" ? "first_seen DESC, quality_score DESC" :
    q.sort === "name" ? "name ASC" :
    q.sort === "distance" && geo ? `geom <-> ST_SetSRID(ST_MakePoint(${Number(q.lon)}, ${Number(q.lat)}), 4326)::geography` :
    q.q && q.sort === "relevance" ? `similarity(name_norm, lower($1)) DESC, quality_score DESC` : "quality_score DESC";
  const offset = (q.page - 1) * q.per_page;
  const [hits, count, ...facetRows] = await Promise.all([
    pool.query<{ id: string }>(`SELECT id FROM places ${where} ORDER BY ${order} LIMIT ${q.per_page} OFFSET ${offset}`, params),
    pool.query<{ n: string }>(`SELECT count(*) AS n FROM (SELECT 1 FROM places ${where} LIMIT 100000) t`, params),
    ...(["country", "city", "category_label", "category"] as const).map((col) =>
      pool.query<{ value: string; count: string }>(
        `SELECT ${col} AS value, count(*) AS count FROM (SELECT ${col} FROM places ${where} LIMIT 50000) t
         WHERE ${col} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12`, params)),
  ]);
  const names = ["country", "city", "category_label", "category"];
  const facets: Record<string, Facet[]> = {};
  facetRows.forEach((r, i) => { facets[names[i]] = r.rows.map((x) => ({ value: x.value, count: Number(x.count) })); });
  return { found: Number(count.rows[0].n), page: q.page, perPage: q.per_page, ids: hits.rows.map((h) => h.id),
    facets, tookMs: Date.now() - t0, backend: "postgres" };
}

/**
 * Typesense holds the busiest countries in memory for instant, typo-tolerant search.
 * Everything else (and world-wide searches when Typesense holds only some countries)
 * is answered by Postgres, which has every lead.
 */
export function useTypesense(q: SearchQuery): boolean {
  if (!config.typesenseUrl) return false;
  const held = config.typesenseCountries;
  if (held.length === 0) return true;
  return q.country.length > 0 && q.country.every((c) => held.includes(c.toUpperCase()));
}

export async function search(q: SearchQuery): Promise<SearchResult> {
  return useTypesense(q) ? typesenseSearch(q) : postgresSearch(q);
}

/** All ids for an export, in result order, capped. */
export async function searchIds(q: SearchQuery, limit: number): Promise<string[]> {
  const ids: string[] = [];
  const per = 250;
  for (let page = 1; ids.length < limit && page <= 400; page++) {
    const r = await search({ ...q, page, per_page: Math.min(per, 250) } as SearchQuery);
    ids.push(...r.ids);
    if (r.ids.length < per) break;
  }
  return ids.slice(0, limit);
}
