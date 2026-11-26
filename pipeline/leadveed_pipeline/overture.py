"""Download Overture Maps places for a release.

Reads the public GeoParquet files on S3 anonymously with pyarrow and streams
them into one local Parquet file, keeping only the columns LeadVeed needs and,
optionally, only the countries you ask for. No AWS account is needed.

Licence: Overture Maps places are CDLA-Permissive-2.0. Attribution is shown in
the site footer and on /data-licensing.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.dataset as ds
import pyarrow.fs as pafs
import pyarrow.parquet as pq

log = logging.getLogger(__name__)

BUCKET = "overturemaps-us-west-2"
REGION = "us-west-2"
COLUMNS = [
    "id", "names", "brand", "confidence", "websites", "emails", "socials", "phones",
    "addresses", "sources", "operating_status", "basic_category", "taxonomy", "bbox",
]


def _fs() -> pafs.S3FileSystem:
    return pafs.S3FileSystem(anonymous=True, region=REGION)


def latest_release(fs: pafs.S3FileSystem | None = None) -> str:
    """Return the newest release name, e.g. '2026-11-18.0'."""
    fs = fs or _fs()
    infos = fs.get_file_info(pafs.FileSelector(f"{BUCKET}/release/", recursive=False))
    names = sorted(
        Path(i.path).name for i in infos
        if i.type == pafs.FileType.Directory and re.match(r"^\d{4}-\d{2}-\d{2}\.\d+$", Path(i.path).name)
    )
    if not names:
        raise RuntimeError("No Overture releases found on S3")
    return names[-1]


def _country_mask(addr, wanted: pa.Array) -> pa.Array:
    """True where addresses[0].country is in `wanted` (vectorised, null safe)."""
    if isinstance(addr, pa.ChunkedArray):
        addr = addr.combine_chunks()
    offsets = addr.offsets.to_numpy(zero_copy_only=False)
    lengths = np.diff(offsets)
    valid = addr.is_valid().to_numpy(zero_copy_only=False) & (lengths > 0)
    first = np.where(valid, offsets[:-1], 0)
    countries = pc.struct_field(addr.values, "country")
    if len(countries) == 0:
        return pa.array(np.zeros(len(addr), dtype=bool))
    picked = pc.take(countries, pa.array(first, type=pa.int64()))
    hit = pc.fill_null(pc.is_in(picked, value_set=wanted), False).to_numpy(zero_copy_only=False)
    return pa.array(hit & valid)


def download(release: str, out: Path, countries: list[str] | None = None,
             bbox: tuple[float, float, float, float] | None = None) -> int:
    """Stream the places theme for `release` into `out`. Returns rows written.

    countries: ISO-3166 alpha-2 codes. Rows whose first address country is in
               the list are kept (all rows when None).
    bbox:      (xmin, ymin, xmax, ymax), mostly useful for small test pulls.
    """
    fs = _fs()
    path = f"{BUCKET}/release/{release}/theme=places/type=place/"
    dataset = ds.dataset(path, filesystem=fs, format="parquet")
    flt = None
    if bbox:
        x0, y0, x1, y1 = bbox
        flt = ((ds.field(("bbox", "xmin")) >= x0) & (ds.field(("bbox", "xmax")) <= x1)
               & (ds.field(("bbox", "ymin")) >= y0) & (ds.field(("bbox", "ymax")) <= y1))
    wanted = pa.array([c.upper() for c in countries]) if countries else None

    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".part")
    writer: pq.ParquetWriter | None = None
    total = 0
    scanner = dataset.scanner(columns=COLUMNS, filter=flt, batch_size=200_000, use_threads=True)
    for batch in scanner.to_batches():
        if batch.num_rows == 0:
            continue
        if wanted is not None:
            batch = batch.filter(_country_mask(batch.column("addresses"), wanted))
            if batch.num_rows == 0:
                continue
        table = pa.Table.from_batches([batch])
        if writer is None:
            writer = pq.ParquetWriter(tmp, table.schema, compression="zstd")
        writer.write_table(table)
        total += table.num_rows
        if total and total % 1_000_000 < batch.num_rows:
            log.info("overture: %s rows so far", f"{total:,}")
    if writer is None:
        raise RuntimeError("Overture download matched no rows")
    writer.close()
    tmp.replace(out)
    log.info("overture: wrote %s rows to %s", f"{total:,}", out)
    return total
