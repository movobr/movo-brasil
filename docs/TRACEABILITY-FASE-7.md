# Rastreabilidade — Fase 7 (41-TRACEABILITY)

Escopo: orquestração fim-a-fim (42) + eventos (17) + migration 0002.
Adapter vivo Google Maps e transporte Supabase Realtime: fases de infra
com credenciais (portas + fakes aqui).

| REQ | Regra/Decisão | Domínio | Arquivo | Teste | Aceite |
|---|---|---|---|---|---|
| REQ-RIDE-001 | 42 request→match→accept→complete | RideOrchestrator | `src/application/ride-orchestrator.ts` | `tests/orchestration/ride-orchestrator.test.ts` (jornada Pix completa) | fluxos fim-a-fim |
| REQ-PAY-001 | DEC-PAY-003 gate pré-pago | startMatching via intents | `ride-orchestrator.ts` | Pix bloqueado antes do paid; cartão segue | dispatch após pago |
| REQ-PLATFORM-001 | 05 tenant ACTIVE p/ novas corridas | requestRide | `ride-orchestrator.ts` | tenant não-ACTIVE recusado; cross-tenant negado | isolamento |
| — | 17 envelope + eventos da corrida | RIDE_EVENTS + emit | `event-ports.ts`, `ride-orchestrator.ts` | envelope version/tenant/correlation em todos | eventos versionados |
| — | 16 rota via adapter | MapsProvider + Fake | `maps-ports.ts`, `tests/helpers/fakes.ts` | tarifa calculada da rota | cliente fora da tarifa |
| — | 11 rides/payments | migration 0002 + repos | `db/migrations/0002*`, `supabase/ride-repository.ts`, `payment-store.ts` | `migration-contract.test.ts` (0002) | propriedade, RLS |
| — | 09 permissões de corrida | DERIVED-009 ride.request/accept | `ride-orchestrator.ts` | fluxos autorizados por ato | padrão verbo/recurso |
