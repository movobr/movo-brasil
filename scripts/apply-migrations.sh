#!/usr/bin/env bash
# Aplica as migrations 0001–0004 no Supabase real (ou qualquer Postgres).
# Uso: DATABASE_URL="postgresql://postgres:[senha]@db.[ref].supabase.co:5432/postgres" ./scripts/apply-migrations.sh
# A senha nunca vai para o repo — só via env. Falha no primeiro erro.
set -euo pipefail
if [ -z "${DATABASE_URL:-}" ]; then
  echo "BLOCKED: defina DATABASE_URL (senha do banco, dashboard Supabase → Settings → Database)." >&2
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for f in "$ROOT"/packages/backend/db/migrations/*.sql; do
  echo "→ aplicando $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" > /dev/null
done
echo "OK: migrations aplicadas. Conferindo tabelas:"
psql "$DATABASE_URL" -tAc "select tablename from pg_tables where schemaname='public' order by 1;"
