#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale Docker Engine + Docker Compose Plugin e execute novamente." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose Plugin não encontrado. Instale o plugin e execute novamente." >&2
  exit 1
fi

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
  fi
}

if [ ! -f .env ]; then
  cp .env.example .env
  MYSQL_PASSWORD="$(random_secret)"
  MYSQL_ROOT_PASSWORD="$(random_secret)"
  SESSION_SECRET="$(random_secret)"
  SEED_ADMIN_PASSWORD="$(random_secret)"
  sed -i "s|^MYSQL_PASSWORD=.*|MYSQL_PASSWORD=${MYSQL_PASSWORD}|" .env
  sed -i "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}|" .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=mysql://bonanca:${MYSQL_PASSWORD}@db:3306/bonanca|" .env
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" .env
  sed -i "s|^SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}|" .env
  chmod 600 .env
  echo "Arquivo .env criado com segredos aleatórios."
else
  echo "Usando o .env existente."
fi

require_env() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true)"
  if [ -z "$value" ] || [[ "$value" == troque-por-* ]] || [ "${#value}" -lt 24 ]; then
    echo "${key} ausente, fraco ou com placeholder em .env. Corrija antes de continuar." >&2
    exit 1
  fi
}

require_env MYSQL_PASSWORD
require_env MYSQL_ROOT_PASSWORD
require_env SESSION_SECRET
require_env SEED_ADMIN_PASSWORD

docker compose up -d --build

echo
echo "Bonança instalado."
echo "URL: http://localhost:${APP_PORT:-3000}"
echo "Login: $(grep '^SEED_ADMIN_EMAIL=' .env | cut -d= -f2-)"
echo "Senha: consulte o valor de SEED_ADMIN_PASSWORD em .env"
echo
echo "Comandos úteis:"
echo "  docker compose logs -f app"
echo "  docker compose ps"
echo "  ./scripts/backup.sh"
