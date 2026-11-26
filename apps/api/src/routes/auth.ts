import type { FastifyInstance } from "fastify";
import { pool, tx } from "../lib/db.js";
import { PLANS } from "../plans.js";

/**
 * Auth.js adapter over HTTP. The Next.js app (on Vercel) calls these with the
 * internal key, so Postgres never has to be exposed to the internet.
 * Method names and shapes follow @auth/core's Adapter interface.
 */
type Body = Record<string, any>;

const userCols = `id, name, email, "emailVerified", image`;

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Params: { method: string }; Body: Body }>("/internal/auth/:method", async (req, reply) => {
    const a = req.body ?? {};
    switch (req.params.method) {
      case "createUser": {
        return tx(async (c) => {
          const { rows: [u] } = await c.query(
            `INSERT INTO users (name, email, "emailVerified", image, credits) VALUES ($1, $2, $3, $4, $5) RETURNING ${userCols}`,
            [a.name ?? null, a.email, a.emailVerified ?? null, a.image ?? null, PLANS.free.credits]);
          await c.query("INSERT INTO credit_ledger (user_id, delta, reason) VALUES ($1, $2, 'signup')", [u.id, PLANS.free.credits]);
          return u;
        });
      }
      case "getUser": {
        const { rows: [u] } = await pool.query(`SELECT ${userCols} FROM users WHERE id = $1`, [a.id]);
        return u ?? null;
      }
      case "getUserByEmail": {
        const { rows: [u] } = await pool.query(`SELECT ${userCols} FROM users WHERE email = $1`, [a.email]);
        return u ?? null;
      }
      case "getUserByAccount": {
        const { rows: [u] } = await pool.query(
          `SELECT u.id, u.name, u.email, u."emailVerified", u.image FROM users u JOIN accounts a ON a."userId" = u.id
           WHERE a.provider = $1 AND a."providerAccountId" = $2`, [a.provider, a.providerAccountId]);
        return u ?? null;
      }
      case "updateUser": {
        const { rows: [u] } = await pool.query(
          `UPDATE users SET name = coalesce($2, name), email = coalesce($3, email),
             "emailVerified" = coalesce($4, "emailVerified"), image = coalesce($5, image)
           WHERE id = $1 RETURNING ${userCols}`,
          [a.id, a.name ?? null, a.email ?? null, a.emailVerified ?? null, a.image ?? null]);
        return u;
      }
      case "deleteUser": {
        await pool.query("DELETE FROM users WHERE id = $1", [a.id]);
        return null;
      }
      case "linkAccount": {
        await pool.query(
          `INSERT INTO accounts ("userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at,
             id_token, scope, session_state, token_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (provider, "providerAccountId") DO NOTHING`,
          [a.userId, a.type, a.provider, a.providerAccountId, a.refresh_token ?? null, a.access_token ?? null,
            a.expires_at ?? null, a.id_token ?? null, a.scope ?? null, a.session_state ?? null, a.token_type ?? null]);
        return a;
      }
      case "unlinkAccount": {
        await pool.query(`DELETE FROM accounts WHERE provider = $1 AND "providerAccountId" = $2`, [a.provider, a.providerAccountId]);
        return null;
      }
      case "createVerificationToken": {
        await pool.query("INSERT INTO verification_token (identifier, expires, token) VALUES ($1, $2, $3)",
          [a.identifier, a.expires, a.token]);
        return a;
      }
      case "useVerificationToken": {
        const { rows: [t] } = await pool.query(
          "DELETE FROM verification_token WHERE identifier = $1 AND token = $2 RETURNING identifier, expires, token",
          [a.identifier, a.token]);
        return t ?? null;
      }
      default:
        return reply.code(404).send({ error: "unknown_method" });
    }
  });
}
