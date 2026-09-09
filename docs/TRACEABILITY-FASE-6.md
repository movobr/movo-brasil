# Rastreabilidade — Fase 6 (41-TRACEABILITY)

Escopo: pagamentos Pix/cartão (domínio + portas + Mercado Pago vivo),
idempotência, webhook, split 80/17/3 e ledger. Tabela SQL de ledger adiada
(contrato 11 não a lista — mesma classe de UNSPECIFIED-002).

| REQ | Regra/Decisão | Domínio | Arquivo | Teste | Aceite |
|---|---|---|---|---|---|
| REQ-PAY-001 | DEC-PAY-002/003 Pix pré-pago, QR expira 10 min | PaymentIntent | `src/domain/payment.ts` | `tests/unit/payments.test.ts` (criação, expiração) | expiração local |
| REQ-PAY-001 | DEC-PAY-005 idempotência, 15 fluxo | IdempotencyRegistry + chave por intent | `src/domain/idempotency.ts`, `payment-service.ts` | reuso = CONFLICT | idempotency |
| REQ-PAY-001 | 15 webhook assinado, duplicata, fora-de-ordem | applyProviderEvent | `src/domain/payment.ts` | applied/duplicate/ignored; sem assinatura = UNAUTHORIZED | signed-webhook, reconciliation |
| REQ-PAY-001 | DEC-PAY-001 gateway MP | MercadoPagoProvider (validador oficial) | `src/infrastructure/payments/mercadopago-provider.ts` | coberto offline pelo fake; vivo exige credenciais | gateway V1 |
| REQ-PAY-001 | CXL-006/007 refund backend-only + pending | markRefundPending + refund_pending | `src/domain/payment.ts`, `cancellation.ts` | fluxo paid→pending→refunded | client-cannot-mark-paid, refund-pending |
| REQ-FIN-001 | DEC-FIN-001 split 80/17/3, base elegível | splitFare (inteiros, resto p/ MOVO) | `src/domain/ledger.ts` | `tests/unit/ledger-split.test.ts` (2800 exato, patrocínio MOVO) | ledger-accurate |
| REQ-FIN-001 | DEC-FIN-002 taxa gateway do tenant | débito tenant no settlement | `src/domain/ledger.ts` | taxa não reduz motorista | — |
| REQ-FIN-001 | DEC-FIN-003/004 settlement idempotente, SaaS separado | postSettlement + compensate, ledger ride/saas | `src/domain/ledger.ts` | chaves determinísticas, estorno sem mutar | idempotent-settlement, separate-saas-ledger |
