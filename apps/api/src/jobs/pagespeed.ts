/**
 * PageSpeed worker. Scores lead websites with Google's free PageSpeed Insights
 * API (25,000 requests/day per key) and stores the mobile performance score.
 *
 * Run by the leadveed-pagespeed systemd timer every 15 minutes. Each run takes
 * a slice of the daily budget: unscored, highest-quality leads first, and leads
 * someone recently unlocked jump the queue. Scores older than 90 days are redone.
 */
import { config } from "../config.js";
import { pool } from "../lib/db.js";
import { refreshDocs } from "../lib/typesense.js";

const RUNS_PER_DAY = 96;
const CONCURRENCY = 8;

async function score(url: string, strategy: "mobile" | "desktop") {
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", url);
  api.searchParams.set("strategy", strategy);
  api.searchParams.set("category", "performance");
  if (config.pagespeedKey) api.searchParams.set("key", config.pagespeedKey);
  const r = await fetch(api, { signal: AbortSignal.timeout(90_000) });
  if (!r.ok) throw new Error(`PSI ${r.status}`);
  const d = (await r.json()) as any;
  const lh = d.lighthouseResult;
  const audits = lh?.audits ?? {};
  return {
    score: Math.round((lh?.categories?.performance?.score ?? 0) * 100),
    metrics: {
      lcp_ms: audits["largest-contentful-paint"]?.numericValue ?? null,
      cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
      tbt_ms: audits["total-blocking-time"]?.numericValue ?? null,
      fcp_ms: audits["first-contentful-paint"]?.numericValue ?? null,
      https: (lh?.finalUrl ?? url).startsWith("https://"),
      final_url: lh?.finalUrl ?? null,
    },
  };
}

export async function runOnce(limit: number): Promise<number> {
  const { rows } = await pool.query<{ id: string; url: string }>(
    `SELECT p.id, p.websites[1] AS url FROM places p
     LEFT JOIN LATERAL (SELECT max(created_at) AS t FROM unlocks u WHERE u.place_id = p.id) u ON true
     WHERE p.domain IS NOT NULL
       AND (p.pagespeed_checked_at IS NULL OR p.pagespeed_checked_at < now() - interval '90 days')
     ORDER BY (u.t > now() - interval '7 days') DESC NULLS LAST, p.pagespeed_checked_at NULLS FIRST, p.quality_score DESC
     LIMIT $1`, [limit]);
  let done = 0;
  const queue = [...rows];
  async function worker() {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const url = /^https?:\/\//i.test(job.url) ? job.url : `https://${job.url}`;
      try {
        const m = await score(url, "mobile");
        await pool.query(
          `UPDATE places SET pagespeed_mobile = $2, pagespeed_metrics = $3, pagespeed_checked_at = now() WHERE id = $1`,
          [job.id, m.score, JSON.stringify(m.metrics)]);
        await refreshDocs([job.id]);
        done++;
      } catch (e) {
        // unreachable sites still get a timestamp so we don't retry them every run
        await pool.query(
          `UPDATE places SET pagespeed_checked_at = now(), pagespeed_metrics = $2 WHERE id = $1`,
          [job.id, JSON.stringify({ error: String((e as Error).message).slice(0, 200) })]);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return done;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const limit = Number(process.argv[2] ?? Math.floor(config.pagespeedDailyBudget / RUNS_PER_DAY));
  runOnce(limit)
    .then((n) => { console.log(`pagespeed: scored ${n}/${limit}`); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
