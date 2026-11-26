"""Write a synthetic Overture-shaped Parquet file for CI (fake test businesses, not real data).

    python pipeline/tests/make_fixture.py /tmp/fixture.parquet
"""
import sys

import duckdb

out = sys.argv[1] if len(sys.argv) > 1 else "fixture.parquet"
duckdb.sql(f"""
COPY (
  SELECT
    'fx-' || i AS id,
    {{'primary': 'Test Business ' || i}} AS names,
    {{'names': {{'primary': NULL::VARCHAR}}}} AS brand,
    0.5 + (i % 50) / 100.0 AS confidence,
    CASE WHEN i % 3 = 0 THEN NULL ELSE ['https://test' || i || '.example.com'] END AS websites,
    CASE WHEN i % 4 = 0 THEN ['info@test' || i || '.example.com'] ELSE NULL END AS emails,
    CASE WHEN i % 5 = 0 THEN ['https://www.facebook.com/' || i] ELSE NULL END AS socials,
    CASE WHEN i % 7 = 0 THEN NULL ELSE ['+92300' || lpad(i::VARCHAR, 7, '0')] END AS phones,
    [{{'freeform': i || ' Test Road', 'locality': CASE WHEN i % 2 = 0 THEN 'Lahore' ELSE 'Dubai' END,
       'postcode': '54000', 'region': NULL::VARCHAR, 'country': CASE WHEN i % 2 = 0 THEN 'PK' ELSE 'AE' END}}] AS addresses,
    [{{'dataset': 'meta', 'update_time': '2026-11-01T00:00:00Z'}}] AS sources,
    NULL::VARCHAR AS operating_status,
    'dental_clinic' AS basic_category,
    {{'primary': CASE WHEN i % 2 = 0 THEN 'dental_clinic' ELSE 'cafe' END,
      'hierarchy': CASE WHEN i % 2 = 0 THEN ['health_care', 'dental_clinic'] ELSE ['food_and_drink', 'cafe'] END}} AS taxonomy,
    {{'xmin': lon, 'xmax': lon, 'ymin': lat, 'ymax': lat}} AS bbox
  FROM (
    SELECT i,
      CASE WHEN i % 2 = 0 THEN 74.30 + (i % 97) * 0.001 ELSE 55.20 + (i % 89) * 0.001 END AS lon,
      CASE WHEN i % 2 = 0 THEN 31.50 + (i % 83) * 0.001 ELSE 25.10 + (i % 79) * 0.001 END AS lat
    FROM range(1, 3001) t(i)
  )
) TO '{out}' (FORMAT parquet)
""")
print("wrote", out)
