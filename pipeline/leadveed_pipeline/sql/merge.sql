-- Merge Overture (table ov) with All The Places (table atp_raw) into one deduplicated
-- set of leads with a quality score. Output table: leads.
--
-- 1. Normalise names, phones and website domains on both sides.
-- 2. Drop obvious duplicates inside Overture (same normalised name in the same
--    ~220 m cell sharing a phone or domain, or having neither).
-- 3. Match each All The Places record to at most one Overture record nearby,
--    by phone, by website domain plus a similar name, or by a very similar name.
-- 4. Matched pairs merge field by field. Unmatched records from both sources stay.
-- 5. Score every lead 0..100 on completeness and corroboration.

-- 1 ------------------------------------------------------------------------
CREATE OR REPLACE TABLE ov_k AS
SELECT *,
  norm_name(name) AS name_norm,
  list_distinct([k FOR k IN [phone_key(p) FOR p IN phones] IF k IS NOT NULL]) AS pkeys,
  [d FOR d IN [site_domain(w) FOR w IN websites] IF d IS NOT NULL][1] AS domain,
  cell(lat) AS clat, cell(lon) AS clon
FROM ov;

CREATE OR REPLACE TABLE atp_k AS
SELECT *,
  norm_name(name) AS name_norm,
  list_distinct([k FOR k IN [phone_key(p) FOR p IN phones] IF k IS NOT NULL]) AS pkeys,
  [d FOR d IN [site_domain(w) FOR w IN websites] IF d IS NOT NULL][1] AS domain,
  cell(lat) AS clat, cell(lon) AS clon,
  'atp:' || coalesce(spider, '') || ':' || coalesce(ref, '') AS src_id
FROM atp_raw
WHERE name IS NOT NULL;

-- 2 ------------------------------------------------------------------------
CREATE OR REPLACE TABLE ov_d AS
SELECT * EXCLUDE (rn) FROM (
  SELECT *, row_number() OVER (
    PARTITION BY name_norm, clat, clon, coalesce(pkeys[1], domain, '')
    ORDER BY confidence DESC, len(phones) + len(websites) + len(emails) DESC, src_id) AS rn
  FROM ov_k
) WHERE rn = 1;

-- Same name, same phone and same street is one business even when the two copies
-- were geocoded kilometres apart (it happens). Chains that share a hotline have
-- different streets, so they are left alone.
DELETE FROM ov_d WHERE src_id IN (
  SELECT src_id FROM (
    SELECT src_id, row_number() OVER (
      PARTITION BY country, name_norm, pkeys[1], regexp_replace(lower(street), '[^a-z0-9]', '', 'g')
      ORDER BY confidence DESC, src_id) AS rn
    FROM ov_d WHERE len(pkeys) > 0 AND street IS NOT NULL
  ) WHERE rn > 1
);

-- 3 ------------------------------------------------------------------------
CREATE OR REPLACE TABLE cand AS
WITH a AS (
  SELECT a.*, a.clat + dy AS jlat, a.clon + dx AS jlon
  FROM atp_k a, (SELECT unnest([-1, 0, 1]) AS dy) y, (SELECT unnest([-1, 0, 1]) AS dx) x
)
SELECT
  a.src_id AS atp_id, o.src_id AS ov_id,
  dist_m(a.lat, a.lon, o.lat, o.lon) AS dist,
  jaro_winkler_similarity(a.name_norm, o.name_norm) AS sim,
  len(list_intersect(a.pkeys, o.pkeys)) > 0 AS phone_match,
  (a.domain IS NOT NULL AND a.domain = o.domain) AS domain_match
FROM a JOIN ov_d o ON o.clat = a.jlat AND o.clon = a.jlon;

