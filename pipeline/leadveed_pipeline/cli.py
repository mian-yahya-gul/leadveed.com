"""LeadVeed data pipeline.

  leadveed-pipeline run                 # full monthly import: download, merge, load, index
  leadveed-pipeline run --skip-download # re-merge files already on disk
  leadveed-pipeline check               # print latest releases and whether an import is due
  leadveed-pipeline index               # rebuild Typesense from Postgres only

Settings come from environment variables (see infra/oracle/leadveed.env.example):
  DATABASE_URL, TYPESENSE_URL, TYPESENSE_API_KEY, LEADVEED_DATA_DIR,
  LEADVEED_COUNTRIES (comma list, empty = whole world), LEADVEED_MIN_CONFIDENCE,
  DUCKDB_MEMORY_LIMIT
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import sys
from pathlib import Path

from . import alltheplaces, index, load, merge, overture

log = logging.getLogger("leadveed")


def env_countries() -> list[str] | None:
    raw = os.environ.get("LEADVEED_COUNTRIES", "").strip()
    return [c.strip().upper() for c in raw.split(",") if c.strip()] or None


def state_path(data_dir: Path) -> Path:
    return data_dir / "state.json"


def read_state(data_dir: Path) -> dict:
    p = state_path(data_dir)
    return json.loads(p.read_text()) if p.exists() else {}


def write_state(data_dir: Path, st: dict) -> None:
    state_path(data_dir).write_text(json.dumps(st, indent=2))


def cmd_check(args) -> int:
    data_dir = Path(args.data_dir)
    st = read_state(data_dir)
    ov = overture.latest_release()
    print(json.dumps({"overture_latest": ov, "overture_imported": st.get("overture"),
                      "import_due": ov != st.get("overture")}, indent=2))
    return 0


def cmd_run(args) -> int:
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    countries = env_countries()
    st = read_state(data_dir)

    release = args.release or overture.latest_release()
    if not args.force and st.get("overture") == release and not args.skip_download:
        log.info("Overture %s already imported; use --force to redo", release)
        return 0

    ov_file = Path(args.overture_file) if args.overture_file else data_dir / "overture" / f"{release}.parquet"
    if not args.skip_download and not args.overture_file:
        overture.download(release, ov_file, countries)

    atp_file = Path(args.atp_file) if args.atp_file else None
    atp_run = None
    if not atp_file and not args.no_atp:
        try:
            atp_run, atp_file, _ = alltheplaces.download(data_dir, countries)
        except Exception as e:  # ATP is a bonus source; Overture alone is still a good import
            log.error("All The Places download failed, continuing with Overture only: %s", e)

    db = data_dir / "work.duckdb"
    if db.exists():
        db.unlink()
    con = merge.connect(db, memory_limit=os.environ.get("DUCKDB_MEMORY_LIMIT", "12GB"))
    stats = merge.run(con, [ov_file], atp_file, countries,
                      float(os.environ.get("LEADVEED_MIN_CONFIDENCE", "0.3")))
    csv_path = data_dir / "out" / f"leads-{release}.csv"
    merge.export_csv(con, csv_path, release)
    con.close()
    db.unlink(missing_ok=True)
    shutil.rmtree(data_dir / "duckdb_tmp", ignore_errors=True)

    if args.skip_load:
        log.info("Skipping load (--skip-load). CSV at %s", csv_path)
        return 0
    stats["load"] = load.load_csv(os.environ["DATABASE_URL"], csv_path, release)
    if os.environ.get("TYPESENSE_URL"):
        stats["indexed"] = index.rebuild(os.environ["DATABASE_URL"], os.environ["TYPESENSE_URL"],
                                         os.environ["TYPESENSE_API_KEY"])
    csv_path.unlink(missing_ok=True)
    merge.dup_path(csv_path).unlink(missing_ok=True)
    # keep only the newest Overture download to save disk
    for old in (data_dir / "overture").glob("*.parquet"):
        if old != ov_file:
            old.unlink()
    st.update({"overture": release, "alltheplaces": atp_run, "last_stats": stats})
    write_state(data_dir, st)
    log.info("Import finished: %s", json.dumps(stats, default=str))
    return 0


def cmd_index(args) -> int:
    index.rebuild(os.environ["DATABASE_URL"], os.environ["TYPESENSE_URL"], os.environ["TYPESENSE_API_KEY"])
    return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    p = argparse.ArgumentParser(prog="leadveed-pipeline")
    p.add_argument("--data-dir", default=os.environ.get("LEADVEED_DATA_DIR", "/srv/leadveed/data"))
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="download, merge, load and index")
    r.add_argument("--release", help="Overture release, default latest")
    r.add_argument("--overture-file", help="use a local Overture parquet instead of downloading")
    r.add_argument("--atp-file", help="use a local flattened All The Places parquet")
    r.add_argument("--no-atp", action="store_true", help="skip All The Places")
    r.add_argument("--skip-download", action="store_true")
    r.add_argument("--skip-load", action="store_true")
    r.add_argument("--force", action="store_true")
    r.set_defaults(fn=cmd_run)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    sub.add_parser("index").set_defaults(fn=cmd_index)
    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
