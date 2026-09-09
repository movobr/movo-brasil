# Rastreabilidade — Fase 5 (41-TRACEABILITY)

Escopo: máquina de estado da corrida + política de cancelamento/reembolso.
Conclusão de refund pelo provedor pertence à fase de pagamentos.

| REQ | Regra/Decisão | Domínio | Arquivo | Teste | Aceite |
|---|---|---|---|---|---|
| REQ-RIDE-001 | 12 tabela fechada + invariantes | Ride | `src/domain/ride.ts` | `tests/unit/ride-state-machine.test.ts` (happy path, inválidas, sem duplo complete, vencedor único) | valid-transitions-only, invalid-transition-rejected |
| REQ-RIDE-001 | 12/CXL-006 trigger verificado p/ pagamento | transitionTo | `src/domain/ride.ts` | triggers de app rejeitados; reconciliation aceita | pagamento não inferido pela UI |
| REQ-CXL-001 | CXL-001..005 taxas 600/1000, janela 2 min | assessCancellation | `src/domain/cancellation.ts` | `tests/unit/cancellation.test.ts` (grátis, janela, chegada, motorista) | fee-rule |
| REQ-CXL-001 | CXL-007 refund_pending | requestRefundForCancelledPrepaid | `src/domain/cancellation.ts` | pendente criado; não pré-pago = null | refund-pending, provider-confirmation (fase pagtos) |
