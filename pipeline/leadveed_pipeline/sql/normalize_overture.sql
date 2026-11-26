-- Flatten raw Overture places into LeadVeed's common shape.
-- Input view: overture_raw. Output table: ov.
CREATE OR REPLACE TABLE ov AS
WITH base AS (
  SELECT
    id                                         AS src_id,
    trim(names.primary)                        AS name,
    nullif(trim(brand.names.primary), '')      AS brand,
    coalesce(taxonomy.primary, basic_category) AS category,
    taxonomy.hierarchy[1]                      AS category_group,
    [c FOR c IN coalesce(taxonomy.hierarchy, [coalesce(taxonomy.primary, basic_category)]) IF c IS NOT NULL] AS categories,
    nullif(trim(addresses[1].freeform), '')    AS street,
    nullif(trim(addresses[1].locality), '')    AS city,
    nullif(trim(addresses[1].region), '')      AS region,
    nullif(trim(addresses[1].postcode), '')    AS postcode,
    upper(addresses[1].country)                AS country,
    (bbox.ymin + bbox.ymax) / 2                AS lat,
    (bbox.xmin + bbox.xmax) / 2                AS lon,
    coalesce(phones, [])                       AS phones,
    coalesce(websites, [])                     AS websites,
    coalesce(emails, [])                       AS emails,
    coalesce(socials, [])                      AS socials,
    confidence,
    operating_status,
    list_distinct([s.dataset FOR s IN coalesce(sources, [])]) AS datasets,
    list_max([try_cast(s.update_time AS TIMESTAMP) FOR s IN coalesce(sources, [])]) AS source_updated
  FROM overture_raw
)
SELECT * FROM base
WHERE name IS NOT NULL AND name <> ''
  AND coalesce(operating_status, 'open') <> 'permanently_closed'
  AND coalesce(category_group, '') <> 'geographic_entities'
  AND confidence >= getvariable('min_confidence');
