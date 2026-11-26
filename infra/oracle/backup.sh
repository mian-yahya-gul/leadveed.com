#!/usr/bin/env bash
# Daily backup of everything that can't be rebuilt from the open data:
# users, credits, unlocks, lists, removal requests and suppressions.
# (The places table is rebuilt by the importer, so it's skipped to keep backups small.)
set -euo pipefail
: "${R2_ACCOUNT_ID:?set R2_* in /etc/leadveed/leadveed.env}"
stamp=$(date -u +%Y-%m-%dT%H%M)
file=/srv/leadveed/backups/leadveed-$stamp.dump
mkdir -p /srv/leadveed/backups
pg_dump "$DATABASE_URL" --format=custom --exclude-table-data=places --exclude-table-data=places_staging \
  --exclude-table-data='*_stats' -f "$file"
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  RCLONE_CONFIG_R2_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
rclone copy "$file" "r2:$R2_BUCKET/db/"
# keep 7 local copies, 60 days in R2
ls -1t /srv/leadveed/backups/*.dump | tail -n +8 | xargs -r rm -f
rclone delete --min-age 60d "r2:$R2_BUCKET/db/"
echo "backup ok: $file"
