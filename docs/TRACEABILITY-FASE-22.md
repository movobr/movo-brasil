# Rastreabilidade — Fase 22 (41-TRACEABILITY)

Escopo: jornada do passageiro no mobile (21: tracking, pagamento,
histórico). Busca de destino e request exigem adapter Google e API de
rides (futuras); avaliação segue UNSPECIFIED-008.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 21 áreas 7–10 tracking | TrackingScreen + lib | `lib/tracking.ts`, `screens/PassengerScreens.tsx` | labels + recibo real | matching→concluída |
| — | 16 stale no device | isDriverPositionStale | `lib/tracking.ts` | 19 s ok, 21 s stale | sem falsa atualidade |
| — | 21 área 11 + 15 | PaymentSheet pix/cartão | `PassengerScreens.tsx` | só pix/card aceitos; tipos de `domain/payment` | método sem processar |
| — | 40 cliente não paga | sem chamada de pagamento | `PassengerScreens.tsx` | processamento no servidor | autoridade servidor |
| — | 21 área 13 histórico | HistoryScreen + total pago | `PassengerScreens.tsx` | soma paidMinor (nunca cotação) | lista + total |
