# MOVO Brasil — Fase 1: Fundação multi-tenant

Escopo fechado da fase: tenancy, identidade, configuração, RBAC, auditoria e
seed demo (REQ-PLATFORM-001 + base de REQ-WL-001). Sem camada HTTP (nenhum
endpoint documentado no Blueprint para esta fase), sem pricing/matching/
pagamentos (fases donas futuras).

## Stack (decisões do Blueprint)

- Backend: TypeScript strict, modular monolith (`src/domain`, `src/application`, `src/infrastructure`)
- Banco: PostgreSQL via Supabase Cloud (migrations em `packages/backend/db/migrations/`)
- Auth: Supabase Auth (integração viva exige credenciais — ver abaixo)

## Comandos reais (monorepo: raiz delega aos workspaces)

```bash
npm install
npm run typecheck   # backend tsc + web tsc (G1)
npm run backend:lint
npm run test        # backend vitest + web vitest (G2/G3)
npm run build       # backend dist/ + next build (G1)
npm run web:dev     # Next em desenvolvimento
npm run backend:test --workspace @movo/brasil  # escopo por pacote
```

Comandos por pacote vivem em `packages/backend` e `apps/web`.

Sem credenciais Supabase, os testes de integração viva pulam
automaticamente; todo o restante roda offline.

## Decisões registradas nesta fase

- DERIVED-001: Fase 1 = fundação (ordenação pela cadeia do 42-DEPENDENCY-MAP).
- DERIVED-002: vitest como runner (38 não prescreve ferramenta).
- DERIVED-003: nomes das chaves de configuração (comportamento vem do 05).
- DERIVED-004: permissões `tenant.create/activate/suspend` (padrão do 09).
- DERIVED-005: backend com service_role + RLS deny-by-default (padrão Supabase, 00 §7).
- UNSPECIFIED-001: retomada SUSPENDED→ACTIVE sem transição documentada (tabela fechada a respeita).
- UNSPECIFIED-002: persistência SQL de configuração/branding (tabelas fora do 11 adiada).
- UNSPECIFIED-003: vocabulário de status de usuário (11 não lista valores).
- UNSPECIFIED-004: critérios de completude de branding (06 não define).

## Fase 2 — Identity & Access (DEC-TECH-005)

Sessão e contexto de ator via Supabase Auth: e-mail/senha+MFA (admins web),
OTP de telefone (passageiro/motorista). Tenant sempre do cadastro local.
Testes vivos pulam sem `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`.
Rastreabilidade: `docs/TRACEABILITY-FASE-2.md`.

## Fase 3 — Pricing V1 (DEC-PRICE-001..009, REQ-PRICING-001)

Cálculo puro server-authoritative em centavos inteiros (arredondamento único
ao final): catálogo carro/moto, espera com 3 min grátis, pedágio integral,
surge 1.00–1.80 sobre componentes antes de descontos/pedágios, cupom + 1
promoção automática com teto no subtotal, cotação expira em 2 min ou com
troca de origem/destino.
Rastreabilidade: `docs/TRACEABILITY-FASE-3.md`.

## Fase 4 — Dispatch/matching V1 (DEC-DISP-001..008, REQ-MATCH-001)

Política pura e determinística: elegibilidade (7 critérios), ranking
lexicográfico (ETA, frescura, ociosidade, UUID), ondas 2/4/7 km com até 5
ofertas e 12 s, vencedor único (aceites tardios = CONFLICT), outcome
`no_driver_available` + evento após a onda 3.
Rastreabilidade: `docs/TRACEABILITY-FASE-4.md`.

## Fase 5 — Corrida + cancelamento (REQ-RIDE-001, REQ-CXL-001)

Máquina de estado fechada (11 estados, triggers atribuídos, pagamento só
por evento verificado), vencedor único, taxas R$ 6,00/R$ 10,00, janela
grátis de 2 min, refund `refund_pending` para pré-pagas canceladas.
Rastreabilidade: `docs/TRACEABILITY-FASE-5.md`.

## Fase 6 — Pagamentos + split (REQ-PAY-001, REQ-FIN-001)

Pix pré-pago (10 min), idempotência fim-a-fim, webhook Mercado Pago com
assinatura oficial, split 80/17/3 exato, settlement ledger-driven,
SaaS separado de corridas. Tabela SQL de ledger adiada (fora do 11).
Rastreabilidade: `docs/TRACEABILITY-FASE-6.md`.

## Fase 7 — Orquestração fim-a-fim (42, REQ-RIDE-001/REQ-PAY-001)

RideOrchestrator: request→pricing→ride→pagamento→dispatch→conclusão, gate
pré-pago, bloqueio de tenant não-ACTIVE, eventos versionados (17), rota via
adapter (16), migration 0002 (rides/payments + RLS).
Rastreabilidade: `docs/TRACEABILITY-FASE-7.md`.

## Fase 8 — Onboarding (58, 20/21)

Verificação fechada (APPLICATION→APPROVED), disponibilidade, perfis e
veículos, gate de aceite para não verificados, migration 0003 + RLS.
Rastreabilidade: `docs/TRACEABILITY-FASE-8.md`.

