# Rastreabilidade — Fase 10 (41-TRACEABILITY)

Escopo: casca web multi-tenant + 3 telas do inventário 26 (home do tenant,
platform admin tenants e detalhe). Demais telas de 26: fases de superfície.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | DEC-TECH-002 Next.js + TS strict | apps/web | `apps/web/*`, `next.config.ts` | `web:typecheck` 0, `next build` 4 rotas | stack decidida |
| REQ-WL-001 | 06 fallback + 27 tokens em runtime | themeStyleFor | `apps/web/lib/theme.ts` | `lib/theme.test.ts` (fallback, mapeamento, sem vazamento) | branding-runtime, theme-isolated |
| — | 71/26 estados de UI | DataStates + OnlineStatus | `apps/web/components/DataStates.tsx` | success/empty/error/forbidden/offline renderizados nas telas | estados definidos |
| — | 23 tenants + detalhe com dados reais | Server Components via serviços | `app/admin/tenants/page.tsx`, `[slug]/page.tsx` | build prerenderiza com seed demo (backend real) | permissão explícita |
| — | 28 responsivo | breakpoints, tabelas→cartões, 44px | `app/globals.css` | regras por breakpoint documentadas no CSS | transformação declarada |
| — | 29 acessibilidade | skip-link, landmarks, foco, live regions, reduced-motion | `layout.tsx`, `DataStates.tsx`, CSS | base auditável; teclado/leitor manual no staging | baseline |
