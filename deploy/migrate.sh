#!/bin/sh
# Gate 3 (37): migration dry run / apply. Exige DATABASE_URL (Supabase
# connection string, via secret do Swarm — nunca no repo).
set -eu
if [ -z "${DATABASE_URL:-}" ]; then
  echo "BLOCKED: DATABASE_URL não definida." >&2
  exit 2
fi
for file in $(ls ./*.sql | sort); do
  echo "applying: $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done
echo "migrations applied."
