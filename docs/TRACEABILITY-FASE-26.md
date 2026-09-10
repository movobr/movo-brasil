# Rastreabilidade — Fase 26 (41-TRACEABILITY)

Escopo: avaliação bilateral 1–5 (Owner DECIDED 2026-09-10, era
UNSPECIFIED-008). Sem média agregada (leitura futura, sem contrato);
sem tabela SQL (contrato 11 não lista ratings — mesma classe de
UNSPECIFIED-002); submit no mobile exige API de driver (futura).

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | Owner: bilateral 1–5 | Rating.submit + RatingService | `domain/rating.ts`, `application/rating-service.ts` | 3 testes (direções, limites, duplicada, outsider, aberta) | 1–5 int, 1 por avaliador |
| — | só concluída + participante | status + membership | `rating-service.ts` | IN_PROGRESS e stranger negados | regra exata |
| — | ride.rate | permissão nova, só raters | `role-permissions.ts` | matriz: PASSENGER+DRIVER sim, demais não | mínimo necessário |
| — | UI web | form + estado avaliado | `app/ride/[id]/page.tsx`, `actions.ts` | rota no build | participante avalia |
