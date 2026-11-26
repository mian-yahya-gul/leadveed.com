-- Helpers used by the merge. Plain DuckDB, no extensions needed.

-- Lowercase, strip accents and punctuation, drop legal suffixes and filler words.
CREATE OR REPLACE MACRO norm_name(s) AS trim(regexp_replace(
  regexp_replace(
    ' ' || regexp_replace(lower(strip_accents(coalesce(s, ''))), '[^a-z0-9\p{L}]+', ' ', 'g') || ' ',
    ' (the|and|llc|l l c|ltd|limited|inc|co|corp|corporation|company|pvt|private|plc|gmbh|sa|srl|fze|fzco|fzc|llp|est|establishment|trading|br|branch) ',
    ' ', 'g'),
  '\s+', ' ', 'g'));

-- Match key for phone numbers: the last 9 digits, ignoring country codes and formatting.
CREATE OR REPLACE MACRO phone_key(p) AS CASE
  WHEN length(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g')) >= 7
  THEN right(regexp_replace(p, '[^0-9]', '', 'g'), 9) END;

-- Registered host of a website, without www. NULL for social and link-in-bio hosts,
-- which are not a business's own website.
CREATE OR REPLACE MACRO host_of(u) AS
  lower(regexp_extract(coalesce(u, ''), '^(?:[a-zA-Z][a-zA-Z0-9+.-]*://)?(?:www\d?\.)?([^/:?#\s]+)', 1));

CREATE OR REPLACE MACRO site_domain(u) AS CASE
  WHEN host_of(u) = '' OR host_of(u) NOT LIKE '%.%' THEN NULL
  WHEN regexp_matches(host_of(u), '(^|\.)(facebook\.com|fb\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|tiktok\.com|youtube\.com|youtu\.be|wa\.me|whatsapp\.com|linktr\.ee|linkin\.bio|beacons\.ai|google\.com|goo\.gl|g\.page|business\.site|bit\.ly|tinyurl\.com|t\.me|yelp\.com|tripadvisor\.[a-z.]+|foursquare\.com|booking\.com|zomato\.com|talabat\.com|foodpanda\.[a-z.]+|ubereats\.com|deliveroo\.[a-z.]+|careem\.com|yango\.com|wixsite\.com|blogspot\.com|wordpress\.com)$')
    THEN NULL
  ELSE host_of(u) END;

-- Great-circle distance in metres.
CREATE OR REPLACE MACRO dist_m(lat1, lon1, lat2, lon2) AS
  2 * 6371000 * asin(sqrt(
    pow(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * pow(sin(radians(lon2 - lon1) / 2), 2)));

-- ~220 m grid cell used to find nearby candidates without a spatial extension.
CREATE OR REPLACE MACRO cell(v) AS floor(v / 0.002)::BIGINT;

CREATE OR REPLACE MACRO humanize(s) AS CASE WHEN s IS NULL THEN NULL ELSE
  upper(substr(replace(s, '_', ' '), 1, 1)) || substr(replace(s, '_', ' '), 2) END;

CREATE OR REPLACE MACRO title_case(s) AS
  array_to_string([upper(w[1]) || w[2:] FOR w IN string_split(lower(s), ' ')], ' ');

CREATE OR REPLACE MACRO is_latin(s) AS regexp_matches(s, '^[A-Za-z\x{00C0}-\x{024F} .''-]+$');

-- Tidy a city value: blank out country names used as cities, fix ALL CAPS.
CREATE OR REPLACE MACRO clean_city(c) AS CASE
  WHEN c IS NULL OR trim(c) = '' THEN NULL
  WHEN lower(trim(c)) IN ('pakistan', 'united arab emirates', 'uae', 'usa', 'united states', 'saudi arabia',
                          'ksa', 'qatar', 'kuwait', 'bahrain', 'oman', 'india', 'uk', 'united kingdom') THEN NULL
  WHEN (c = upper(c) OR c = lower(c)) AND length(c) > 3 THEN title_case(trim(c))
  ELSE trim(c) END;
