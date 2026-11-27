#!/usr/bin/env bash
# Daily backup of everything that can't be rebuilt from the open data:
# users, credits, unlocks, lists, removal requests and suppressions.
# (The places table is rebuilt by the importer, so it's skipped to keep backups small.)
#
# Copies go to any S3-compatible bucket. The default is Oracle Object Storage
# (Always Free: 20 GB, no card needed beyond the existing Oracle account):
#   BACKUP_S3_ENDPOINT=https://<namespace>.compat.objectstorage.ap-singapore-1.oraclecloud.com
#   BACKUP_S3_REGION=ap-singapore-1
#   BACKUP_S3_KEY_ID / BACKUP_S3_SECRET = an Oracle "Customer Secret Key"
#   BACKUP_S3_BUCKET=leadveed-backups
# Without these set, the backup is kept on the server only.
set -euo pipefail
stamp=$(date -u +%Y-%m-%dT%H%M)
file=/srv/leadveed/backups/leadveed-$stamp.dump
mkdir -p /srv/leadveed/backups
pg_dump "$DATABASE_URL" --format=custom --exclude-table-data=places --exclude-table-data=places_staging \
  --exclude-table-data='*_stats' -f "$file"
# keep 7 local copies
ls -1t /srv/leadveed/backups/*.dump | tail -n +8 | xargs -r rm -f

if [ -z "${BACKUP_S3_ENDPOINT:-}" ] || [ -z "${BACKUP_S3_KEY_ID:-}" ]; then
  echo "backup ok (local only, set BACKUP_S3_* in /etc/leadveed/leadveed.env for an off-server copy): $file"
  exit 0
fi
export RCLONE_CONFIG_REMOTE_TYPE=s3 RCLONE_CONFIG_REMOTE_PROVIDER="${BACKUP_S3_PROVIDER:-Other}" \
  RCLONE_CONFIG_REMOTE_ACCESS_KEY_ID="$BACKUP_S3_KEY_ID" RCLONE_CONFIG_REMOTE_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET" \
  RCLONE_CONFIG_REMOTE_ENDPOINT="$BACKUP_S3_ENDPOINT" RCLONE_CONFIG_REMOTE_REGION="${BACKUP_S3_REGION:-auto}" \
  RCLONE_CONFIG_REMOTE_FORCE_PATH_STYLE=true
bucket="${BACKUP_S3_BUCKET:-leadveed-backups}"
rclone copy "$file" "remote:$bucket/db/"
# keep 60 days off-server
rclone delete --min-age 60d "remote:$bucket/db/"
echo "backup ok: $file -> $bucket"
