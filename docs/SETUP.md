# LeadVeed setup guide

This takes you from nothing to a live leadveed.com. Everything here is on a free tier except the domain.
Budget about two hours, plus a few hours for the first data import to run on its own.

```
Browser ──▶ Cloudflare ──▶ Oracle Cloud VM (leadveed.com and api.leadveed.com)
                                  Caddy ▶ Next.js web app (port 3000)
                                        │  server-side calls with a secret key
                                        ▼
                                  Caddy ▶ Node API (port 4000) ▶ Postgres + PostGIS
                                                  ▶ Typesense (search)
                                  nightly: data import · every 15 min: PageSpeed · daily: backup to Oracle Object Storage
```

## 1. Oracle Cloud server (free forever)

1. Sign up at <https://signup.cloud.oracle.com>. Pick a **home region close to your customers** and with Ampere capacity (for Pakistan and the Gulf: **UAE East (Dubai)**, **Saudi Arabia West (Jeddah)** or **India West (Mumbai)**). The home region can't be changed later. A card is needed for identity checks; Always Free resources are never charged.
2. Console → **Compute → Instances → Create instance**:
   - Image: **Canonical Ubuntu 24.04** (not "Minimal").
   - Shape: **Ampere → VM.Standard.A1.Flex**, **4 OCPUs, 24 GB memory**.
   - Networking: create a new VCN with a public subnet, **assign a public IPv4 address**.
   - SSH keys: upload your public key (`~/.ssh/id_ed25519.pub`; make one with `ssh-keygen -t ed25519` if needed).
   - Boot volume: tick **Specify a custom size** and set **200 GB**.
   - If you get "Out of capacity", try another availability domain, or try again at a different time of day.
3. Open the web ports: **Networking → Virtual cloud networks → your VCN → Security Lists → Default → Add Ingress Rules**:
   source `0.0.0.0/0`, TCP, destination ports `80,443`.
4. (Recommended) Upgrade the account to **Pay As You Go**. You still pay nothing for Always Free resources, but Oracle stops reclaiming "idle" free VMs.

## 2. Domain and Cloudflare

1. Add `leadveed.com` to Cloudflare (free plan) and change the nameservers at your registrar to Cloudflare's.
2. DNS records:
   | Type | Name | Content | Proxy |
   |---|---|---|---|
   | A | `@` | your Oracle VM public IP | Proxied (orange) |
   | A | `www` | your Oracle VM public IP | Proxied (orange) |
   | A | `api` | your Oracle VM public IP | Proxied (orange) |
3. **SSL/TLS → Overview → Full (strict)**.
4. **Security → Bots → Bot Fight Mode: on**. Optional: a rate-limit rule on `/api/` paths.

## 3. Install the server

SSH in (`ssh ubuntu@YOUR_IP`) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/mian-yahya-gul/leadveed.com/main/infra/oracle/setup.sh -o setup.sh
sudo bash setup.sh
```

The script installs Postgres 16 + PostGIS, Typesense, Node 22, Caddy and the Python pipeline, tunes Postgres
for 24 GB, opens the firewall, generates every secret into `/etc/leadveed/leadveed.env`, starts the API and
schedules the jobs. It also builds and starts the web app (step 5).

Check: `curl https://api.leadveed.com/health` should answer `{"ok":true}` once DNS has spread.

> The repository is private? Then the server can't clone it anonymously. Create a read-only
> [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)
> on the server and run setup with `REPO_URL=git@github.com:mian-yahya-gul/leadveed.com.git sudo -E bash setup.sh`.

## 4. First data import

By default LeadVeed imports **the whole world** (about 60 million places). Two settings in
`/etc/leadveed/leadveed.env` control this:

- `LEADVEED_COUNTRIES` (empty = whole world) decides what goes into Postgres. Every lead page, unlock and
  export works for every country.
- `TYPESENSE_COUNTRIES` decides which countries also get Typesense, the in-memory search engine that gives
  instant, typo-tolerant results. The whole world doesn't fit in this server's 24 GB of RAM, so the default
  is Pakistan, the Gulf, the UK, Canada, Australia and India. Searches in any other country, or with no
  country picked, are answered by Postgres instead: a bit slower (usually well under a second for a
  country + city search) but complete. Add countries as you see demand, then run
  `python -m leadveed_pipeline index`. Watch memory with `free -h` and keep a few GB spare.

Disk: a world import needs roughly 150 GB at its peak (download, working files and the database) and settles
around 90 GB, so give the VM the full 200 GB boot volume.

```bash
sudo systemctl start leadveed-import
journalctl -fu leadveed-import        # follow progress; 4-8 hours the first time for the whole world
```

After that the nightly timer checks for a new Overture release and imports it automatically (about monthly).
All The Places is refreshed at the same time.

## 5. Web app

The Next.js web app runs on the same Oracle server, so it costs nothing and has no hosting limits.
(Vercel's free Hobby plan doesn't allow commercial sites, and Cloudflare's free Workers plan caps CPU
time per request at a level a server-rendered Next.js app can exceed.)

setup.sh builds it and runs it as the `leadveed-web` service behind Caddy. Its settings live in
`/etc/leadveed/web.env` (see `infra/oracle/web.env.example`); setup.sh fills in the internal key and
`AUTH_SECRET`. Add the Google, Resend and Paddle values from steps 6 to 8, then run
`sudo /srv/leadveed/app/infra/oracle/deploy.sh` to rebuild and restart.

Cloudflare caches static files (`/_next/static/...`) at its edge, so most page assets never reach the server.

## 6. Google sign-in

