# Rastreabilidade — Fase 9 (41-TRACEABILITY)

Escopo: billing SaaS + operações admin de backend (painéis 22/23 são
superfície; aqui permissões, auditoria e regras). Tabela SQL de
subscriptions adiada (fora do 11 — mesma classe de UNSPECIFIED-002).

| REQ | Regra/Decisão | Domínio | Arquivo | Teste | Aceite |
|---|---|---|---|---|---|
| — | DEC-SaaS-001..004 catálogo | PLANS | `src/domain/subscription.ts` | `tests/unit/subscription.test.ts` (valores/limites) | preços e limites V1 |
| — | DEC-SaaS-005 trial 14 d | startTrial + limites demo | `subscription.ts` | trial grátis, limites 50/2000, expira | trial sem cobrança |
| — | DEC-SaaS-006 grace 7 d | PAST_DUE operacional + lapse | `subscription.ts`, `subscription-service.ts` | opera no grace, SUSPENDED após, dados legíveis (status) | grace ativo, bloqueio após |
| — | DEC-SaaS-007 billing separado | ledger `saas` | `subscription-service.ts` | charge em 2 lançamentos saas | ledgers separados |
| — | 08 tabela de transições | SUBSCRIPTION_TRANSITIONS (DERIVED-014) | `subscription.ts` | transições válidas/inválidas | política antes do billing |
| — | 22/23 permissão + auditoria | BILLING_PERMISSIONS + audit | `subscription-service.ts` | fluxos auditados | permissão explícita |
