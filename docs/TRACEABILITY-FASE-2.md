# Rastreabilidade — Fase 2 (41-TRACEABILITY)

Escopo: Identity & Access contra Supabase Auth (DEC-TECH-005). Tenant do ator
sempre resolvido do cadastro local; identidade verificada pelo provedor.

| REQ | Regra/Decisão | Domínio | Arquivo | Teste | Aceite |
|---|---|---|---|---|---|
| REQ-PLATFORM-001 | 02 contexto, 33 MFA | Session, SessionService | `src/domain/session.ts`, `src/application/session-service.ts`, `auth-ports.ts` | `tests/unit/session-policy.test.ts` | MFA exigido p/ admins; contexto do backend |
| REQ-PLATFORM-001 | DEC-TECH-005 e-mail/senha+MFA, OTP telefone | AuthProvider | `src/infrastructure/supabase/auth-provider.ts` | `tests/integration/supabase-auth-live.test.ts` (gated) | fluxos do provedor, falha determinística |
| REQ-PLATFORM-001 | vínculo identidade local | UserRepository estendido (MINOR aditivo) | `repositories.ts`, adaptadores memory/supabase | `session-policy.test.ts` (por e-mail e telefone) | sem usuário local = NOT_FOUND |

Fora do escopo (aguardando decisão do Owner): UNSPECIFIED-001..004.
Twilio Verify operacional (DEC-NOT-002): fase de notificações.
