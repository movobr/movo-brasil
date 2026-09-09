# Rastreabilidade — Fase 14 (41-TRACEABILITY)

Escopo: jornada do motorista na web (telas 26 driver 2/3/7). Oferta
recebida usa matching real; ganhos derivam do split sobre o cotado
(reconciliação final em fase própria). Navegação dedicada e telas
restantes do driver: fases de superfície.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 26 driver 2 disponibilidade | toggle via serviço | `app/driver/page.tsx`, `actions.ts` | gate de verificação no serviço (Fase 8) | disponibilidade |
| — | 26 driver 3 ofertas | MATCHING do tenant + aceite | `app/driver/page.tsx` | aceite passa pelo gate 58 | ofertas reais |
| REQ-FIN-001 | 26 driver 7 ganhos 80% | split sobre cotado | `app/driver/earnings/page.tsx` | aritmética do split (Fase 6) | ganhos |
| — | 09 driver.read | getDriverProfileByUser | `onboarding-service.ts` | autorizado por tenant | permissão explícita |
