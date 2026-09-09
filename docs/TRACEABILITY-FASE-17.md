# Rastreabilidade — Fase 17 (41-TRACEABILITY)

Escopo: painel operacional do tenant (24). Mapa vivo sobre realtime e
ações de disponibilização de motoristas em campo: fases de
infra/dispositivo com transporte e localização.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 24 fila + ativas + alertas | OpsPage por estado | `app/ops/page.tsx` | listas do orquestrador real | gestão em tempo de operação* |
| — | 24 dispatch manual + 32 auditoria | manualDispatchAction | `app/ops/actions.ts` | override auditado | ação permitida por política |
| — | 24 realtime UX | carimbo de atualização | `app/ops/page.tsx` | timestamp + aviso sem realtime | sem falsa atualidade |
