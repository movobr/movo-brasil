# Rastreabilidade — Fase 20 (41-TRACEABILITY)

Escopo: política de localização (16). Cadência de envio (5 s/15 s) é
comportamento do cliente (fase mobile driver futura); retenção 90 d/5 a
exige store de localização (infra); polígonos vêm da config do tenant
(UNSPECIFIED-002). Aqui: as regras servidoras puras + fiação no dispatch.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 16 freshness 20/60 s | classifyFreshness + prunePool | `domain/driver-location.ts` | bordas 20/21/60/61 s | regra exata |
| — | 16 >60 s fora do pool | removeExpiredCandidates | `domain/dispatch.ts` | 60 fica, 61 sai | fiação pré-ondas |
| — | 16 fonte única | STALE usa MATCHING_STALE | `domain/dispatch.ts` | suite dispatch intacta | sem dupla verdade |
| — | 16 geofence + 100 m | polígono + tolerância | `domain/geofence.ts` | dentro/fora/faixa 50 m/500 m | pickup/dropoff |
| — | 16 retenção | sem store: sem código | — | — | infra futura |
