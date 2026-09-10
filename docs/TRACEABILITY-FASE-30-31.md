# Rastreabilidade — Fases 30–31 (41-TRACEABILITY)

Escopo: backend vivo contra o Supabase real + correção de segurança
achada pelo E2E (client service_role nunca carrega sessão de usuário)
+ permissões da tabela de produção no login.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 37/DATABASE_URL | apply-migrations.sh + pooler sa-east-1 | `scripts/`, banco real | 9 tabelas + RLS | 0001–0004 no real |
| — | DEC-TECH-005 vivo | signIn + vínculo + sessão reais | banco real | LOGIN VIVO OK (usuário temporário, removido) | ponta a ponta |
| — | 33 MFA | PLATFORM_ADMIN sem MFA barrado | real | UNAUTHORIZED correto | política aplica |
| — | Fase 31: clients separados | createPublicSupabaseClient | `client.ts`, `login/actions.ts` | E2E passou após a separação | sem mistura |
| — | Fase 27 aplicada | [] resolve pela matriz | `session-service.ts` | teste novo (TENANT_ADMIN) | login com permissões |
| — | teste live usa public | supabase-auth-live | teste | suite verde sem vivo | sem regressão |
