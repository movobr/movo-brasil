# Rastreabilidade — Fase 24 (41-TRACEABILITY)

Escopo: fecha GAP 1 do aceite (40) — branding gerenciável por tenant
(06/07) com UI. Upload binário de assets continua fora (ativação de
assets); demais grupos de config seguem UNSPECIFIED-002.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 06 theme safety + fallback | branding persistido > fixture > null | `lib/backend.ts` | home usa brandingForTenant | sem hard-code, sem leak |
| — | 06 asset rules (texto) | validateBranding antes de persistir | `tenant-service.ts` | URL http rejeitada | https + hex |
| — | 07 grupos fechados | BrandingConfig tipado | `domain/branding.ts` | chaves desconhecidas nem compilam | sem JSON arbitrário |
| — | 09 permissão + escopo | branding.manage + authorize | `tenant-service.ts` | cross-tenant e sem-permissão negados | deny-by-default |
| — | 32 auditoria | tenant.update_branding | `tenant-service.ts` | evento no teste | toda mutação |
| — | UI de gestão | form na página do tenant | `app/admin/tenants/[slug]/` | rota no build + smoke | platform admin edita |
| — | 11 persistência | tenant_branding (0004) | `db/migrations/0004*`, supabase repo | memory + supabase | RLS deny-by-default |
