# Rastreabilidade — Fase 25 (41-TRACEABILITY)

Escopo: fecha GAP 3 do aceite (40-UX) — suite axe-core nos fluxos
críticos web. Smoke a11y (Fase 23) continua cobrindo as 8 rotas
servidas; jest-axe novo não conflita (nomes distintos).

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 40 critical flows a11y | axe-core wcag2a/aa | `apps/web/lib/a11y.test.ts` | 3 testes (login, cotação, marca) | 0 violações |
| — | jsdom sem canvas | ruído documentado | `a11y.test.ts` (cabeçalho) | color-contrast indisponível, sem falso +/− | ambiente, não produto |
