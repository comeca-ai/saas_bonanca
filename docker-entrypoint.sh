#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL não configurada}"
# Em SaaS gerenciado, somente este container é publicado e os módulos externos ficam
# conscientemente offline. No Docker Compose self-hosted, a interpolação obrigatória
# do compose exige os dois tokens antes de iniciar app e microserviços.

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
