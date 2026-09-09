# Rastreabilidade — Fase 8 (41-TRACEABILITY)

Escopo: onboarding motorista/passageiro + verificação + disponibilidade.
Telas dos apps (20/21) e provedores de validação documental: fases de
superfície/mercado (58 veda inventar requisitos legais).

| REQ | Regra/Decisão | Domínio | Arquivo | Teste | Aceite |
|---|---|---|---|---|---|
| — | 58 lifecycle fechado | DriverProfile | `src/domain/driver-profile.ts` | `tests/unit/onboarding.test.ts` (cadeia, inválidas, suspensão) | sem ofertas antes de APPROVED |
| — | 13 elegível + 20 disponibilidade | canReceiveOffers + gate no aceite | `driver-profile.ts`, `ride-orchestrator.ts` | aceite bloqueado p/ não verificado | verificação antes de oferta |
| — | 09 driver.read/manage | OnboardingService | `src/application/onboarding-service.ts` | cross-tenant negado, auditoria | autorização explícita |
| — | 10/11 profiles + vehicles | entidades + repos | `passenger-profile.ts`, `vehicle.ts`, `supabase/onboarding.ts` | registro, categoria, migration 0003 | propriedade por tenant |
| — | 11 migration 0003 | DDL + RLS | `db/migrations/0003_onboarding.sql` | `migration-contract.test.ts` (0003) | FKs, unique, RLS |
