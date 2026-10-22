#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL não configurada}"
: "${PESAGEM_SERVICE_TOKEN:?PESAGEM_SERVICE_TOKEN não configurado}"
: "${BALANCA_SERVICE_TOKEN:?BALANCA_SERVICE_TOKEN não configurado}"

case "$PESAGEM_SERVICE_TOKEN" in
  troque-por-*|CHANGE_ME*|change-me*) echo "PESAGEM_SERVICE_TOKEN ainda usa placeholder." >&2; exit 1 ;;
esac
case "$BALANCA_SERVICE_TOKEN" in
  troque-por-*|CHANGE_ME*|change-me*) echo "BALANCA_SERVICE_TOKEN ainda usa placeholder." >&2; exit 1 ;;
esac
if [ "${#PESAGEM_SERVICE_TOKEN}" -lt 24 ] || [ "${#BALANCA_SERVICE_TOKEN}" -lt 24 ]; then
  echo "Tokens internos dos microserviços devem ter pelo menos 24 caracteres." >&2
  exit 1
fi

printf '%s\n' "[bonanca] aguardando MySQL..."
until node --input-type=module - <<'NODE'
import mysql from "mysql2/promise";
let connection;
try {
  connection = await mysql.createConnection(process.env.DATABASE_URL);
  await connection.query("SELECT 1");
  await connection.end();
  process.exit(0);
} catch {
  try { await connection?.end(); } catch {}
  process.exit(1);
}
NODE
do
  sleep 2
done

printf '%s\n' "[bonanca] aplicando migrations..."
pnpm db:migrate

printf '%s\n' "[bonanca] verificando seed inicial..."
pnpm exec tsx server/seed.ts

printf '%s\n' "[bonanca] iniciando aplicação na porta ${PORT:-3000}..."
exec node dist/index.js
