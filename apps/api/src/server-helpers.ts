import type { FastifyRequest } from "fastify";

/** The signed-in user, as asserted by the Next.js server (trusted via INTERNAL_API_KEY). */
export function userId(req: FastifyRequest): string | null {
  const v = req.headers["x-leadveed-user"];
  return typeof v === "string" && /^usr_[a-z0-9]{8,64}$/.test(v) ? v : null;
}
