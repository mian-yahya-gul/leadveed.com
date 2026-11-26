# LeadVeed setup guide

This takes you from nothing to a live leadveed.com. Everything here is on a free tier except the domain.
Budget about two hours, plus a few hours for the first data import to run on its own.

```
Browser ──▶ Cloudflare ──▶ Vercel (Next.js web app, leadveed.com)
                              │  server-side calls with a secret key
                              ▼
                 Cloudflare ──▶ Oracle Cloud VM (api.leadveed.com)
                                  Caddy ▶ Node API ▶ Postgres + PostGIS
                                                  ▶ Typesense (search)
                                  nightly: data import · every 15 min: PageSpeed · daily: backup to R2
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
   | A | `api` | your Oracle VM public IP | Proxied (orange) |
   | CNAME | `@` | `cname.vercel-dns.com` | DNS only (grey) |
   | CNAME | `www` | `cname.vercel-dns.com` | DNS only (grey) |
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
schedules the jobs. At the end it prints the **internal key** you'll paste into Vercel.

Check: `curl https://api.leadveed.com/health` should answer `{"ok":true}` once DNS has spread.

> The repository is private? Then the server can't clone it anonymously. Create a read-only
> [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)
> on the server and run setup with `REPO_URL=git@github.com:mian-yahya-gul/leadveed.com.git sudo -E bash setup.sh`.

## 4. First data import

Choose your countries in `/etc/leadveed/leadveed.env` (`LEADVEED_COUNTRIES`). The default covers Pakistan, the
Gulf, the UK, US, Canada, Australia and India. The whole world (~60M places) fits on disk, but Typesense keeps its
index in memory and won't fit in 24 GB, so grow coverage country by country.

```bash
sudo systemctl start leadveed-import
journalctl -fu leadveed-import        # follow progress; 1-4 hours the first time
```

After that the nightly timer checks for a new Overture release and imports it automatically (about monthly).
All The Places is refreshed at the same time.

## 5. Vercel (web app)

1. <https://vercel.com/new> → import the `leadveed.com` GitHub repo.
2. **Root directory: `apps/web`**. Framework: Next.js (auto-detected).
3. Environment variables (see `apps/web/.env.example`):
   - `LEADVEED_API_URL` = `https://api.leadveed.com`
   - `LEADVEED_INTERNAL_KEY` = the key printed by setup.sh
   - `NEXT_PUBLIC_SITE_URL` = `https://leadveed.com`, `AUTH_URL` = `https://leadveed.com`
   - `AUTH_SECRET` = output of `npx auth secret`
   - Google and Resend keys from steps 6 and 7, Lemon Squeezy links from step 8.
4. **Settings → Domains**: add `leadveed.com` and `www.leadveed.com`.

## 6. Google sign-in

<https://console.cloud.google.com> → new project "LeadVeed" → **APIs & Services → OAuth consent screen** (External,
app name LeadVeed, your email) → **Credentials → Create OAuth client ID** (Web application):
- Authorised redirect URI: `https://leadveed.com/api/auth/callback/google`

Put the client ID and secret into Vercel as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

While you're in that project: **APIs & Services → Library → PageSpeed Insights API → Enable**, then
**Credentials → Create API key** and put it on the server as `PAGESPEED_API_KEY` (25,000 checks a day, free).

## 7. Email (Resend)

<https://resend.com> → add domain `leadveed.com` → add the DNS records it shows in Cloudflare → create an API key.
- Vercel: `AUTH_RESEND_KEY` (magic-link sign-in) and `AUTH_EMAIL_FROM="LeadVeed <login@leadveed.com>"`
- Server: `RESEND_API_KEY` (removal confirmations)

## 8. Payments (Lemon Squeezy)

Lemon Squeezy is the merchant of record, so it handles tax and accepts cards from Pakistan and the Gulf, and pays
out to Payoneer or a bank account.

1. Create a store, then three **subscription products**: Starter $19/mo, Pro $49/mo, Agency $99/mo.
   In each product set the **confirmation redirect** to `https://leadveed.com/dashboard?upgraded=1`.
2. Copy each product's checkout link into Vercel: `LS_CHECKOUT_STARTER`, `LS_CHECKOUT_PRO`, `LS_CHECKOUT_AGENCY`,
   and the customer portal link as `LS_CUSTOMER_PORTAL`.
3. Copy each product's **variant id** into the server env: `LS_VARIANT_STARTER`, `LS_VARIANT_PRO`, `LS_VARIANT_AGENCY`.
4. **Settings → Webhooks → +**: URL `https://api.leadveed.com/webhooks/lemonsqueezy`, a signing secret
   (put it on the server as `LEMONSQUEEZY_WEBHOOK_SECRET`), events: `subscription_created`, `subscription_updated`,
   `subscription_cancelled`, `subscription_expired`, `subscription_payment_success`.
5. `sudo systemctl restart leadveed-api`.

## 9. Backups (Cloudflare R2) and automatic deploys

- Cloudflare → **R2** → create bucket `leadveed-backups` → **Manage API tokens** → token with Object Read & Write.
  Put the account id, key id and secret on the server (`R2_*`). Accounts, credits, unlocks, lists and removal
  requests are backed up daily; the places data is rebuilt by the importer, so it isn't.
- Automatic API deploys: in GitHub → **Settings → Secrets → Actions** add `SERVER_HOST` (the VM IP),
  `SERVER_USER` (`ubuntu`) and `SERVER_SSH_KEY` (a private key whose public half is in `~/.ssh/authorized_keys` on the
  server). Every green build on `main` then runs `infra/oracle/deploy.sh` on the server.
  Vercel deploys the web app by itself.

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
