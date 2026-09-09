# Rastreabilidade — Fase 4 (41-TRACEABILITY)

Escopo: política de dispatch/matching pura (sem timers, sem entrega de
ofertas, sem transação de banco — runtime/persistência nas fases donas).

| REQ | Regra/Decisão | Domínio | Arquivo | Teste | Aceite |
|---|---|---|---|---|---|
| REQ-MATCH-001 | DEC-DISP-001/006, 13 elegibilidade | isEligible (7 critérios) | `src/domain/dispatch.ts` | `tests/unit/dispatch.test.ts` (matriz + borda 20 s) | stale-location-excluded |
| REQ-MATCH-001 | DEC-DISP-001/005, 13 ranking | rankCandidates | `src/domain/dispatch.ts` | ordem ETA/frescura/ociosidade/UUID | determinístico |
| REQ-MATCH-001 | DEC-DISP-002/003/004, 13 ondas | WAVES + planWaveOffers | `src/domain/dispatch.ts` | raios 2/4/7, teto 5, sem re-oferta | wave-policy |
| REQ-MATCH-001 | DEC-DISP-007, 13 vencedor | acceptRide | `src/domain/dispatch.ts` | primeiro vence, demais CONFLICT, sem mutação | single-winner |
| REQ-MATCH-001 | DEC-DISP-008, 13 sem disponibilidade | closeWithoutDriver | `src/domain/dispatch.ts` | outcome + evento, aceite posterior rejeitado | falha recuperável |
