import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { config } from "../config.js";
import { pool, tx } from "../lib/db.js";
import { PLANS, planForPrice, type PlanId } from "../plans.js";

async function grantIn(c: PoolClient, userId: string, delta: number, reason: string, ref: string) {
  await c.query("UPDATE users SET credits = credits + $2, credits_reset_at = now() WHERE id = $1", [userId, delta]);
  await c.query("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES ($1, $2, $3, $4)", [userId, delta, reason, ref]);
}

/** Reject webhooks older than this, so a captured request can't be replayed later. */
const MAX_AGE_SECONDS = 5 * 60;

/**
 * Verify a Paddle-Signature header ("ts=1700000000;h1=<hex>"): HMAC-SHA256 of "<ts>:<raw body>"
 * with the notification destination's secret key.
 */
export function verifyPaddleSignature(raw: Buffer, header: string | undefined, secret: string,
  now = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(";").map((p) => p.split("=", 2) as [string, string]));
  const ts = Number(parts.ts);
  if (!parts.ts || !Number.isFinite(ts) || Math.abs(now - ts) > MAX_AGE_SECONDS) return false;
  const digest = createHmac("sha256", secret).update(`${parts.ts}:`).update(raw).digest("hex");
  // Paddle may send several h1 values while a secret is being rotated.
  return header.split(";").filter((p) => p.startsWith("h1=")).some((p) => {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(p.slice(3), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/**
 * Paddle Billing webhooks. Configure in Paddle -> Developer tools -> Notifications -> New destination:
 *   URL:    https://api.leadveed.com/webhooks/paddle
 *   Events: subscription.created, subscription.updated, subscription.canceled, transaction.completed
 * The web app's checkout passes customData.user_id, which Paddle stores on the subscription.
 */
export async function billingRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    if (req.url.startsWith("/webhooks/")) return done(null, body);
    try { done(null, JSON.parse(body.toString() || "null")); } catch (e) { done(e as Error); }
  });

  app.post("/webhooks/paddle", async (req, reply) => {
    const raw = req.body as Buffer;
    if (!verifyPaddleSignature(raw, req.headers["paddle-signature"] as string | undefined, config.paddleWebhookSecret)) {
      return reply.code(401).send({ error: "bad_signature" });
    }
    const evt = JSON.parse(raw.toString());
    const type: string = evt.event_type;
    const data = evt.data ?? {};
    const fresh = await pool.query(
      "INSERT INTO webhook_events (id, provider, payload) VALUES ($1, 'paddle', $2) ON CONFLICT DO NOTHING",
      [String(evt.event_id), evt]);
    if (!fresh.rowCount) return { ok: true, duplicate: true };

    await tx(async (c) => {
      if (type === "subscription.created" || type === "subscription.updated" || type === "subscription.canceled") {
        let userId: string | undefined = data.custom_data?.user_id;
        if (!userId) {
          const { rows: [u] } = await c.query<{ id: string }>(
            "SELECT id FROM users WHERE billing_subscription_id = $1", [String(data.id)]);
          userId = u?.id;
        }
        if (!userId) return;
        const { rows: [u] } = await c.query<{ plan: PlanId }>("SELECT plan FROM users WHERE id = $1 FOR UPDATE", [userId]);
        if (!u) return;
        const status: string = data.status ?? "";
        const ended = type === "subscription.canceled" || status === "canceled";
        const plan: PlanId | null = ended ? "free" : planForPrice(data.items?.[0]?.price?.id);
        // A cancellation that only takes effect at the end of the paid period shows as a scheduled change.
        const shownStatus = !ended && data.scheduled_change?.action === "cancel" ? "cancelling" : status;
        await c.query(
          `UPDATE users SET plan = coalesce($2, plan), billing_customer_id = $3, billing_subscription_id = $4,
             subscription_status = $5 WHERE id = $1`,
          [userId, plan, data.customer_id ?? null, String(data.id), shownStatus || null]);
        // First subscription grants the month's credits; an upgrade grants the difference right away.
        if (plan && plan !== "free" && plan !== u.plan) {
          const before = type === "subscription.created" ? 0 : (PLANS[u.plan]?.credits ?? 0);
          const after = PLANS[plan].credits;
          if (after > before) {
            await grantIn(c, userId, after - before, type === "subscription.created" ? "plan_start" : "plan_upgrade", String(data.id));
          }
        }
        return;
      }

      if (type === "transaction.completed" && data.origin === "subscription_recurring" && data.subscription_id) {
        // New billing month: top up to the plan's allowance; unused credits roll over one month (max 2x).
        const { rows: [u] } = await c.query<{ id: string; plan: PlanId; credits: number }>(
          "SELECT id, plan, credits FROM users WHERE billing_subscription_id = $1 FOR UPDATE", [String(data.subscription_id)]);
        if (!u) return;
        const allowance = PLANS[u.plan]?.credits ?? 0;
        const target = Math.min(u.credits + allowance, allowance * 2);
        const delta = target - u.credits;
        if (delta > 0) await grantIn(c, u.id, delta, "plan_refill", String(data.id));
      }
    });
    return { ok: true };
  });
}
