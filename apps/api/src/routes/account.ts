import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../lib/db.js";
import { getRows, toLead } from "../lib/leads.js";
import { PLANS, type PlanId } from "../plans.js";
import { userId } from "../server-helpers.js";

export async function accountRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (req.url.startsWith("/v1/me") && !userId(req)) return reply.code(401).send({ error: "sign_in_required" });
  });

  app.get("/v1/me", async (req) => {
    const uid = userId(req)!;
    const [{ rows: [u] }, { rows: ledger }, { rows: exports }, { rows: [counts] }] = await Promise.all([
      pool.query(`SELECT id, name, email, image, plan, credits, credits_reset_at, subscription_status, created_at
                  FROM users WHERE id = $1`, [uid]),
      pool.query(`SELECT delta, reason, ref, created_at FROM credit_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [uid]),
      pool.query(`SELECT id, query, rows, credits_used, created_at FROM exports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [uid]),
      pool.query(`SELECT (SELECT count(*)::int FROM unlocks WHERE user_id = $1) AS unlocked,
                         (SELECT count(*)::int FROM lists WHERE user_id = $1) AS lists`, [uid]),
    ]);
    if (!u) return { error: "not_found" };
    return { user: u, plan: PLANS[u.plan as PlanId] ?? PLANS.free, ledger, exports, counts };
  });

  app.get("/v1/me/unlocked", async (req) => {
    const uid = userId(req)!;
    const page = Math.max(1, Number((req.query as { page?: string }).page ?? 1));
    const { rows } = await pool.query<{ place_id: string }>(
      `SELECT place_id FROM unlocks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50 OFFSET $2`, [uid, (page - 1) * 50]);
    const leads = await getRows(rows.map((r) => r.place_id));
    return { page, leads: leads.map((l) => toLead(l, true)) };
  });

  // Lists ------------------------------------------------------------------
  app.get("/v1/me/lists", async (req) => {
    const { rows } = await pool.query(
      `SELECT l.id, l.name, l.created_at, count(i.place_id)::int AS size
       FROM lists l LEFT JOIN list_items i ON i.list_id = l.id WHERE l.user_id = $1
       GROUP BY l.id ORDER BY l.created_at DESC`, [userId(req)]);
    return { lists: rows };
  });

  app.post("/v1/me/lists", async (req, reply) => {
    const b = z.object({ name: z.string().min(1).max(80) }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "bad_request" });
    const { rows: [l] } = await pool.query(
      "INSERT INTO lists (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at", [userId(req), b.data.name]);
    return { list: l };
  });

  app.get<{ Params: { id: string } }>("/v1/me/lists/:id", async (req, reply) => {
    const { rows: [l] } = await pool.query("SELECT id, name FROM lists WHERE id = $1 AND user_id = $2",
      [Number(req.params.id), userId(req)]);
    if (!l) return reply.code(404).send({ error: "not_found" });
    const { rows } = await pool.query<{ place_id: string }>(
      "SELECT place_id FROM list_items WHERE list_id = $1 ORDER BY added_at DESC LIMIT 5000", [l.id]);
    const ids = rows.map((r) => r.place_id);
    const { rows: un } = await pool.query<{ place_id: string }>(
      "SELECT place_id FROM unlocks WHERE user_id = $1 AND place_id = ANY($2)", [userId(req), ids]);
    const set = new Set(un.map((u) => u.place_id));
    const leads = await getRows(ids);
    return { list: l, leads: leads.map((x) => toLead(x, set.has(x.id))) };
  });

  app.post<{ Params: { id: string } }>("/v1/me/lists/:id/items", async (req, reply) => {
    const b = z.object({ ids: z.array(z.string().max(40)).min(1).max(1000), remove: z.boolean().optional() }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "bad_request" });
    const { rowCount } = await pool.query("SELECT 1 FROM lists WHERE id = $1 AND user_id = $2", [Number(req.params.id), userId(req)]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    if (b.data.remove) {
      await pool.query("DELETE FROM list_items WHERE list_id = $1 AND place_id = ANY($2)", [Number(req.params.id), b.data.ids]);
    } else {
      await pool.query(
        "INSERT INTO list_items (list_id, place_id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING",
        [Number(req.params.id), b.data.ids]);
    }
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/v1/me/lists/:id", async (req) => {
    await pool.query("DELETE FROM lists WHERE id = $1 AND user_id = $2", [Number(req.params.id), userId(req)]);
    return { ok: true };
  });

  // Saved searches -----------------------------------------------------------
  app.get("/v1/me/searches", async (req) => {
    const { rows } = await pool.query(
      "SELECT id, name, query, alert, created_at FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC", [userId(req)]);
    return { searches: rows };
  });
  app.post("/v1/me/searches", async (req, reply) => {
    const b = z.object({ name: z.string().min(1).max(80), query: z.record(z.string(), z.string()), alert: z.boolean().optional() })
      .safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "bad_request" });
    const { rows: [s] } = await pool.query(
      "INSERT INTO saved_searches (user_id, name, query, alert) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId(req), b.data.name, JSON.stringify(b.data.query), b.data.alert ?? false]);
    return { search: s };
  });
  app.delete<{ Params: { id: string } }>("/v1/me/searches/:id", async (req) => {
    await pool.query("DELETE FROM saved_searches WHERE id = $1 AND user_id = $2", [Number(req.params.id), userId(req)]);
    return { ok: true };
  });
}
