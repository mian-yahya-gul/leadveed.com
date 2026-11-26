-- LeadVeed database schema (Postgres 16 + PostGIS)
-- Applied by infra/oracle/setup.sh and by `npm run db:migrate -w apps/api`.
-- Idempotent: safe to run again.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- Places (leads)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS places (
  id                text PRIMARY KEY,              -- stable LeadVeed id, e.g. lv_8f3a...
  name              text NOT NULL,
  name_norm         text NOT NULL,
  category          text,                          -- most specific category key, e.g. dentist
  category_label    text,                          -- humanised, e.g. "Dentist"
  category_group    text,                          -- top level, e.g. health_care
  categories        text[] NOT NULL DEFAULT '{}',  -- full taxonomy path, e.g. {health_care,outpatient_care_facility,dental_clinic}
  brand             text,
  street            text,
  city              text,
  region            text,
  postcode          text,
  country           char(2),
  lat               double precision NOT NULL,
  lon               double precision NOT NULL,
  geom              geography(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography) STORED,
  phones            text[] NOT NULL DEFAULT '{}',
  websites          text[] NOT NULL DEFAULT '{}',
  emails            text[] NOT NULL DEFAULT '{}',
  socials           text[] NOT NULL DEFAULT '{}',
  domain            text,
  opening_hours     text,
  operating_status  text,
  sources           jsonb NOT NULL DEFAULT '[]',   -- [{"dataset":"overture","id":"...","confidence":0.9}, {"dataset":"alltheplaces","spider":"...","ref":"..."}]
  source_count      smallint NOT NULL DEFAULT 1,
  quality_score     smallint NOT NULL DEFAULT 0,   -- 0..100
  quality           jsonb NOT NULL DEFAULT '{}',   -- breakdown of the score
  pagespeed_mobile  smallint,                      -- 0..100, Google PageSpeed performance
  pagespeed_desktop smallint,
  pagespeed_metrics jsonb,
  pagespeed_checked_at timestamptz,
  first_seen        date NOT NULL DEFAULT current_date,
  last_seen         date NOT NULL DEFAULT current_date,
  release           text,                          -- data release that last touched this row
  missed_releases   smallint NOT NULL DEFAULT 0,   -- imports in a row this lead was absent from
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS places_geom_idx      ON places USING gist (geom);
CREATE INDEX IF NOT EXISTS places_country_city  ON places (country, lower(city));
CREATE INDEX IF NOT EXISTS places_category      ON places (category);
CREATE INDEX IF NOT EXISTS places_categories    ON places USING gin (categories);
CREATE INDEX IF NOT EXISTS places_name_trgm     ON places USING gin (name_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS places_domain        ON places (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS places_first_seen    ON places (first_seen);
CREATE INDEX IF NOT EXISTS places_pagespeed_due ON places (pagespeed_checked_at NULLS FIRST) WHERE domain IS NOT NULL;

-- Summary tables refreshed after each import (pipeline/load.py).
CREATE TABLE IF NOT EXISTS country_stats (
  country char(2) PRIMARY KEY, n bigint NOT NULL, with_website bigint, with_phone bigint, with_email bigint, avg_quality real);
CREATE TABLE IF NOT EXISTS city_stats (country char(2) NOT NULL, city text NOT NULL, n bigint NOT NULL, PRIMARY KEY (country, city));
CREATE INDEX IF NOT EXISTS city_stats_prefix ON city_stats (lower(city) text_pattern_ops);
CREATE TABLE IF NOT EXISTS category_stats (country char(2) NOT NULL, category text NOT NULL, n bigint NOT NULL, PRIMARY KEY (country, category));

-- Records people asked us to remove. The importer drops matches on every run,
-- so removed businesses never come back with the next release.
CREATE TABLE IF NOT EXISTS suppressions (
  id          bigserial PRIMARY KEY,
  place_id    text,
  phone_key   text,          -- last 9 digits of a phone number
  domain      text,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suppressions_place ON suppressions (place_id);
CREATE INDEX IF NOT EXISTS suppressions_phone ON suppressions (phone_key);
CREATE INDEX IF NOT EXISTS suppressions_domain ON suppressions (domain);

CREATE TABLE IF NOT EXISTS removal_requests (
  id          bigserial PRIMARY KEY,
  email       citext NOT NULL,
  place_url   text,
  place_id    text,
  business_name text,
  message     text,
  status      text NOT NULL DEFAULT 'pending',   -- pending | removed | rejected
  token       text NOT NULL,                     -- email confirmation token
  confirmed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS imports (
  id          bigserial PRIMARY KEY,
  source      text NOT NULL,          -- overture | alltheplaces | merged
  release     text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rows_in     bigint,
  rows_new    bigint,
  rows_updated bigint,
  rows_merged bigint,
  status      text NOT NULL DEFAULT 'running',
  notes       text
);

-- ---------------------------------------------------------------------------
-- Accounts (Auth.js tables + billing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              text PRIMARY KEY DEFAULT ('usr_' || replace(gen_random_uuid()::text, '-', '')),
  name            text,
  email           citext UNIQUE,
  "emailVerified" timestamptz,
  image           text,
  plan            text NOT NULL DEFAULT 'free',     -- free | starter | pro | agency
  credits         integer NOT NULL DEFAULT 25,
  credits_reset_at timestamptz,
  ls_customer_id  text,
  ls_subscription_id text,
  subscription_status text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  bigserial PRIMARY KEY,
  "userId"            text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                text NOT NULL,
  provider            text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  id_token            text,
  scope               text,
  session_state       text,
  token_type          text,
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS verification_token (
  identifier text NOT NULL,
  expires    timestamptz NOT NULL,
  token      text NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Every credit movement, so balances can always be explained.
CREATE TABLE IF NOT EXISTS credit_ledger (
  id         bigserial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta      integer NOT NULL,
  reason     text NOT NULL,          -- signup | unlock | export | plan_refill | refund | admin
  ref        text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user ON credit_ledger (user_id, created_at DESC);

-- Leads a user has paid for. Unlocked once, yours forever (re-export is free).
CREATE TABLE IF NOT EXISTS unlocks (
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

CREATE TABLE IF NOT EXISTS lists (
  id         bigserial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS list_items (
  list_id    bigint NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  place_id   text NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, place_id)
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id         bigserial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  query      jsonb NOT NULL,
  alert      boolean NOT NULL DEFAULT false,      -- Phase 2: new-business alerts
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exports (
  id         bigserial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query      jsonb NOT NULL,
  rows       integer NOT NULL,
  credits_used integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id         text PRIMARY KEY,       -- provider event id, for idempotency
  provider   text NOT NULL,
  payload    jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