<https://console.cloud.google.com> → new project "LeadVeed" → **APIs & Services → OAuth consent screen** (External,
app name LeadVeed, your email) → **Credentials → Create OAuth client ID** (Web application):
- Authorised redirect URI: `https://leadveed.com/api/auth/callback/google`

Put the client ID and secret into `/etc/leadveed/web.env` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

While you're in that project: **APIs & Services → Library → PageSpeed Insights API → Enable**, then
**Credentials → Create API key** and put it on the server as `PAGESPEED_API_KEY` (25,000 checks a day, free).

## 7. Email (Resend)

<https://resend.com> → add domain `leadveed.com` → add the DNS records it shows in Cloudflare → create an API key.
- `/etc/leadveed/web.env`: `AUTH_RESEND_KEY` (magic-link sign-in) and `AUTH_EMAIL_FROM="LeadVeed <login@leadveed.com>"`
- Server: `RESEND_API_KEY` (removal confirmations)

## 8. Payments (Paddle)

Paddle is the merchant of record: it sells to the customer, handles tax worldwide, accepts sellers based in
Pakistan, and pays out by bank transfer or Payoneer. (Lemon Squeezy closed to new sellers in November 2026.)

1. The three subscription products already exist in the live catalog: Starter $19/mo, Pro $49/mo, Agency $99/mo.
   Their price ids are built into `apps/api/src/plans.ts` and `apps/web/src/lib/plans.ts`.
2. **Checkout → Checkout settings**: set the default payment link to `https://leadveed.com/checkout`, and request
   approval for the `leadveed.com` domain (Paddle reviews the live site: pricing, terms, refund and privacy pages).
   Copy the customer portal link into `/etc/leadveed/web.env` as `PADDLE_CUSTOMER_PORTAL`.
3. **Developer tools → Authentication → Client-side tokens**: create one and put it in `/etc/leadveed/web.env` as
   `PADDLE_CLIENT_TOKEN`.
4. **Developer tools → Notifications → New destination**: URL `https://api.leadveed.com/webhooks/paddle`, events
   `subscription.created`, `subscription.updated`, `subscription.canceled`, `transaction.completed`. Put its
   secret key on the server as `PADDLE_WEBHOOK_SECRET`.
5. Finish **Business account → Verification** (ID and payout details) so live payments can start.
6. `sudo systemctl restart leadveed-api leadveed-web`.

## 9. Backups (Oracle Object Storage) and automatic deploys

- Backups go to Oracle Object Storage, which is part of Always Free (20 GB), so no extra account or card is needed.
  Oracle console → **Storage → Buckets** → create `leadveed-backups` (Standard tier, private). Then
  **Profile → User settings → Customer secret keys → Generate** and copy the key id and secret.
  Put them on the server as `BACKUP_S3_KEY_ID` / `BACKUP_S3_SECRET`, and set
  `BACKUP_S3_ENDPOINT=https://<namespace>.compat.objectstorage.ap-singapore-1.oraclecloud.com`
  (the namespace is shown on the tenancy page, or `oci os ns get`). Any other S3-compatible bucket works too
  (set `BACKUP_S3_PROVIDER`, e.g. `Cloudflare` for R2). Accounts, credits, unlocks, lists and removal
  requests are backed up daily; the places data is rebuilt by the importer, so it isn't.
- Automatic deploys: in GitHub → **Settings → Secrets → Actions** add `SERVER_HOST` (the VM IP),
  `SERVER_USER` (`ubuntu`) and `SERVER_SSH_KEY` (a private key whose public half is in `~/.ssh/authorized_keys` on the
  server). Every green build on `main` then runs `infra/oracle/deploy.sh` on the server.
  That rebuilds and restarts both the API and the web app.

## Day-to-day

| Task | Command (on the server) |
|---|---|
| API logs | `journalctl -fu leadveed-api` |
| Import status | `systemctl list-timers leadveed-*` · `journalctl -u leadveed-import` |
| Is a new release out? | `sudo -u leadveed /srv/leadveed/venv/bin/python -m leadveed_pipeline check` (from `/srv/leadveed/app/pipeline`, with the env file loaded) |
| Deploy by hand | `sudo /srv/leadveed/app/infra/oracle/deploy.sh` |
| Give someone credits | `psql` → `UPDATE users SET credits = credits + 100 WHERE email = '…';` |

## Running it on your Mac

```bash
brew install postgresql@16 postgis node python
# Typesense (optional; without it search falls back to Postgres): https://typesense.org/docs/guide/install-typesense.html
createdb leadveed && psql leadveed -f db/schema.sql
npm install
pip install -r pipeline/requirements.txt
# a small real sample: one city's worth of Overture places
PYTHONPATH=pipeline python -c "from leadveed_pipeline import overture; overture.download('2026-11-18.0', __import__('pathlib').Path('/tmp/lahore.parquet'), bbox=(74.2,31.4,74.5,31.6))"
DATABASE_URL=postgresql://localhost/leadveed PYTHONPATH=pipeline python -m leadveed_pipeline --data-dir /tmp/lv run --release dev --overture-file /tmp/lahore.parquet --no-atp
DATABASE_URL=postgresql://localhost/leadveed npm run dev:api
cp apps/web/.env.example apps/web/.env.local   # set LEADVEED_API_URL=http://127.0.0.1:4000, LEADVEED_INTERNAL_KEY=dev-internal-key, AUTH_SECRET, AUTH_DEV_LOGIN=1, NEXT_PUBLIC_SITE_URL=http://localhost:3000
npm run dev:web    # http://localhost:3000
```
