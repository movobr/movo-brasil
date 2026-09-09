# Rastreabilidade — Fase 15 (41-TRACEABILITY)

Escopo: auth real no web (login, sessão selada, MFA) e aposentadoria dos
atores demo. Mapeamento papel→permissão de produção: UNSPECIFIED-007.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | DEC-TECH-005 + 33 MFA | login vivo/demo + SessionService | `app/login/*`, `lib/demo-auth.ts` | `lib/session.test.ts` (round-trip, MFA via policy) | sessão do backend |
| — | 02 contexto do servidor | requireSession em actions/telas | `lib/require-session.ts`, `ride/*`, `driver/*`, `admin/*` | sem sessão = forbidden | deny-by-default |
| — | 09 ride.cancel do passageiro | advanceRide exige ride.cancel p/ CANCELLED | `ride-orchestrator.ts` | cancelamento passageiro sem dispatch | permissão explícita |
| — | 72 sem segredos no código | SESSION_SECRET via env | `lib/session.ts` | falha explícita sem env | segredos em env |
| — | UNSPECIFIED-007 registrado | mapeamento demo explícito | `lib/demo-auth.ts` | marcado como fixture | decisão pendente |
