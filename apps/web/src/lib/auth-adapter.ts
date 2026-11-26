import "server-only";
import type { Adapter } from "next-auth/adapters";

const API = process.env.LEADVEED_API_URL ?? "http://127.0.0.1:4000";
const KEY = process.env.LEADVEED_INTERNAL_KEY ?? "dev-internal-key";

async function call<T>(method: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}/internal/auth/${method}`, {
    method: "POST", cache: "no-store",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`auth adapter ${method}: ${r.status}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

const dates = <T extends Record<string, any> | null>(u: T, ...keys: string[]): T => {
  if (u) for (const k of keys) if (u[k]) (u as any)[k] = new Date(u[k]);
  return u;
};

/** Auth.js adapter that stores users through the LeadVeed API (so Postgres stays private). */
export function LeadVeedAdapter(): Adapter {
  return {
    createUser: async (user) => dates(await call("createUser", user), "emailVerified"),
    getUser: async (id) => dates(await call("getUser", { id }), "emailVerified"),
    getUserByEmail: async (email) => dates(await call("getUserByEmail", { email }), "emailVerified"),
    getUserByAccount: async (a) => dates(await call("getUserByAccount", a), "emailVerified"),
    updateUser: async (user) => dates(await call("updateUser", user), "emailVerified"),
    deleteUser: async (id) => { await call("deleteUser", { id }); },
    linkAccount: async (account) => { await call("linkAccount", account); },
    unlinkAccount: async (a) => { await call("unlinkAccount", a); },
    createVerificationToken: async (t) => dates(await call("createVerificationToken", t), "expires"),
    useVerificationToken: async (t) => dates(await call("useVerificationToken", t), "expires"),
  } as Adapter;
}
