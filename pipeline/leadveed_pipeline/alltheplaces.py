"""Download the latest All The Places run and flatten it to Parquet.

All The Places (https://www.alltheplaces.xyz) runs open-source spiders over
brands' own store locators every week and publishes the output under CC0.
It is first-party data, so it is often fresher than other sources for phone
numbers, websites and opening hours of chain and franchise locations.
"""
from __future__ import annotations

import json
import logging
import zipfile
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import requests

log = logging.getLogger(__name__)

LATEST_URL = "https://data.alltheplaces.xyz/runs/latest.json"
UA = "LeadVeedImporter/1.0 (+https://leadveed.com/data-licensing)"

# OSM-style tags ATP uses to say what a place is, most specific first.
CATEGORY_KEYS = ["amenity", "shop", "healthcare", "craft", "office", "leisure", "tourism", "club", "emergency"]
SOCIAL_KEYS = ["facebook", "twitter", "instagram", "contact:facebook", "contact:instagram", "contact:twitter",
               "contact:linkedin", "contact:tiktok", "contact:youtube"]

SCHEMA = pa.schema([
    ("ref", pa.string()), ("spider", pa.string()), ("name", pa.string()), ("brand", pa.string()),
    ("brand_wikidata", pa.string()), ("category", pa.string()), ("category_key", pa.string()), ("street", pa.string()),
    ("city", pa.string()), ("region", pa.string()), ("postcode", pa.string()), ("country", pa.string()),
    ("lat", pa.float64()), ("lon", pa.float64()), ("phones", pa.list_(pa.string())),
    ("websites", pa.list_(pa.string())), ("emails", pa.list_(pa.string())),
    ("socials", pa.list_(pa.string())), ("opening_hours", pa.string()),
])


def latest_run() -> dict:
    r = requests.get(LATEST_URL, headers={"User-Agent": UA}, timeout=60)
    r.raise_for_status()
    return r.json()


def _download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        log.info("alltheplaces: using cached %s", dest)
        return dest
    tmp = dest.with_suffix(".part")
    with requests.get(url, headers={"User-Agent": UA}, stream=True, timeout=600) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(chunk_size=8 << 20):
                f.write(chunk)
    tmp.replace(dest)
    return dest


def _split(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        out = []
        for v in value:
            out.extend(_split(v))
        return out
    return [p.strip() for p in str(value).split(";") if p.strip()]


def _street(p: dict) -> str | None:
    if p.get("addr:street_address"):
        return p["addr:street_address"]
    parts = [p.get("addr:housenumber"), p.get("addr:street")]
    joined = " ".join(str(x) for x in parts if x)
    return joined or p.get("addr:full") or None


def feature_to_row(feat: dict, spider_hint: str | None = None) -> dict | None:
    geom = feat.get("geometry") or {}
    if geom.get("type") != "Point":
        return None
    try:
        lon, lat = float(geom["coordinates"][0]), float(geom["coordinates"][1])
    except (KeyError, IndexError, TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180) or (lat == 0 and lon == 0):
        return None
    p = feat.get("properties") or {}
    name = p.get("name") or p.get("brand")
    if not name:
        return None
    category = category_key = None
    for k in CATEGORY_KEYS:
        if p.get(k) and p.get(k) != "yes":
            category, category_key = str(p[k]).split(";")[0].strip(), k
            break
    country = (p.get("addr:country") or "").strip().upper()[:2] or None
    return {
        "ref": str(p.get("ref") or feat.get("id") or ""),
        "spider": p.get("@spider") or spider_hint,
        "name": str(name).strip(),
        "brand": p.get("brand"),
        "brand_wikidata": p.get("brand:wikidata"),
        "category": category,
        "category_key": category_key,
        "street": _street(p),
        "city": p.get("addr:city"),
        "region": p.get("addr:state") or p.get("addr:province"),
        "postcode": p.get("addr:postcode"),
        "country": country,
        "lat": lat,
        "lon": lon,
        "phones": _split(p.get("phone")) + _split(p.get("contact:phone")),
        "websites": _split(p.get("website")) + _split(p.get("contact:website")),
        "emails": _split(p.get("email")) + _split(p.get("contact:email")),
        "socials": [s for k in SOCIAL_KEYS for s in _split(p.get(k))],
        "opening_hours": p.get("opening_hours"),
    }


def flatten_zip(zip_path: Path, out: Path, countries: list[str] | None = None) -> int:
    wanted = {c.upper() for c in countries} if countries else None
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".part")
    writer = pq.ParquetWriter(tmp, SCHEMA, compression="zstd")
    buf: list[dict] = []
    total = 0
    with zipfile.ZipFile(zip_path) as z:
        members = [m for m in z.namelist() if m.endswith(".geojson")]
        for i, m in enumerate(members):
            spider = Path(m).stem
            try:
                with z.open(m) as f:
                    data = json.load(f)
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                log.warning("alltheplaces: skipping %s (%s)", m, e)
                continue
            for feat in data.get("features", []):
                row = feature_to_row(feat, spider)
                if row is None:
                    continue
                if wanted is not None and row["country"] not in wanted:
                    continue
                buf.append(row)
            if len(buf) >= 200_000:
                writer.write_table(pa.Table.from_pylist(buf, schema=SCHEMA))
                total += len(buf)
                buf.clear()
            if i % 500 == 0:
                log.info("alltheplaces: %d/%d spiders, %s rows", i, len(members), f"{total + len(buf):,}")
    if buf:
        writer.write_table(pa.Table.from_pylist(buf, schema=SCHEMA))
        total += len(buf)
    writer.close()
    tmp.replace(out)
    log.info("alltheplaces: wrote %s rows to %s", f"{total:,}", out)
    return total


def download(data_dir: Path, countries: list[str] | None = None) -> tuple[str, Path, int]:
    run = latest_run()
    run_id = run.get("run_id") or Path(run["output_url"]).parent.name
    zip_path = _download(run["output_url"], data_dir / "alltheplaces" / f"{run_id}.zip")
    out = data_dir / "alltheplaces" / f"{run_id}.parquet"
    rows = flatten_zip(zip_path, out, countries)
    return run_id, out, rows
