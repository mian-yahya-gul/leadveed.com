"""Build the Typesense search index from Postgres.

Each run fills a fresh collection, then points the `places` alias at it and
drops the old one, so searches never see a half-built index.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import date, datetime

import psycopg
import requests

log = logging.getLogger(__name__)

ALIAS = "places"


def schema(name: str) -> dict:
    return {
        "name": name,
        "default_sorting_field": "quality_score",
        "token_separators": ["-", "&", "'", "."],
        "fields": [
            {"name": "name", "type": "string", "infix": False},
            {"name": "category", "type": "string", "facet": True, "optional": True},
            {"name": "category_label", "type": "string", "facet": True, "optional": True},
            {"name": "category_group", "type": "string", "facet": True, "optional": True},
            {"name": "categories", "type": "string[]", "facet": True, "optional": True},
            {"name": "brand", "type": "string", "facet": True, "optional": True},
            {"name": "city", "type": "string", "facet": True, "optional": True},
            {"name": "region", "type": "string", "facet": True, "optional": True},
            {"name": "country", "type": "string", "facet": True},
            {"name": "location", "type": "geopoint"},
            {"name": "has_phone", "type": "bool", "facet": True},
            {"name": "has_website", "type": "bool", "facet": True},
            {"name": "has_email", "type": "bool", "facet": True},
            {"name": "has_socials", "type": "bool", "facet": True},
            {"name": "quality_score", "type": "int32", "facet": True},
            {"name": "pagespeed", "type": "int32", "optional": True, "facet": True},
            {"name": "source_count", "type": "int32"},
            {"name": "first_seen", "type": "int64"},
            {"name": "street", "type": "string", "optional": True, "index": False},
            {"name": "domain", "type": "string", "optional": True, "facet": True},
        ],
    }


SELECT = """
SELECT id, name, category, category_label, category_group, categories, brand, city, region, country, lat, lon,
       cardinality(phones) > 0, (domain IS NOT NULL OR cardinality(websites) > 0), cardinality(emails) > 0,
       cardinality(socials) > 0, quality_score, pagespeed_mobile, source_count, first_seen, street, domain
FROM places
"""


def _doc(r) -> dict:
    (id_, name, category, label, group, cats, brand, city, region, country, lat, lon, has_phone, has_site,
     has_email, has_socials, quality, speed, sources, first_seen, street, domain) = r
    d = {
        "id": id_, "name": name, "category": category, "category_label": label, "category_group": group,
        "categories": list(cats or []), "brand": brand, "city": city, "region": region, "country": country or "",
        "location": [lat, lon], "has_phone": bool(has_phone), "has_website": bool(has_site),
        "has_email": bool(has_email), "has_socials": bool(has_socials), "quality_score": int(quality or 0),
        "pagespeed": speed, "source_count": int(sources or 1),
        "first_seen": int(datetime.combine(first_seen, datetime.min.time()).timestamp()) if isinstance(first_seen, date) else 0,
        "street": street, "domain": domain,
    }
    return {k: v for k, v in d.items() if v is not None}


class Typesense:
    def __init__(self, url: str, api_key: str):
        self.url = url.rstrip("/")
        self.s = requests.Session()
        self.s.headers["X-TYPESENSE-API-KEY"] = api_key

    def req(self, method: str, path: str, **kw):
        r = self.s.request(method, self.url + path, timeout=kw.pop("timeout", 120), **kw)
        if r.status_code >= 400:
            raise RuntimeError(f"Typesense {method} {path}: {r.status_code} {r.text[:500]}")
        return r


def rebuild(dsn: str, ts_url: str, ts_key: str, batch: int = 20_000, where: str | None = None) -> int:
    ts = Typesense(ts_url, ts_key)
    name = f"places_{int(time.time())}"
    ts.req("POST", "/collections", json=schema(name))
    total = 0
    with psycopg.connect(dsn) as conn, conn.cursor(name="ts_export") as cur:
        cur.itersize = batch
        cur.execute(SELECT + (f" WHERE {where}" if where else ""))
        while rows := cur.fetchmany(batch):
            body = "\n".join(json.dumps(_doc(r), ensure_ascii=False) for r in rows)
            res = ts.req("POST", f"/collections/{name}/documents/import?action=upsert&batch_size=2000",
                         data=body.encode(), headers={"Content-Type": "text/plain"}, timeout=600)
            failed = [ln for ln in res.text.splitlines() if '"success":false' in ln]
            if failed:
                log.warning("index: %d docs failed in batch, first: %s", len(failed), failed[0][:300])
            total += len(rows)
            log.info("index: %s docs", f"{total:,}")
    old = None
    try:
        old = ts.req("GET", f"/aliases/{ALIAS}").json().get("collection_name")
    except RuntimeError:
        pass
    ts.req("PUT", f"/aliases/{ALIAS}", json={"collection_name": name})
    if old and old != name:
        ts.req("DELETE", f"/collections/{old}")
    log.info("index: alias %s -> %s (%s docs)", ALIAS, name, f"{total:,}")
    return total


def upsert_ids(dsn: str, ts_url: str, ts_key: str, ids: list[str]) -> None:
    """Refresh a handful of documents, e.g. after a PageSpeed check or a removal."""
    if not ids:
        return
    ts = Typesense(ts_url, ts_key)
    with psycopg.connect(dsn) as conn:
        rows = conn.execute(SELECT + " WHERE id = ANY(%s)", (ids,)).fetchall()
    found = {r[0] for r in rows}
    if rows:
        body = "\n".join(json.dumps(_doc(r), ensure_ascii=False) for r in rows)
        ts.req("POST", f"/collections/{ALIAS}/documents/import?action=upsert", data=body.encode(),
               headers={"Content-Type": "text/plain"})
    for gone in set(ids) - found:
        try:
            ts.req("DELETE", f"/collections/{ALIAS}/documents/{gone}")
        except RuntimeError:
            pass
