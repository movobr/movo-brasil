# Rastreabilidade — Fase 21 (41-TRACEABILITY)

Escopo: jornada do motorista no mobile (20) + cadência de localização
(16). Sincronização servidor (disponibilidade, ofertas, aceite) chega
com a API de driver; aqui, UI sobre dados injetados + motores reais.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 16 cadência 5/15 s | tracker por porta | `lib/location-tracker.ts` | emissão só após cadência | regra exata |
| — | 16 freshness | motor contratado | `location-tracker.ts` | expired aos 61 s | fonte única |
| — | 20 áreas 3/4/5/7 | DriverScreen | `screens/DriverScreen.tsx` | rota no App | disponibilidade, ofertas, ativa, ganhos |
| — | 20 critical states | loading/empty/error/stale | `DriverScreen.tsx` | ramos renderizados | 5 estados |
| — | 20 safety | aceite em 2 toques | `DriverScreen.tsx` | confirmId | deliberado |
| — | 20 área 6 handoff | URI geo: | `lib/navigation.ts` | URI exata | sem SDK no cliente |
| — | ganhos reais | splitFare | `DriverScreen.tsx` | 80% de 2500 = 2000 | motor real |