## Fase 9 — SaaS billing (08, DEC-SaaS, 22/23)

Planos Launch/Growth/Enterprise, trial 14 dias, grace 7 dias, cobrança no
ledger `saas` separado, limites por plano, operações auditadas.
Rastreabilidade: `docs/TRACEABILITY-FASE-9.md`.

## Fase 10 — Web Next.js (DEC-TECH-002, 26/27/28/29/71)

Monorepo (`packages/backend`, `apps/web`): home do tenant com tema,
admin de tenants (lista + detalhe com assinatura e auditoria), estados
de UI, offline, responsivo e base acessível — tudo em dados dos
serviços reais (demo A/B sem credenciais, Supabase com).
Rastreabilidade: `docs/TRACEABILITY-FASE-10.md`.

## Fase 11 — Mobile Expo (DEC-TECH-003, 20/21/64/65)

Casca + auth OTP, home temática, cotação com o motor real (estimativa),
permissões com finalidade/fallback, sessão segura, versionamento e canais.
Rastreabilidade: `docs/TRACEABILITY-FASE-11.md`.

## Fase 12 — Endurecimento G3/G5 (33/36/61/62/17)

Logs/métricas/health, rate limiting, headers + CORS, outbox idempotente,
runbook de backup/DR, smoke de carga local sem afirmação de produção.
Rastreabilidade: `docs/TRACEABILITY-FASE-12.md`.

## Fase 13 — Jornada do passageiro na web (26)

Cotação, confirmação, matching, corrida, cancelamento com taxa e
histórico — Server Actions sobre os serviços reais, motorista demo
verificado, Pix travando matching sem pago.
Rastreabilidade: `docs/TRACEABILITY-FASE-13.md`.

## Fase 14 — Jornada do motorista na web (26)

Disponibilidade, ofertas do matching com aceite verificado e ganhos
(80% do cotado) — tudo sobre os serviços reais.
Rastreabilidade: `docs/TRACEABILITY-FASE-14.md`.

## Fase 15 — Auth web real (DEC-TECH-005, 33)

Login, sessão selada HMAC, MFA pela política real, atores demo
aposentados (multi-ator de verdade: passageiro, operador, motorista,
admin). `SESSION_SECRET` + `ALLOW_DEMO_AUTH=true` no dev.
Rastreabilidade: `docs/TRACEABILITY-FASE-15.md`.

## Fase 16 — Deploy staging/produção (37, DEC-OPS)

Docker multi-stage, migrator com dry run real, stacks Swarm + Traefik,
CI com os 8 gates (aprovação manual em `production`), health check.
Rastreabilidade: `docs/TRACEABILITY-FASE-16.md`.

## Fase 17 — Painel operacional (24)

Fila, corridas ativas, alertas e dispatch manual auditado, com carimbo
de atualização e sem falsa atualidade.
Rastreabilidade: `docs/TRACEABILITY-FASE-17.md`.

## Fase 18 — Chat + notificações (19/18)

Chat da corrida (participantes + suporte, dedupe, denúncia), catálogo
de notificações por evento com retry/fallback, inbox in-app, eventos
do orquestrador gerando notificações reais no demo.
Rastreabilidade: `docs/TRACEABILITY-FASE-18.md`.

## Fase 19 — Recibo pós-corrida (26-9)

Recibo determinístico (tarifa, split 80/17/3, pagamento) na corrida
concluída. Avaliação sem contrato: UNSPECIFIED-008, sem código.
Rastreabilidade: `docs/TRACEABILITY-FASE-19.md`.

## Fase 20 — Política de localização (16)

Freshness 20/60 s, prune do pool fiado no dispatch, geofence com 100 m
de tolerância. Cadência, retenção e polígonos: infra/config futuras.
Rastreabilidade: `docs/TRACEABILITY-FASE-20.md`.

## Fase 21 — Driver no mobile (20/16)

Painel do motorista (disponibilidade, ofertas com aceite em 2 toques,
corrida ativa, ganhos pelo split real), tracker 5/15 s por porta e
handoff de navegação. Sync servidor: API futura.
Rastreabilidade: `docs/TRACEABILITY-FASE-21.md`.

## Fase 22 — Passageiro no mobile (21)

Tracking com aviso de stale, recibo real, seleção Pix/cartão sem
processar no cliente, histórico com total. Busca/request: futuros.
Rastreabilidade: `docs/ACCEPTANCE-CRITERIA-40.md`.

## Fase 24 — Branding gerenciável (06/07, GAP 1 do aceite)

Tenant admin com `branding.manage` edita marca do próprio tenant
(nome, logo https, cor) com validação, auditoria e fallback seguro.
Persistência em `tenant_branding` (migration 0004).
Rastreabilidade: `docs/TRACEABILITY-FASE-24.md`.

## Fase 25 — Acessibilidade crítica (40-UX, GAP 3 do aceite)

axe-core wcag2a/aa sobre login, cotação e marca do tenant: 0 violações.
Smoke das 8 rotas (Fase 23) continua verde.
Rastreabilidade: `docs/TRACEABILITY-FASE-25.md`.
