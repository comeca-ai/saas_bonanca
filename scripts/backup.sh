#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="backups/bonanca-${STAMP}.sql.gz"
docker compose exec -T db sh -c 'exec mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" --single-transaction --routines --triggers' | gzip > "$FILE"
echo "Backup criado em $FILE"
