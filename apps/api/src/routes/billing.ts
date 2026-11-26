import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { config } from "../config.js";
import { pool, tx } from "../lib/db.js";
import { PLANS, planForVariant, type PlanId } from "../plans.js";

async function grantIn(c: PoolClient, userId: string, delta: number, reason: string, ref: string) {
  await c.query("UPDATE users SET credits = credits + $2, credits_reset_at = now() WHERE id = $1", [userId, delta]);
  await c.query("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES ($1, $2, $3, $4)", [userId, delta, reason, ref]);
}

export function verifySignature(raw: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const digest = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Lemon Squeezy webhooks. Configure in Lemon Squeezy -> Settings -> Webhooks:
 *   URL:    https://api.leadveed.com/webhooks/lemonsqueezy
 *   Events: subscription_created, subscription_updated, subscription_cancelled,
 *           subscription_expired, subscription_payment_success
 * The web app's checkout links pass checkout[custom][user_id], which comes
 * back here as meta.custom_data.user_id.
 */
export async function billingRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    if (req.url.startsWith("/webhooks/")) return done(null, body);
    try { done(null, JSON.parse(body.toString() || "null")); } catch (e) { done(e as Error); }
  });

  app.post("/webhooks/lemonsqueezy", async (req, reply) => {
    const raw = req.body as Buffer;
    if (!verifySignature(raw, req.headers["x-signature"] as string | undefined, config.lemonSigningSecret)) {
      return reply.code(401).send({ error: "bad_signature" });
    }
    const evt = JSON.parse(raw.toString());
    const name: string = evt.meta?.event_name;
    const userId: string | undefined = evt.meta?.custom_data?.user_id;
    const attrs = evt.data?.attributes ?? {};
    const eventId = `${name}:${evt.data?.id}:${attrs.updated_at ?? attrs.created_at ?? ""}`;
    const fresh = await pool.query(
      "INSERT INTO webhook_events (id, provider, payload) VALUES ($1, 'lemonsqueezy', $2) ON CONFLICT DO NOTHING",
      [eventId, evt]);
    if (!fresh.rowCount) return { ok: true, duplicate: true };
    if (!userId) return { ok: true, ignored: "no user_id" };

    const subscriptionId = name === "subscription_payment_success" ? String(attrs.subscription_id) : String(evt.data?.id);
    const plan: PlanId | null = planForVariant(attrs.variant_id);

    await tx(async (c) => {
      switch (name) {
        case "subscription_created":
        case "subscription_updated": {
          const { rows: [u] } = await c.query<{ plan: PlanId }>("SELECT plan FROM users WHERE id = $1 FOR UPDATE", [userId]);
          if (!u) break;
          await c.query(
            `UPDATE users SET plan = coalesce($2, plan), ls_customer_id = $3, ls_subscription_id = $4, subscription_status = $5
             WHERE id = $1`, [userId, plan, String(attrs.customer_id ?? ""), subscriptionId, attrs.status ?? null]);
          // First subscription grants the month's credits; an upgrade grants the difference right away.
          const before = name === "subscription_created" ? 0 : (PLANS[u.plan]?.credits ?? 0);
          const after = plan ? PLANS[plan].credits : 0;
          if (plan && plan !== u.plan && after > before) {
            await grantIn(c, userId, after - before, name === "subscription_created" ? "plan_start" : "plan_upgrade", String(evt.data?.id));
          }
          break;
        }
        case "subscription_cancelled": {
          // keep the plan until it expires at the end of the paid period
          await c.query("UPDATE users SET subscription_status = 'cancelled' WHERE id = $1", [userId]);
          break;
        }
        case "subscription_expired": {
          await c.query("UPDATE users SET plan = 'free', subscription_status = 'expired' WHERE id = $1", [userId]);
          break;
        }
        case "subscription_payment_success": {
          if (attrs.billing_reason === "initial") break;   // covered by subscription_created
          // New billing month: top up to the plan's allowance; unused credits roll over one month (max 2x).
          const { rows: [u] } = await c.query<{ plan: PlanId; credits: number }>(
            "SELECT plan, credits FROM users WHERE id = $1 FOR UPDATE", [userId]);
          if (!u) break;
          const allowance = PLANS[u.plan]?.credits ?? 0;
          const target = Math.min(u.credits + allowance, allowance * 2);
          const delta = target - u.credits;
          if (delta > 0) await grantIn(c, userId, delta, "plan_refill", String(evt.data?.id));
          break;
        }
      }
    });
    return { ok: true };
  });
}
