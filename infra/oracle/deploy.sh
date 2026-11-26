#!/usr/bin/env bash
# Pull the latest code and restart the API. Run on the server:  sudo /srv/leadveed/app/infra/oracle/deploy.sh
set -euo pipefail
APP=/srv/leadveed
cd $APP/app
sudo -u leadveed git pull --ff-only
set -a; source /etc/leadveed/leadveed.env; set +a
sudo -u leadveed psql "$DATABASE_URL" -q -f db/schema.sql
sudo -u leadveed npm ci --workspace apps/api --include-workspace-root
sudo -u leadveed npm run build -w apps/api
sudo -u leadveed $APP/venv/bin/pip install -q -r pipeline/requirements.txt
cp infra/oracle/systemd/*.service infra/oracle/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl restart leadveed-api
sleep 2 && curl -fsS http://127.0.0.1:4000/health && echo " deployed $(git rev-parse --short HEAD)"
