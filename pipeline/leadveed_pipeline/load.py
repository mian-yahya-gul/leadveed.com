"""Load the merged CSV into Postgres.

Upserts by LeadVeed id so a lead keeps its id, first_seen date, PageSpeed score
and everyone's unlocks across monthly releases. Suppressed records (removal
requests) are dropped before they reach the table. Leads missing from two
releases in a row are deleted.
"""
from __future__ import annotations

import logging
from pathlib import Path

import psycopg

log = logging.getLogger(__name__)

COLUMNS = ("id, name, name_norm, category, category_label, category_group, categories, brand, street, city, region, "
           "postcode, country, lat, lon, phones, websites, emails, socials, domain, opening_hours, "
           "operating_status, sources, source_count, quality_score, quality, phone_keys, release")

STAGING = """
DROP TABLE IF EXISTS places_staging;
CREATE UNLOGGED TABLE places_staging (
  id text, name text, name_norm text, category text, category_label text, category_group text, categories text[], brand text,
  street text, city text, region text, postcode text, country text, lat double precision, lon double precision,
  phones text[], websites text[], emails text[], socials text[], domain text, opening_hours text,
  operating_status text, sources jsonb, source_count smallint, quality_score smallint, quality jsonb,
  phone_keys text[], release text
);
"""

# Small summary tables behind autocomplete and the landing-page counters,
# so those never scan the whole places table.
REFRESH_STATS = """
TRUNCATE country_stats, city_stats, category_stats;
INSERT INTO country_stats (country, n, with_website, with_phone, with_email, avg_quality)
  SELECT country, count(*), count(*) FILTER (WHERE cardinality(websites) > 0),
         count(*) FILTER (WHERE cardinality(phones) > 0), count(*) FILTER (WHERE cardinality(emails) > 0),
         avg(quality_score)
  FROM places WHERE country IS NOT NULL GROUP BY 1;
INSERT INTO city_stats (country, city, n)
  SELECT country, city, count(*) FROM places WHERE city IS NOT NULL AND country IS NOT NULL GROUP BY 1, 2 HAVING count(*) >= 3;
INSERT INTO category_stats (country, category, n)
  SELECT country, c, count(*) FROM places, unnest(categories) c WHERE country IS NOT NULL GROUP BY 1, 2;
"""

UPSERT = """
INSERT INTO places AS p (id, name, name_norm, category, category_label, category_group, categories, brand, street, city,
  region, postcode, country, lat, lon, phones, websites, emails, socials, domain, opening_hours,
  operating_status, sources, source_count, quality_score, quality, release, first_seen, last_seen, updated_at)
SELECT id, name, name_norm, category, category_label, category_group, categories, brand, street, city, region, postcode,
  country, lat, lon, phones, websites, emails, socials, domain, opening_hours, operating_status, sources,
  source_count, quality_score, quality, release, current_date, current_date, now()
FROM places_staging
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, name_norm = EXCLUDED.name_norm, category = EXCLUDED.category,
  category_label = EXCLUDED.category_label, category_group = EXCLUDED.category_group,
  categories = EXCLUDED.categories, brand = EXCLUDED.brand,
  street = EXCLUDED.street, city = EXCLUDED.city, region = EXCLUDED.region, postcode = EXCLUDED.postcode,
  country = EXCLUDED.country, lat = EXCLUDED.lat, lon = EXCLUDED.lon, phones = EXCLUDED.phones,
  websites = EXCLUDED.websites, emails = EXCLUDED.emails, socials = EXCLUDED.socials,
  -- a new domain means the old PageSpeed score is about a different site
  pagespeed_checked_at = CASE WHEN p.domain IS DISTINCT FROM EXCLUDED.domain THEN NULL ELSE p.pagespeed_checked_at END,
  domain = EXCLUDED.domain, opening_hours = EXCLUDED.opening_hours,
  operating_status = EXCLUDED.operating_status, sources = EXCLUDED.sources,
  source_count = EXCLUDED.source_count, quality_score = EXCLUDED.quality_score, quality = EXCLUDED.quality,
  release = EXCLUDED.release, last_seen = current_date, missed_releases = 0, updated_at = now()
"""


def load_csv(dsn: str, csv_path: Path, release: str) -> dict:
    with psycopg.connect(dsn, autocommit=False) as conn:
        cur = conn.cursor()
        cur.execute("INSERT INTO imports (source, release) VALUES ('merged', %s) RETURNING id", (release,))
        import_id = cur.fetchone()[0]
        conn.commit()

        cur.execute(STAGING)
        with open(csv_path, "rb") as f, cur.copy(f"COPY places_staging ({COLUMNS}) FROM STDIN WITH (FORMAT csv, HEADER true)") as cp:
            while chunk := f.read(8 << 20):
                cp.write(chunk)
        cur.execute("SELECT count(*) FROM places_staging")
        rows_in = cur.fetchone()[0]

        cur.execute("""
          DELETE FROM places_staging s USING suppressions x
          WHERE s.id = x.place_id
             OR (x.domain IS NOT NULL AND s.domain = x.domain)
             OR (x.phone_key IS NOT NULL AND x.phone_key = ANY (s.phone_keys))
        """)
        suppressed = cur.rowcount
        cur.execute("SELECT count(*) FROM places_staging s WHERE NOT EXISTS (SELECT 1 FROM places p WHERE p.id = s.id)")
        rows_new = cur.fetchone()[0]
        cur.execute(UPSERT)
        upserted = cur.rowcount
        # Leads absent from two imports in a row have closed or been withdrawn from the sources.
        cur.execute("""UPDATE places p SET missed_releases = missed_releases + 1
                       WHERE NOT EXISTS (SELECT 1 FROM places_staging s WHERE s.id = p.id)""")
        cur.execute("DELETE FROM places WHERE missed_releases >= 2")
        pruned = cur.rowcount
        # Duplicates folded into another lead go straight away.
        dups = csv_path.with_name(csv_path.stem + "-duplicates.csv")
        if dups.exists():
            cur.execute("CREATE TEMP TABLE dup_ids (id text) ON COMMIT DROP")
            with open(dups, "rb") as f, cur.copy("COPY dup_ids FROM STDIN WITH (FORMAT csv, HEADER true)") as cp:
                cp.write(f.read())
            cur.execute("DELETE FROM places p USING dup_ids d WHERE p.id = d.id AND NOT EXISTS (SELECT 1 FROM places_staging s WHERE s.id = d.id)")
            pruned += cur.rowcount
        cur.execute("TRUNCATE places_staging")
        cur.execute("""UPDATE imports SET finished_at = now(), status = 'done', rows_in = %s, rows_new = %s,
                       rows_updated = %s, notes = %s WHERE id = %s""",
                    (rows_in, rows_new, upserted - rows_new, f"suppressed={suppressed} pruned={pruned}", import_id))
        conn.commit()
        cur.execute("ANALYZE places")
        cur.execute(REFRESH_STATS)
        conn.commit()
    stats = {"rows_in": rows_in, "new": rows_new, "updated": upserted - rows_new, "suppressed": suppressed, "pruned": pruned}
    log.info("load: %s", stats)
    return stats
