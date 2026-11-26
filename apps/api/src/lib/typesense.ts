import { config } from "../config.js";
import { pool } from "./db.js";

/** Keep the search index in step after a single lead changes (PageSpeed, removal). */
export async function refreshDocs(ids: string[]): Promise<void> {
  if (!config.typesenseUrl || ids.length === 0) return;
  const h = { "X-TYPESENSE-API-KEY": config.typesenseKey };
  const { rows } = await pool.query(
    `SELECT id, pagespeed_mobile FROM places WHERE id = ANY($1)`, [ids]);
  const found = new Set(rows.map((r) => r.id));
  for (const r of rows) {
    if (r.pagespeed_mobile === null) continue;
    await fetch(`${config.typesenseUrl}/collections/places/documents/${encodeURIComponent(r.id)}`, {
      method: "PATCH", headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ pagespeed: r.pagespeed_mobile }),
    });
  }
  for (const id of ids.filter((i) => !found.has(i))) {
    await fetch(`${config.typesenseUrl}/collections/places/documents/${encodeURIComponent(id)}`, { method: "DELETE", headers: h });
  }
}
