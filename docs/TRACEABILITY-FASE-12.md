# Rastreabilidade — Fase 12 (41-TRACEABILITY)

Escopo: endurecimento G3/G5 exercível offline. Teste de restore real,
carga em staging e segredos de produção: fases de infra com credenciais.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 36 logs/métricas/health | Logger, MetricsRegistry, checkHealth | `observability/*` | `tests/unit/observability.test.ts` | pilares + correlação |
| — | 33 rate limiting | RateLimiter (limites explícitos) | `application/rate-limit.ts` | orçamento, refill, isolamento | controle presente |
| — | 33 headers + CORS allowlist | next headers, corsHeadersFor | `apps/web/next.config.ts`, `lib/cors.ts` | `cors.test.ts` (deny default) | baseline |
| — | 17/DEC-RT-002 outbox | OutboxEvent + Dispatcher | `domain/outbox.ts`, `memory/outbox.ts` | entrega única, falha sem consumer | idempotência |
| — | 61 backup/restore/DR | runbook + script gated | `docs/BACKUP-RESTORE-RUNBOOK.md`, `scripts/db-backup.sh` | script falha explicando sem DATABASE_URL |runbook (restore real pendente) |
| — | 62 carga mínima | smoke local sem afirmação | `tests/perf/smoke.perf.test.ts` | números registrados no log | sem inferência p/ produção |
