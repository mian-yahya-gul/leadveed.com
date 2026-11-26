import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { PaymentRequired, unlock } from "../lib/credits.js";
import { pool } from "../lib/db.js";
import { CSV_HEADER, csvRow, getRows, similar, toLead, unlockedSet } from "../lib/leads.js";
import { search, SearchQuery, searchIds } from "../lib/search.js";
import { PLANS, type PlanId } from "../plans.js";
import { userId } from "../server-helpers.js";

export async function leadRoutes(app: FastifyInstance) {
  app.get("/v1/search", async (req, reply) => {
    const parsed = SearchQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "bad_query", issues: parsed.error.issues });
    const q = parsed.data;
    const uid = userId(req);
    if (!uid && q.page > config.anonMaxPages) {
      return reply.code(401).send({ error: "sign_in_required", message: "Create a free account to see more results." });
    }
    const res = await search(q);
    const [rows, unlocked] = await Promise.all([getRows(res.ids), unlockedSet(uid, res.ids)]);
    return {
      found: res.found, page: res.page, perPage: res.perPage, tookMs: res.tookMs, backend: res.backend,
      facets: res.facets,
      hits: rows.map((r) => toLead(r, unlocked.has(r.id))),
    };
  });

  app.get<{ Params: { id: string } }>("/v1/leads/:id", async (req, reply) => {
    const [row] = await getRows([req.params.id]);
    if (!row) return reply.code(404).send({ error: "not_found" });
    const uid = userId(req);
    const near = await similar(row);
    const unlocked = await unlockedSet(uid, [row.id, ...near.map((n) => n.id)]);
    return { lead: toLead(row, unlocked.has(row.id)), similar: near.map((n) => toLead(n, unlocked.has(n.id))) };
  });

  app.post("/v1/leads/unlock", async (req, reply) => {
    const uid = userId(req);
    if (!uid) return reply.code(401).send({ error: "sign_in_required" });
    const body = z.object({ ids: z.array(z.string().max(40)).min(1).max(250) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "bad_request" });
    try {
      const r = await unlock(uid, body.data.ids, "unlock");
      const rows = await getRows(r.unlocked);
      return { charged: r.charged, balance: r.balance, leads: rows.map((x) => toLead(x, true)) };
    } catch (e) {
      if (e instanceof PaymentRequired) {
        return reply.code(402).send({ error: "not_enough_credits", needed: e.needed, balance: e.balance });
      }
      throw e;
    }
  });

  /**
   * Export as CSV. Either a list of ids, or a search query plus a row limit.
   * Already-unlocked leads are free; new ones cost one credit each. With
   * partial=true the export stops where the balance runs out instead of failing.
   */
  app.post("/v1/export", async (req, reply) => {
    const uid = userId(req);
    if (!uid) return reply.code(401).send({ error: "sign_in_required" });
    const body = z.object({
      ids: z.array(z.string().max(40)).max(15000).optional(),
      query: z.record(z.string(), z.string()).optional(),
      limit: z.number().int().min(1).max(15000).optional(),
      partial: z.boolean().optional(),
      preview: z.boolean().optional(),          // just say what it would cost
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "bad_request" });

    const { rows: [user] } = await pool.query<{ plan: PlanId; credits: number }>(
      "SELECT plan, credits FROM users WHERE id = $1", [uid]);
    if (!user) return reply.code(401).send({ error: "sign_in_required" });
    const cap = PLANS[user.plan]?.maxExportRows ?? 25;

    let ids = body.data.ids ?? [];
    if (!ids.length && body.data.query) {
      const q = SearchQuery.safeParse(body.data.query);
      if (!q.success) return reply.code(400).send({ error: "bad_query" });
      ids = await searchIds(q.data, Math.min(body.data.limit ?? cap, cap));
    }
    ids = ids.slice(0, cap);
    if (!ids.length) return reply.code(400).send({ error: "nothing_to_export" });

    if (body.data.preview) {
      const have = await unlockedSet(uid, ids);
      const cost = ids.length - have.size;
      return { rows: ids.length, alreadyUnlocked: have.size, cost, balance: user.credits, cap };
    }

    let r;
    try {
      r = await unlock(uid, ids, "export", { partial: body.data.partial });
    } catch (e) {
      if (e instanceof PaymentRequired) {
        return reply.code(402).send({ error: "not_enough_credits", needed: e.needed, balance: e.balance });
      }
      throw e;
    }
    await pool.query("INSERT INTO exports (user_id, query, rows, credits_used) VALUES ($1, $2, $3, $4)",
      [uid, JSON.stringify(body.data.query ?? { ids: ids.length }), r.unlocked.length, r.charged]);
    const rows = await getRows(r.unlocked);
    const csv = [CSV_HEADER.join(","), ...rows.map((x) => csvRow(x, config.siteUrl))].join("\r\n");
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="leadveed-${new Date().toISOString().slice(0, 10)}.csv"`)
      .header("X-Credits-Charged", String(r.charged))
      .header("X-Credits-Balance", String(r.balance))
      .send("﻿" + csv);   // BOM so Excel reads UTF-8 names correctly
  });

  /** Headline numbers for the landing page, from the summary tables the importer refreshes. */
  let statsCache: { at: number; body: unknown } | null = null;
  app.get("/v1/stats", async () => {
    if (statsCache && Date.now() - statsCache.at < 600_000) return statsCache.body;
    const [{ rows: countries }, { rows: [imp] }] = await Promise.all([
      pool.query(`SELECT country, n::int AS n, with_website::int AS w, with_phone::int AS p, with_email::int AS e, avg_quality
                  FROM country_stats ORDER BY n DESC`),
      pool.query(`SELECT release, finished_at FROM imports WHERE status = 'done' ORDER BY finished_at DESC LIMIT 1`),
    ]);
    const total = countries.reduce((a, c) => a + c.n, 0) || 1;
    const sum = (k: "w" | "p" | "e") => countries.reduce((a, c) => a + c[k], 0) / total;
    const body = {
      leads: countries.reduce((a, c) => a + c.n, 0), countries: countries.length,
      byCountry: countries.map((c) => ({ country: c.country, n: c.n })),
      lastImport: imp ?? null,
      shares: { website: sum("w"), phone: sum("p"), email: sum("e") },
      avgQuality: Math.round(countries.reduce((a, c) => a + c.avg_quality * c.n, 0) / total),
    };
    statsCache = { at: Date.now(), body };
    return body;
  });

  /** Autocomplete for the city and category pickers. */
  app.get("/v1/suggest", async (req, reply) => {
    const q = z.object({
      field: z.enum(["city", "category"]),
      q: z.string().max(60).default(""),
      country: z.string().length(2).optional(),
    }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "bad_query" });
    const { field, country } = q.data;
    const term = q.data.q.trim().toLowerCase();
    if (field === "city") {
      const { rows } = await pool.query(
        `SELECT city AS value, country, n::int AS count FROM city_stats
         WHERE ($1 = '' OR lower(city) LIKE $1 || '%') AND ($2::text IS NULL OR country = $2)
         ORDER BY n DESC LIMIT 12`, [term.replace(/[%_]/g, ""), country?.toUpperCase() ?? null]);
      return { items: rows };
    }
    // categories: match on the human label, rank by how many leads they cover
    const { rows } = await pool.query(
      `SELECT category AS value, initcap(replace(category, '_', ' ')) AS label, sum(n)::int AS count FROM category_stats
       WHERE ($1 = '' OR replace(category, '_', ' ') LIKE '%' || $1 || '%') AND ($2::text IS NULL OR country = $2)
       GROUP BY 1 ORDER BY 3 DESC LIMIT 15`, [term.replace(/[%_]/g, ""), country?.toUpperCase() ?? null]);
    return { items: rows };
  });
}
