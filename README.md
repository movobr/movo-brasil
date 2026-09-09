# MOVO Brasil — Fase 1: Fundação multi-tenant

Escopo fechado da fase: tenancy, identidade, configuração, RBAC, auditoria e
seed demo (REQ-PLATFORM-001 + base de REQ-WL-001). Sem camada HTTP (nenhum
endpoint documentado no Blueprint para esta fase), sem pricing/matching/
pagamentos (fases donas futuras).

## Stack (decisões do Blueprint)

- Backend: TypeScript strict, modular monolith (`src/domain`, `src/application`, `src/infrastructure`)
- Banco: PostgreSQL via Supabase Cloud (migration `db/migrations/0001_foundation.sql`)
- Auth: Supabase Auth (integração viva exige credenciais — ver abaixo)

## Comandos reais

```bash
npm install
npm run typecheck   # tsc --noEmit (G1)
npm run lint        # sem dependências: proíbe `any` explícito e console.* em src/ (G1)
npm test            # vitest offline: unit + isolamento + contrato (G2/G3)
npm run build       # emit para dist/
npm run test:integration  # exige SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

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
