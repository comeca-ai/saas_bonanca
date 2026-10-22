#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Uso: ./scripts/restore.sh backups/bonanca-YYYYMMDD-HHMMSS.sql.gz" >&2
  exit 1
fi
read -r -p "Isso substituirá os dados atuais. Digite RESTAURAR para continuar: " ANSWER
[ "$ANSWER" = "RESTAURAR" ] || { echo "Restore cancelado."; exit 1; }
APP_STOPPED=false
restart_app() {
  if [ "$APP_STOPPED" = true ]; then
    echo "Religando a aplicação..."
    docker compose start app >/dev/null || true
  fi
}
trap restart_app EXIT
gunzip -t "$FILE"
docker compose stop app >/dev/null
APP_STOPPED=true
gunzip -c "$FILE" | docker compose exec -T db sh -c 'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
docker compose start app >/dev/null
APP_STOPPED=false
trap - EXIT
echo "Restore concluído a partir de $FILE"