CREATE OR REPLACE TABLE matches AS
WITH ok AS (
  SELECT *,
    (phone_match::INT * 4) + (domain_match::INT * 2) + (sim >= 0.9)::INT * 2 + (sim >= 0.8)::INT
      + (dist < 50)::INT AS mscore
  FROM cand
  WHERE (phone_match AND dist < 300)
     OR (domain_match AND sim >= 0.7 AND dist < 300)
     OR (sim >= 0.9 AND dist < 120)
),
best_a AS (
  SELECT * FROM ok QUALIFY row_number() OVER (PARTITION BY atp_id ORDER BY mscore DESC, dist) = 1
)
SELECT * FROM best_a QUALIFY row_number() OVER (PARTITION BY ov_id ORDER BY mscore DESC, dist) = 1;

-- 4 ------------------------------------------------------------------------
CREATE OR REPLACE TABLE leads_pre AS
-- matched: Overture supplies identity and category, ATP (first-party) wins on contact details
SELECT
  o.src_id AS ov_id, a.src_id AS atp_id,
  coalesce(o.name, a.name) AS name, o.name_norm,
  coalesce(o.brand, a.brand) AS brand,
  coalesce(o.category, a.category) AS category,
  o.category_group,
  coalesce(o.categories, [a.category]) AS categories,
  coalesce(a.street, o.street) AS street,
  coalesce(o.city, a.city) AS city,
  coalesce(o.region, a.region) AS region,
  coalesce(a.postcode, o.postcode) AS postcode,
  coalesce(o.country, a.country) AS country,
  a.lat, a.lon,
  list_distinct(list_concat(a.phones, o.phones)) AS phones,
  list_distinct(list_concat(a.websites, o.websites)) AS websites,
  list_distinct(list_concat(a.emails, o.emails)) AS emails,
  list_distinct(list_concat(a.socials, o.socials)) AS socials,
  coalesce(a.domain, o.domain) AS domain,
  a.opening_hours,
  o.operating_status,
  o.confidence,
  o.datasets,
  o.source_updated,
  a.spider, a.ref,
  2 AS source_count
FROM matches m
JOIN ov_d o ON o.src_id = m.ov_id
JOIN atp_k a ON a.src_id = m.atp_id
UNION ALL
SELECT
  o.src_id, NULL, o.name, o.name_norm, o.brand, o.category, o.category_group, o.categories, o.street, o.city, o.region,
  o.postcode, o.country, o.lat, o.lon, o.phones, o.websites, o.emails, o.socials, o.domain, NULL,
  o.operating_status, o.confidence, o.datasets, o.source_updated, NULL, NULL,
  -- Overture itself conflates several upstream datasets; more than one counts as corroboration.
  CASE WHEN len([d FOR d IN o.datasets IF d <> 'Overture']) > 1 THEN 2 ELSE 1 END
FROM ov_d o WHERE o.src_id NOT IN (SELECT ov_id FROM matches)
UNION ALL
SELECT
  NULL, a.src_id, a.name, a.name_norm, a.brand, a.category,
  CASE
    WHEN a.category_key = 'amenity' AND a.category IN ('restaurant','fast_food','cafe','bar','pub','ice_cream','food_court','biergarten') THEN 'food_and_drink'
    WHEN a.category_key = 'amenity' AND a.category IN ('pharmacy','dentist','doctors','clinic','hospital','veterinary') THEN 'health_care'
    WHEN a.category_key = 'amenity' AND a.category IN ('fuel','car_wash','charging_station','car_rental','parking') THEN 'travel_and_transportation'
    WHEN a.category_key = 'amenity' AND a.category IN ('bank','atm','bureau_de_change','post_office','money_transfer') THEN 'services_and_business'
    WHEN a.category_key = 'amenity' AND a.category IN ('school','kindergarten','college','university','driving_school','language_school') THEN 'education'
    WHEN a.category_key = 'shop' THEN 'shopping'
    WHEN a.category_key = 'healthcare' THEN 'health_care'
    WHEN a.category_key = 'tourism' AND a.category IN ('hotel','motel','hostel','guest_house','apartment') THEN 'lodging'
    WHEN a.category_key = 'leisure' THEN 'sports_and_recreation'
    WHEN a.category_key IN ('office','craft') THEN 'services_and_business'
  END,
  [c FOR c IN [a.category] IF c IS NOT NULL],
  a.street, a.city, a.region, a.postcode, a.country, a.lat, a.lon, a.phones, a.websites, a.emails,
  a.socials, a.domain, a.opening_hours, NULL, NULL, ['alltheplaces'], NULL, a.spider, a.ref, 1
