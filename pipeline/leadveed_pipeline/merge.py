"""Run the DuckDB merge over local Parquet files and export a Postgres-ready CSV."""
from __future__ import annotations

import logging
from importlib import resources
from pathlib import Path

import duckdb

log = logging.getLogger(__name__)

ATP_EMPTY = """
CREATE OR REPLACE TABLE atp_raw (
  ref VARCHAR, spider VARCHAR, name VARCHAR, brand VARCHAR, brand_wikidata VARCHAR,
  category VARCHAR, category_key VARCHAR, street VARCHAR, city VARCHAR, region VARCHAR,
  postcode VARCHAR, country VARCHAR, lat DOUBLE, lon DOUBLE, phones VARCHAR[], websites VARCHAR[],
  emails VARCHAR[], socials VARCHAR[], opening_hours VARCHAR)
"""


def _sql(name: str) -> str:
    return resources.files("leadveed_pipeline").joinpath("sql", name).read_text()


def _q(path: Path | str) -> str:
    return "'" + str(path).replace("'", "''") + "'"


def connect(db_path: Path | None = None, memory_limit: str = "12GB", threads: int | None = None) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(str(db_path) if db_path else ":memory:")
    con.execute(f"SET memory_limit = '{memory_limit}'")
    con.execute("SET preserve_insertion_order = false")
    if threads:
        con.execute(f"SET threads = {int(threads)}")
    if db_path:
        con.execute(f"SET temp_directory = {_q(Path(db_path).parent / 'duckdb_tmp')}")
    con.execute(_sql("macros.sql"))
    return con


def run(con: duckdb.DuckDBPyConnection, overture_files: list[Path], atp_file: Path | None,
        countries: list[str] | None = None, min_confidence: float = 0.3) -> dict:
    files = "[" + ", ".join(_q(f) for f in overture_files) + "]"
    con.execute(f"CREATE OR REPLACE VIEW overture_raw AS SELECT * FROM read_parquet({files}, union_by_name = true)")
    con.execute(f"SET VARIABLE min_confidence = {float(min_confidence)}")
    con.execute(_sql("normalize_overture.sql"))
    if atp_file and Path(atp_file).exists():
        con.execute(f"CREATE OR REPLACE TABLE atp_raw AS SELECT * FROM read_parquet({_q(atp_file)})")
    else:
        log.warning("merge: no All The Places file, merging Overture only")
        con.execute(ATP_EMPTY)
    if countries:
        cl = "[" + ", ".join(_q(c.upper()) for c in countries) + "]"
        con.execute(f"DELETE FROM ov WHERE NOT list_contains({cl}, country)")
        con.execute(f"DELETE FROM atp_raw WHERE NOT list_contains({cl}, country)")
    con.execute(_sql("merge.sql"))
    stats = con.execute("""
        SELECT
          (SELECT count(*) FROM ov) AS overture_in,
          (SELECT count(*) FROM ov_d) AS overture_after_dedupe,
          (SELECT count(*) FROM atp_raw) AS atp_in,
          (SELECT count(*) FROM matches) AS matched,
          (SELECT count(*) FROM leads) AS leads_out,
          (SELECT round(avg(quality_score), 1) FROM leads) AS avg_quality
    """).fetchone()
    keys = ["overture_in", "overture_after_dedupe", "atp_in", "matched", "leads_out", "avg_quality"]
    result = dict(zip(keys, stats))
    log.info("merge: %s", result)
    return result


PG_ARRAY = """'{' || array_to_string(['"' || replace(replace(e, '\\', '\\\\'), '"', '\\"') || '"' FOR e IN coalesce({col}, []) IF e IS NOT NULL], ',') || '}'"""


def export_csv(con: duckdb.DuckDBPyConnection, out: Path, release: str) -> Path:
    """Write leads as CSV matching the `places_staging` table used by load.py."""
    out.parent.mkdir(parents=True, exist_ok=True)
    arr = lambda c: PG_ARRAY.replace("{col}", c)  # noqa: E731
    con.execute(f"""
      COPY (
        SELECT id, name, name_norm, category, category_label, category_group, {arr('categories')} AS categories,
          brand, street, city, region,
          postcode, country, lat, lon,
          {arr('phones')} AS phones, {arr('websites')} AS websites, {arr('emails')} AS emails,
          {arr('socials')} AS socials, domain, opening_hours, operating_status,
          to_json([x FOR x IN [
            CASE WHEN ov_id IS NOT NULL THEN {{'dataset': 'overture', 'id': ov_id, 'confidence': round(confidence, 3)}}::JSON END,
            CASE WHEN atp_id IS NOT NULL THEN {{'dataset': 'alltheplaces', 'spider': spider, 'ref': ref}}::JSON END
          ] IF x IS NOT NULL]) AS sources,
          source_count, quality_score, to_json(quality) AS quality,
          {arr('pkeys')} AS phone_keys, {_q(release)} AS release
        FROM leads
      ) TO {_q(out)} (FORMAT csv, HEADER true)
    """)
    # ids that the de-duplication folded into another lead; the loader deletes them
    con.execute(f"""COPY (SELECT DISTINCT 'lv_' || substr(md5(src_id), 1, 16) AS id FROM ov_k
                         WHERE src_id NOT IN (SELECT src_id FROM ov_d)) TO {_q(dup_path(out))} (FORMAT csv, HEADER true)""")
    log.info("merge: exported %s", out)
    return out


def dup_path(csv_path: Path) -> Path:
    return csv_path.with_name(csv_path.stem + "-duplicates.csv")
