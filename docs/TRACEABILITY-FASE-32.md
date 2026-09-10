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
  20 meios. SDK íntegro para leitura.
- `payment().create` Pix R$1,00 com `RequestOptions` (idempotência) →
  403 `Payer email forbidden` (mesma barreira do REST).

## Cartão TESTE (dois PANs enviados pelo Owner)
- PAN 1 (5480…) e PAN 2 (4235…) via SDK `card_token().create` → 400 G001.
- PAN 2 via REST `POST /v1/card_tokens?public_key=` → **token criado**
  (`ac0aa78b…`, first_six 423564). Cartão válido; o SDK 3.x monta a
  chamada de tokenização de outro jeito (detalhe do SDK, sem valor
  investigar agora — escrita segue via REST).
- Pagamento com o token → mesmo 403 `Payer email forbidden`.
- Arquivos com PAN removidos de /tmp após o teste.

## Veredito
Tudo que depende só das credenciais funciona (auth, catálogo, Pix
leitura, tokenização). Tudo que cria DINHEIRO (Pix ou cartão) exige
test user da aplicação — barreira de política, não de código.

## MCP Server do MP (tentativa 2026-09-10)
- Configurado via `hermes mcp` (HTTP + stdio mcp-remote) e via curl
  direto: 401 persistente "No user session found" — o servidor exige
  sessão OAuth, não aceita o Access Token TEST por credencial direta.
- `mcp-remote@0.8.6` nem tem flag `--header` (doc do MP desatualizada).
- Config removida (sem config morta). Para usar: criar aplicação
  OAuth no painel MP e seguir o fluxo interativo.
