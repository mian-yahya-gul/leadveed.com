# LeadVeed

**leadveed.com** — B2B lead search built from open, licensed business data. Find local businesses by category and
city, filter for the ones with no website or a slow one, see a quality score on every record, and export a clean CSV.

| | |
|---|---|
| `apps/web` | Next.js 16 web app (runs on the Oracle server): landing, search, lead pages, pricing, sign-in, dashboard, legal pages |
| `apps/api` | Fastify API (Oracle VM): search, unlocks and credits, CSV export, lists, removal requests, Lemon Squeezy webhooks, PageSpeed worker |
| `pipeline` | Python + DuckDB importer: Overture Maps + All The Places → normalise → de-duplicate and merge → quality score → Postgres → Typesense |
| `db/schema.sql` | Postgres 16 + PostGIS schema |
| `infra/oracle` | One-command server setup, systemd timers, Caddy, backups, deploy script |
| `docs/SETUP.md` | Step-by-step guide to go live |

## How the data gets good

1. **Two sources.** Overture Maps places (monthly, CDLA-Permissive-2.0) and All The Places (weekly, CC0, first-party store locators).
2. **Normalised.** Names lose legal suffixes and punctuation; phones reduce to a match key; social links are separated from real websites; closed places and map features are dropped.
3. **De-duplicated.** Duplicates inside Overture collapse (same name in the same ~220 m cell, or same name + phone + street even when geocoded far apart).
4. **Merged.** Each All The Places record is matched to at most one Overture record within 300 m by phone, by domain plus similar name, or by a near-identical name; the merged lead takes first-party contact details and Overture's category.
5. **Repaired.** City names in other scripts or blank are replaced by the dominant Latin-script city nearby, so "Dubai" finds "دبي" rows.
6. **Scored.** 0–100 from source confidence, contact completeness, cross-source confirmation and freshness, with a per-field breakdown.
7. **Stable.** Ids survive monthly releases; removed businesses stay suppressed; leads absent from two releases are dropped.

## Develop

See the "Running it on your Mac" section of [docs/SETUP.md](docs/SETUP.md). Tests:

```bash
PYTHONPATH=pipeline python -m pytest pipeline/tests          # pipeline
TEST_DATABASE_URL=postgresql://localhost/leadveed npm test    # API (needs a loaded database)
npm run build -w apps/web                                    # web
```

## Data attribution

Contains data from the [Overture Maps Foundation](https://overturemaps.org) (CDLA Permissive 2.0) and
[All The Places](https://www.alltheplaces.xyz) (CC0). Shown in the site footer and on `/data-licensing`.
