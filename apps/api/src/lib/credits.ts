import { tx } from "./db.js";

export class PaymentRequired extends Error {
  constructor(public needed: number, public balance: number) {
    super(`Not enough credits: need ${needed}, have ${balance}`);
  }
}

/**
 * Unlock leads for a user. Leads they already unlocked are free. Charges one
 * credit per new lead, atomically, and records it in the ledger.
 * With `partial`, unlocks as many as the balance allows instead of failing.
 */
export async function unlock(userId: string, ids: string[], reason: "unlock" | "export", opts: { partial?: boolean; ref?: string } = {}) {
  const unique = [...new Set(ids)];
  return tx(async (c) => {
    const u = await c.query<{ credits: number }>("SELECT credits FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!u.rowCount) throw new Error("User not found");
    let balance = u.rows[0].credits;
    const have = await c.query<{ place_id: string }>(
      "SELECT place_id FROM unlocks WHERE user_id = $1 AND place_id = ANY($2)", [userId, unique]);
    const already = new Set(have.rows.map((r) => r.place_id));
    // only charge for ids that exist
    const exist = await c.query<{ id: string }>("SELECT id FROM places WHERE id = ANY($1)", [unique.filter((i) => !already.has(i))]);
    let fresh = exist.rows.map((r) => r.id);
    if (fresh.length > balance) {
      if (!opts.partial) throw new PaymentRequired(fresh.length, balance);
      const keep = new Set(fresh.slice(0, balance));
      fresh = unique.filter((i) => keep.has(i));
    }
    if (fresh.length) {
      await c.query(
        "INSERT INTO unlocks (user_id, place_id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING", [userId, fresh]);
      await c.query("UPDATE users SET credits = credits - $2 WHERE id = $1", [userId, fresh.length]);
      await c.query("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES ($1, $2, $3, $4)",
        [userId, -fresh.length, reason, opts.ref ?? null]);
      balance -= fresh.length;
    }
    const unlocked = unique.filter((i) => already.has(i) || fresh.includes(i));
    return { charged: fresh.length, unlocked, balance };
  });
}

export async function grant(userId: string, delta: number, reason: string, ref?: string) {
  return tx(async (c) => {
    await c.query("UPDATE users SET credits = credits + $2 WHERE id = $1", [userId, delta]);
    await c.query("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES ($1, $2, $3, $4)", [userId, delta, reason, ref ?? null]);
  });
}