FROM atp_k a WHERE a.src_id NOT IN (SELECT atp_id FROM matches);

-- 4b -----------------------------------------------------------------------
-- City repair: sources disagree on city names (local script, districts, blanks).
-- Within each ~11 km cell, rows with no city or a non-Latin city take the most
-- common Latin-script city of that cell, so "Dubai" search finds "دبي" rows too.
CREATE OR REPLACE TABLE city_mode AS
SELECT country, floor(lat / 0.1)::BIGINT AS glat, floor(lon / 0.1)::BIGINT AS glon,
       mode(clean_city(city)) AS city_fix
FROM leads_pre
WHERE clean_city(city) IS NOT NULL AND is_latin(clean_city(city))
GROUP BY ALL;

CREATE OR REPLACE TABLE leads_city AS
SELECT p.* REPLACE (
  CASE WHEN clean_city(p.city) IS NULL OR NOT is_latin(clean_city(p.city))
       THEN coalesce(m.city_fix, clean_city(p.city)) ELSE clean_city(p.city) END AS city)
FROM leads_pre p
LEFT JOIN city_mode m ON m.country = p.country
  AND m.glat = floor(p.lat / 0.1)::BIGINT AND m.glon = floor(p.lon / 0.1)::BIGINT;

-- 5 ------------------------------------------------------------------------
CREATE OR REPLACE TABLE leads AS
WITH s AS (
  SELECT *,
    -- 0..25 from Overture's own confidence; first-party ATP-only records get a flat 20.
    CASE WHEN confidence IS NOT NULL THEN round(confidence * 25) WHEN atp_id IS NOT NULL THEN 20 ELSE 10 END AS q_confidence,
    CASE WHEN len(phones) > 0 THEN 15 ELSE 0 END AS q_phone,
    CASE WHEN domain IS NOT NULL THEN 17 WHEN len(websites) > 0 THEN 8 ELSE 0 END AS q_website,
    CASE WHEN len(emails) > 0 THEN 8 ELSE 0 END AS q_email,
    (CASE WHEN street IS NOT NULL THEN 6 ELSE 0 END + CASE WHEN city IS NOT NULL THEN 3 ELSE 0 END
      + CASE WHEN postcode IS NOT NULL THEN 3 ELSE 0 END) AS q_address,
    CASE WHEN source_count > 1 THEN 12 ELSE 0 END AS q_corroborated,
    CASE WHEN len(socials) > 0 THEN 5 ELSE 0 END AS q_socials,
    CASE WHEN category IS NOT NULL THEN 3 ELSE 0 END AS q_category,
    CASE WHEN atp_id IS NOT NULL OR source_updated >= now() - INTERVAL 365 DAY THEN 3 ELSE 0 END AS q_fresh,
    CASE WHEN operating_status = 'temporarily_closed' THEN -20 ELSE 0 END AS q_status
  FROM leads_city
)
SELECT
  'lv_' || substr(md5(coalesce(ov_id, atp_id)), 1, 16) AS id,
  name, name_norm, category, humanize(category) AS category_label, category_group, categories, brand,
  street, city, region, postcode, country, lat, lon, phones, websites, emails, socials, domain,
  opening_hours, operating_status, source_count,
  ov_id, atp_id, spider, ref, confidence,
  greatest(0, least(100, q_confidence + q_phone + q_website + q_email + q_address + q_corroborated
    + q_socials + q_category + q_fresh + q_status))::SMALLINT AS quality_score,
  {'confidence': q_confidence, 'phone': q_phone, 'website': q_website, 'email': q_email,
   'address': q_address, 'corroborated': q_corroborated, 'socials': q_socials,
   'category': q_category, 'fresh': q_fresh, 'status': q_status} AS quality,
  [k FOR k IN [phone_key(p) FOR p IN phones] IF k IS NOT NULL] AS pkeys
FROM s;
