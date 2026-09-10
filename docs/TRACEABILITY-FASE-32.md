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
