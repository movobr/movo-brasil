# Rastreabilidade — Fase 1 (41-TRACEABILITY)

Cadeia exigida: `REQ -> RULE/ADR -> DOMAIN -> DB/API/EVENT -> SCREEN -> TEST -> ACCEPTANCE EVIDENCE`.

| REQ | Regra/Decisão | Domínio | Arquivo | Teste | Aceite |
|---|---|---|---|---|---|
| REQ-PLATFORM-001 | DEC-BIZ-001/002, 02 cross-tenant, 05 lifecycle | Tenant, User, Authorization | `src/domain/tenant.ts`, `user.ts`, `authorization.ts`, `src/application/tenant-service.ts` | `tests/isolation/tenant-isolation.test.ts` (cross-tenant-read/write-denied) | Tenant A não acessa Tenant B |
| REQ-PLATFORM-001 | 09 RBAC, 02 contexto | Authorization, User | `src/domain/authorization.ts`, `user.ts` | `tests/unit/authorization.test.ts` | permissão explícita + escopo |
| REQ-PLATFORM-001 | 05 lifecycle, 11 tabelas | Tenant | `src/domain/tenant.ts`, `db/migrations/0001_foundation.sql` | `tests/unit/tenant-lifecycle.test.ts`, `tests/contract/migration-contract.test.ts` | transições válidas/inválidas |
| REQ-WL-001 (base) | 06 branding, 07 config | BrandingConfig, TenantConfiguration | `src/domain/branding.ts`, `tenant-configuration.ts` | `tests/unit/tenant-configuration.test.ts` | fallback seguro, chaves desconhecidas rejeitadas |
| — | 32 audit | AuditEvent | `src/domain/audit.ts`, `db/migrations/0001_foundation.sql` (audit_events) | isolamento: trilha por tenant + correlationId | append-only por tenant |
| — | 39 seed | — | `db/seeds/001_demo_tenants.sql` | `tests/isolation/tenant-isolation.test.ts` (padrão A/B) | Tenant A/B neutros |
| — | 11 database | — | `db/migrations/0001_foundation.sql` | `tests/contract/migration-contract.test.ts` | colunas, FKs, RLS deny-by-default |

Sem SCREEN nesta fase (nenhuma tela documentada para fundação). Sem API HTTP
(nenhum endpoint documentado para esta fase — 52 é nível produto).
