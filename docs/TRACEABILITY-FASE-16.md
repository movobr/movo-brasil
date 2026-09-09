# Rastreabilidade — Fase 16 (41-TRACEABILITY)

Escopo: artefatos de deploy staging/produção (37/DEC-OPS). Execução no
VPS, credenciais reais e aprovação manual: fases com ambiente.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 37 topologia + gates | Dockerfiles, stacks, CI | `deploy/*`, `.github/workflows/ci.yml` | YAML parse OK; imagens buildadas; migrations em Postgres real | gates 1–8 codificados |
| — | 37 sem self-host Supabase | stacks sem Postgres próprio | `stack.*.yml` | sem serviço de banco nos stacks | managed externo |
| — | DEC-OPS-004 gate manual + rollback | environment production + rollback_config | `ci.yml`, `stack.production.yml` | proteção por reviewers (config do repo) | aprovação manual |
| REQ-INFRA-001 | migrations + RLS | migrator + 0001–0003 | `Dockerfile.migrator`, `migrate.sh` | dry run real: 8 tabelas, RLS nas 8, FK e seed OK | dockerized, backup-restore* |
| — | G5 health/smoke | /api/health + smoke CI | `app/api/health/route.ts` | rota no build (12 rotas) | health checks |

*Backup/restore do banco: runbook da Fase 12; restore test exige o
plano contratado (pendente do Owner).
