#!/usr/bin/env bash
# Snapshot lógico do PostgreSQL (61). Exige DATABASE_URL no ambiente;
# sem ela, falha explicando em vez de inventar destino.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "BLOCKED: defina DATABASE_URL (postgresql://...) para o snapshot." >&2
  exit 2
fi

OUT="${1:-./backups/movo-$(date -u +%Y%m%dT%H%M%SZ).dump}"
mkdir -p "$(dirname "$OUT")"
pg_dump --format=custom --file="$OUT" "$DATABASE_URL"
echo "snapshot: $OUT"
