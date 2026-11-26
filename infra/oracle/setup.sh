#!/usr/bin/env bash
# LeadVeed server setup for an Oracle Cloud "Always Free" Ampere A1 VM
# (Ubuntu 24.04, 4 OCPU / 24 GB RAM / up to 200 GB disk).
#
# Run once as root on a fresh server:
#   curl -fsSL https://raw.githubusercontent.com/mian-yahya-gul/leadveed.com/main/infra/oracle/setup.sh -o setup.sh
#   sudo bash setup.sh
# It is safe to run again; it skips what is already done.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/mian-yahya-gul/leadveed.com.git}"
BRANCH="${BRANCH:-main}"
TYPESENSE_VERSION="${TYPESENSE_VERSION:-30.1}"
APP=/srv/leadveed
ENV_FILE=/etc/leadveed/leadveed.env

log() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
[[ $EUID -eq 0 ]] || { echo "Run as root: sudo bash setup.sh"; exit 1; }
ARCH=$(dpkg --print-architecture)   # arm64 on Ampere

log "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg git build-essential python3 python3-venv python3-pip \
  postgresql-16 postgresql-16-postgis-3 postgresql-contrib rclone ufw unattended-upgrades netfilter-persistent \
  iptables-persistent debian-keyring debian-archive-keyring apt-transport-https

log "Node.js 22"
if ! command -v node >/dev/null || [[ $(node -v) != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

log "Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi

log "Typesense $TYPESENSE_VERSION"
if ! systemctl list-unit-files | grep -q typesense-server; then
  deb="typesense-server-${TYPESENSE_VERSION}-${ARCH}.deb"
  curl -fSLo "/tmp/$deb" "https://dl.typesense.org/releases/${TYPESENSE_VERSION}/${deb}" \
    || { echo "Couldn't download $deb. Check https://typesense.org/downloads for the current version and rerun with TYPESENSE_VERSION=x.y"; exit 1; }
  apt-get install -y -q "/tmp/$deb"
fi

log "Firewall"
# Oracle's Ubuntu images ship iptables rules that block everything except SSH. Open 80/443.
for port in 80 443; do
  iptables -C INPUT -p tcp --dport $port -j ACCEPT 2>/dev/null || iptables -I INPUT 6 -m state --state NEW -p tcp --dport $port -j ACCEPT
done
netfilter-persistent save

log "Service user and folders"
id leadveed >/dev/null 2>&1 || useradd --system --create-home --home-dir $APP --shell /bin/bash leadveed
mkdir -p $APP/data $APP/backups /etc/leadveed /var/log/caddy
chown -R leadveed:leadveed $APP

log "Secrets"
if [[ ! -f $ENV_FILE ]]; then
  DB_PASSWORD=$(openssl rand -hex 24)
  TS_KEY=$(grep -oP '(?<=api-key = ).*' /etc/typesense/typesense-server.ini 2>/dev/null || openssl rand -hex 24)
  INTERNAL_KEY=$(openssl rand -hex 32)
  curl -fsSL "https://raw.githubusercontent.com/mian-yahya-gul/leadveed.com/${BRANCH}/infra/oracle/leadveed.env.example" -o $ENV_FILE 2>/dev/null \
    || cp "$(dirname "$0")/leadveed.env.example" $ENV_FILE
  sed -i "s/__DB_PASSWORD__/$DB_PASSWORD/; s/__TYPESENSE_KEY__/$TS_KEY/; s/__INTERNAL_KEY__/$INTERNAL_KEY/" $ENV_FILE
  chmod 600 $ENV_FILE && chown leadveed:leadveed $ENV_FILE
  echo "Created $ENV_FILE"
fi
set -a; source $ENV_FILE; set +a
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#')

log "Typesense config"
sed -i "s/^api-key = .*/api-key = ${TYPESENSE_API_KEY}/; s/^api-address = .*/api-address = 127.0.0.1/" /etc/typesense/typesense-server.ini
systemctl enable --now typesense-server
systemctl restart typesense-server

log "Postgres tuning (24 GB RAM)"
PGCONF=/etc/postgresql/16/main/conf.d/leadveed.conf
cat > $PGCONF <<'PG'
listen_addresses = 'localhost'
shared_buffers = 6GB
effective_cache_size = 14GB
maintenance_work_mem = 1GB
work_mem = 64MB
max_wal_size = 8GB
wal_compression = on
random_page_cost = 1.1
effective_io_concurrency = 200
max_parallel_workers_per_gather = 2
max_connections = 60
PG
systemctl restart postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='leadveed'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE leadveed LOGIN PASSWORD '${DB_PASSWORD}'"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='leadveed'" | grep -q 1 \
  || sudo -u postgres createdb -O leadveed leadveed
sudo -u postgres psql -d leadveed -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS citext;"

log "Code"
if [[ ! -d $APP/app/.git ]]; then
  sudo -u leadveed git clone --branch "$BRANCH" "$REPO_URL" $APP/app
else
  sudo -u leadveed git -C $APP/app pull --ff-only
fi
sudo -u leadveed psql "$DATABASE_URL" -q -f $APP/app/db/schema.sql

log "API build"
cd $APP/app
sudo -u leadveed npm ci --workspace apps/api --include-workspace-root
sudo -u leadveed npm run build -w apps/api

log "Pipeline (Python)"
[[ -d $APP/venv ]] || sudo -u leadveed python3 -m venv $APP/venv
sudo -u leadveed $APP/venv/bin/pip install -q --upgrade pip
sudo -u leadveed $APP/venv/bin/pip install -q -r $APP/app/pipeline/requirements.txt
sudo -u leadveed $APP/venv/bin/pip install -q -e $APP/app/pipeline

log "Services"
cp $APP/app/infra/oracle/systemd/*.service $APP/app/infra/oracle/systemd/*.timer /etc/systemd/system/
cp $APP/app/infra/oracle/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now leadveed-api leadveed-import.timer leadveed-pagespeed.timer leadveed-backup.timer
systemctl reload caddy || systemctl restart caddy

log "Unattended security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades

sleep 2
curl -fsS http://127.0.0.1:4000/health && echo
cat <<DONE

✅ LeadVeed server is ready.

Next steps:
  1. Edit $ENV_FILE and fill in RESEND_API_KEY, PAGESPEED_API_KEY, Lemon Squeezy and R2 values,
     then: sudo systemctl restart leadveed-api
  2. Copy this value into Vercel as LEADVEED_INTERNAL_KEY:
       $(grep ^INTERNAL_API_KEY $ENV_FILE | cut -d= -f2)
  3. Start the first import now (4-8 hours for the whole world):
       sudo systemctl start leadveed-import && journalctl -fu leadveed-import
DONE
