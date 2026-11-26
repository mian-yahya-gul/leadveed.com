import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { pool, tx } from "../lib/db.js";
import { escapeHtml, sendEmail } from "../lib/email.js";
import { refreshDocs } from "../lib/typesense.js";

/**
 * "Remove my data": anyone can ask for a business listing to be removed.
 * We email a confirmation link; once confirmed the lead is deleted and added
 * to the suppression list so the next monthly import does not bring it back.
 */
export async function removalRoutes(app: FastifyInstance) {
  app.post("/v1/removal", async (req, reply) => {
    const b = z.object({
      email: z.string().email().max(200),
      placeUrl: z.string().max(500).optional(),
      businessName: z.string().max(200).optional(),
      message: z.string().max(2000).optional(),
    }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "bad_request" });
    const placeId = b.data.placeUrl?.match(/lv_[a-f0-9]{16}/)?.[0] ?? null;
    if (!placeId && !b.data.businessName) return reply.code(400).send({ error: "need_place_or_name" });
    const token = randomBytes(24).toString("hex");
    await pool.query(
      `INSERT INTO removal_requests (email, place_url, place_id, business_name, message, token)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [b.data.email, b.data.placeUrl ?? null, placeId, b.data.businessName ?? null, b.data.message ?? null, token]);
    const link = `${config.siteUrl}/remove-my-data/confirm?token=${token}`;
    await sendEmail(b.data.email, "Confirm your LeadVeed removal request", `
      <p>Hi,</p>
      <p>We received a request to remove ${escapeHtml(b.data.businessName ?? placeId ?? "a listing")} from LeadVeed.</p>
      <p><a href="${link}">Confirm the removal</a></p>
      <p>If you didn't ask for this, you can ignore this email.</p>
      <p>LeadVeed</p>`);
    return { ok: true };
  });

  app.post("/v1/removal/confirm", async (req, reply) => {
    const b = z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "bad_token" });
    const result = await tx(async (c) => {
      const { rows: [r] } = await c.query(
        "SELECT * FROM removal_requests WHERE token = $1 AND confirmed_at IS NULL FOR UPDATE", [b.data.token]);
      if (!r) return null;
      await c.query("UPDATE removal_requests SET confirmed_at = now() WHERE id = $1", [r.id]);
      if (!r.place_id) return { status: "pending_review" as const, placeId: null };
      const { rows: [p] } = await c.query<{ domain: string | null }>("SELECT domain FROM places WHERE id = $1", [r.place_id]);
      await c.query("INSERT INTO suppressions (place_id, domain, reason) VALUES ($1, $2, $3)",
        [r.place_id, null, `removal_request:${r.id}`]);
      await c.query("DELETE FROM places WHERE id = $1", [r.place_id]);
      await c.query("UPDATE removal_requests SET status = 'removed', resolved_at = now() WHERE id = $1", [r.id]);
      return { status: "removed" as const, placeId: r.place_id as string, domain: p?.domain };
    });
    if (!result) return reply.code(404).send({ error: "not_found_or_used" });
    if (result.placeId) await refreshDocs([result.placeId]);
    return { ok: true, status: result.status };
  });
}
