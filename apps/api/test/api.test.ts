/**
 * Integration tests against a real Postgres with the schema applied and some
 * places loaded (run the pipeline first). Skipped unless TEST_DATABASE_URL is set.
 *   TEST_DATABASE_URL=postgresql://leadveed:devpass@localhost/leadveed npm test
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB = process.env.TEST_DATABASE_URL;
const d = DB ? describe : describe.skip;

d("api", async () => {
  process.env.DATABASE_URL = DB;
  process.env.INTERNAL_API_KEY = "test-key";
  process.env.PADDLE_WEBHOOK_SECRET = "whsec";
  process.env.PADDLE_PRICE_STARTER = "pri_test_starter";
  const { buildApp } = await import("../src/app.js");
  const { pool } = await import("../src/lib/db.js");
  const app = await buildApp({ logger: false });
  const H = { authorization: "Bearer test-key" };
  let user: { id: string };
  let someId: string;

  beforeAll(async () => {
    const email = `test+${Date.now()}@example.com`;
    const r = await app.inject({ method: "POST", url: "/internal/auth/createUser", headers: H, payload: { email } });
    user = r.json();
    const { rows } = await pool.query("SELECT id FROM places WHERE cardinality(phones) > 0 ORDER BY quality_score DESC LIMIT 1");
    someId = rows[0].id;
  });
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
    await app.close();
    await pool.end();
  });

  it("rejects calls without the internal key", async () => {
    const r = await app.inject({ url: "/v1/search" });
    expect(r.statusCode).toBe(401);
  });

  it("new users get 25 free credits", async () => {
    const r = await app.inject({ url: "/v1/me", headers: { ...H, "x-leadveed-user": user.id } });
    expect(r.json().user.credits).toBe(25);
  });

  it("searches with filters and masks contact details for anonymous visitors", async () => {
    const r = await app.inject({ url: "/v1/search?country=PK&has_phone=true&per_page=5", headers: H });
    const b = r.json();
    expect(r.statusCode).toBe(200);
    expect(b.found).toBeGreaterThan(0);
    expect(b.hits.length).toBeLessThanOrEqual(5);
    for (const h of b.hits) {
      expect(h.address.country).toBe("PK");
      expect(h.unlocked).toBe(false);
      expect(h.phones[0]).toContain("•");
    }
  });

  it("filters businesses without a website", async () => {
    const r = await app.inject({ url: "/v1/search?country=AE&has_website=false&per_page=10", headers: H });
    for (const h of r.json().hits) expect(h.signals.hasWebsite).toBe(false);
  });

  it("limits anonymous paging", async () => {
    const r = await app.inject({ url: "/v1/search?page=9", headers: H });
    expect(r.statusCode).toBe(401);
  });

  it("unlocks a lead once, charging one credit", async () => {
    const U = { ...H, "x-leadveed-user": user.id };
    const a = await app.inject({ method: "POST", url: "/v1/leads/unlock", headers: U, payload: { ids: [someId] } });
    expect(a.json().charged).toBe(1);
    expect(a.json().leads[0].phones[0]).not.toContain("•");
    const b = await app.inject({ method: "POST", url: "/v1/leads/unlock", headers: U, payload: { ids: [someId] } });
    expect(b.json().charged).toBe(0);
    const lead = await app.inject({ url: `/v1/leads/${someId}`, headers: U });
    expect(lead.json().lead.unlocked).toBe(true);
  });

  it("refuses an export larger than the balance, and allows a partial one", async () => {
    const U = { ...H, "x-leadveed-user": user.id };
    const ids = (await pool.query("SELECT id FROM places WHERE id <> $1 LIMIT 40", [someId])).rows.map((r) => r.id);
    const full = await app.inject({ method: "POST", url: "/v1/export", headers: U, payload: { ids } });
    expect(full.statusCode).toBe(402);
    const part = await app.inject({ method: "POST", url: "/v1/export", headers: U, payload: { ids, partial: true } });
    expect(part.statusCode).toBe(200);
    const lines = part.body.trim().split("\r\n");
    expect(lines[0]).toContain("leadveed_id,name");
    expect(lines.length - 1).toBe(24); // 25 free credits minus the one unlock above
    expect(part.headers["x-credits-balance"]).toBe("0");
  });

  it("starts a plan and refills credits from Paddle webhooks", async () => {
    const send = (body: object) => {
      const payload = JSON.stringify(body);
      const ts = Math.floor(Date.now() / 1000);
      const h1 = createHmac("sha256", "whsec").update(`${ts}:${payload}`).digest("hex");
      return app.inject({ method: "POST", url: "/webhooks/paddle", payload,
        headers: { "content-type": "application/json", "paddle-signature": `ts=${ts};h1=${h1}` } });
    };
    const sub = `sub_${Date.now()}`;
    const me0 = await app.inject({ url: "/v1/me", headers: { ...H, "x-leadveed-user": user.id } });
    const start: number = me0.json().user.credits;
    const r = await send({ event_id: `evt_${sub}_1`, event_type: "subscription.created",
      data: { id: sub, status: "active", customer_id: "ctm_1", custom_data: { user_id: user.id },
        items: [{ price: { id: "pri_test_starter" } }] } });
    expect(r.statusCode).toBe(200);
    const me = await app.inject({ url: "/v1/me", headers: { ...H, "x-leadveed-user": user.id } });
    expect(me.json().user.plan).toBe("starter");
    expect(me.json().user.credits).toBe(start + 1000);

    // the same event again is ignored
    expect((await send({ event_id: `evt_${sub}_1`, event_type: "subscription.created",
      data: { id: sub, status: "active", custom_data: { user_id: user.id }, items: [{ price: { id: "pri_test_starter" } }] } })).json().duplicate).toBe(true);

    // renewal: unused credits roll over, capped at 2x the allowance
    await pool.query("UPDATE users SET credits = 1000 WHERE id = $1", [user.id]);
    await send({ event_id: `evt_${sub}_2`, event_type: "transaction.completed",
      data: { id: "txn_1", origin: "subscription_recurring", subscription_id: sub } });
    const me2 = await app.inject({ url: "/v1/me", headers: { ...H, "x-leadveed-user": user.id } });
    expect(me2.json().user.credits).toBe(2000);

    // cancellation at period end drops to free
    await send({ event_id: `evt_${sub}_3`, event_type: "subscription.canceled",
      data: { id: sub, status: "canceled", items: [{ price: { id: "pri_test_starter" } }] } });
    const me3 = await app.inject({ url: "/v1/me", headers: { ...H, "x-leadveed-user": user.id } });
    expect(me3.json().user.plan).toBe("free");

    const bad = await app.inject({ method: "POST", url: "/webhooks/paddle", payload: "{}",
      headers: { "content-type": "application/json", "paddle-signature": "ts=1;h1=nope" } });
    expect(bad.statusCode).toBe(401);
  });

  it("removes a listing after the email link is confirmed and suppresses it", async () => {
    const { rows: [p] } = await pool.query("SELECT id FROM places ORDER BY quality_score ASC LIMIT 1");
    const r = await app.inject({ method: "POST", url: "/v1/removal", headers: H,
      payload: { email: "owner@example.com", placeUrl: `https://leadveed.com/lead/${p.id}` } });
    expect(r.statusCode).toBe(200);
    const { rows: [req] } = await pool.query("SELECT token FROM removal_requests WHERE place_id = $1", [p.id]);
    const c = await app.inject({ method: "POST", url: "/v1/removal/confirm", headers: H, payload: { token: req.token } });
    expect(c.json().status).toBe("removed");
    expect((await pool.query("SELECT 1 FROM places WHERE id = $1", [p.id])).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM suppressions WHERE place_id = $1", [p.id])).rowCount).toBe(1);
  });

  it("returns stats and suggestions", async () => {
    const s = await app.inject({ url: "/v1/stats", headers: H });
    expect(s.json().leads).toBeGreaterThan(1000);
    const c = await app.inject({ url: "/v1/suggest?field=city&q=lah", headers: H });
    expect(c.json().items[0].value).toBe("Lahore");
  });
});
