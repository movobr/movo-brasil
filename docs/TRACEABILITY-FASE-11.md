# Rastreabilidade — Fase 11 (41-TRACEABILITY)

Escopo: casca mobile Expo + 3 telas do inventário 26 (auth, home, cotação).
Demais telas de 20/21/26, navegação dedicada e builds em device: fases
de superfície/release com credenciais e Expo Go.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | DEC-TECH-003 Expo + TS strict | apps/mobile | `apps/mobile/*`, `app.json` | `mobile:typecheck` 0 | stack decidida |
| — | 21 auth + OTP telefone | AuthScreen | `src/screens/AuthScreen.tsx` | validação BR/E.164 + OTP em teste | entrada verificada |
| REQ-WL-001 | 06 tema por tenant | paletteFor | `src/lib/theme.ts` | fallback + mapeamento em teste | sem vazamento |
| REQ-PRICING-001 | 14 mesmo motor (estimativa) | estimateFare | `src/lib/quote.ts` | 2800 via engine real em teste | backend confirma |
| — | 64 permissões + sessão segura | PERMISSION_POLICIES, SessionStore | `permissions.ts`, `session-store.ts`, `secure-session-store.ts` | finalidade+fallback p/ cada permissão | negação com fallback |
| — | 65 release | versionamento, canais, scheme | `app.json`, `eas.json` | versionCode/buildNumber, sem segredos | identidade por tenant |
