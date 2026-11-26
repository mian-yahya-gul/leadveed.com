import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import { pool } from "./lib/db.js";
import { accountRoutes } from "./routes/account.js";
import { authRoutes } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
import { leadRoutes } from "./routes/leads.js";
import { removalRoutes } from "./routes/removal.js";

function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: true, bodyLimit: 2 * 1024 * 1024 });

  await app.register(rateLimit, {
    max: 600, timeWindow: "1 minute",
    // the web server forwards the visitor's IP; rate-limit per user or per visitor, not per Vercel node
    keyGenerator: (req) => (req.headers["x-leadveed-user"] as string) || (req.headers["x-visitor-ip"] as string) || req.ip,
  });

  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health" || req.url.startsWith("/webhooks/")) return;
    const auth = req.headers.authorization ?? "";
    if (!safeEq(auth, `Bearer ${config.internalKey}`)) return reply.code(401).send({ error: "unauthorized" });
  });

  app.get("/health", async () => {
    await pool.query("SELECT 1");
    return { ok: true };
  });

  await app.register(billingRoutes);
  await app.register(leadRoutes);
  await app.register(accountRoutes);
  await app.register(removalRoutes);
  await app.register(authRoutes);
  return app;
}
