# Rastreabilidade — Fase 32 (41-TRACEABILITY, PARCIAL)

Escopo: credenciais TEST do Mercado Pago validadas; pagamento teste
fim-a-fim BLOQUEADO por política do MP (test user só pelo painel).

| REQ | Verificação | Evidência | Status |
|---|---|---|---|
| — | Access Token autentica | users/me → conta MOVO BRASIL (BR) | ✅ |
| — | Catálogo de meios | v1/payment_methods lista (status testing) | ✅ |
| — | Criar Pix teste R$1,00 | 403 payer-email-forbidden sem test user | ❌ bloqueado |
| — | Criar test user via API | 403 PolicyAgent UNAUTHORIZED | ❌ só pelo painel |
| — | Fiação de produção | sem webhook secret + sem test user | ⏳ adiada (correta) |

Decisão: NÃO fiar MercadoPagoProvider incompleto no backend vivo.
DemoPaymentProvider continua; envs TEST guardadas no .env local
(não commitado). Para destravar: Owner cria test user (Developers →
Test users) OU envia webhook secret + chaves de produção.

## Revisão via SDK oficial (mercadopago 3.6.0, PyPI)
- `users/me` → 200 (MOVO BRASIL); `payment_methods.list_all` → 200,
  20 meios. SDK íntegro e pronto para uso futuro.
- `payment().create` Pix R$1,00 com `RequestOptions` (idempotência) →
  mesmo 403 `Payer email forbidden`. Barreira confirmada como política
  da conta (test user), não do cliente HTTP. Prova em /tmp (fora do
  repo, descartável).
