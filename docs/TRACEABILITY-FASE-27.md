# Rastreabilidade — Fase 27 (41-TRACEABILITY)

Escopo: mapeamento papel→permissão promovido a regra de produção
(Owner DECIDED 2026-09-10, era UNSPECIFIED-007). Mudanças exigem nova
decisão do Owner (46-CHANGE-CONTROL).

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 09 + Owner | PRODUCTION_ROLE_PERMISSIONS (frozen) | `application/role-permissions.ts` | 4 testes (6 papéis, least-privilege, ride.rate, desconhecido) | fonte única |
| — | demo usa produção | reexport, fixture removida | `apps/web/lib/demo-auth.ts` | web suite verde | sem dupla verdade |
