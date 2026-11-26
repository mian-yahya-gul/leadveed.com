import json
import zipfile

import pyarrow.parquet as pq

from leadveed_pipeline.alltheplaces import feature_to_row, flatten_zip


def feat(**props):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [55.27, 25.2]},
            "properties": {"@spider": "test_spider", "ref": "1", **props}}


def test_feature_fields():
    r = feature_to_row(feat(name="Test Cafe", amenity="cafe", phone="+971 4 000 0000;+971 50 000 0000",
                            website="https://test.example", **{"addr:city": "Dubai", "addr:country": "ae",
                                                              "addr:street_address": "1 Test St"}))
    assert r["name"] == "Test Cafe" and r["category"] == "cafe" and r["category_key"] == "amenity"
    assert r["phones"] == ["+971 4 000 0000", "+971 50 000 0000"]
    assert r["country"] == "AE" and r["street"] == "1 Test St" and (r["lat"], r["lon"]) == (25.2, 55.27)


def test_rejects_bad_geometry_and_nameless():
    assert feature_to_row({"geometry": None, "properties": {"name": "x"}}) is None
    assert feature_to_row(feat()) is None


def test_flatten_zip_filters_countries(tmp_path):
    z = tmp_path / "out.zip"
    with zipfile.ZipFile(z, "w") as f:
        f.writestr("output/a.geojson", json.dumps({"type": "FeatureCollection", "features": [
            feat(name="A", **{"addr:country": "AE"}), feat(name="B", **{"addr:country": "PK"})]}))
    n = flatten_zip(z, tmp_path / "o.parquet", ["PK"])
    assert n == 1 and pq.read_table(tmp_path / "o.parquet").column("name").to_pylist() == ["B"]
