# Rastreabilidade — Fase 13 (41-TRACEABILITY)

Escopo: jornada do passageiro na web (telas 26-3/4/5/10 + estados da
corrida). Avaliação (26-9 rating), métodos de pagamento (26-11) e
recuperação de conta: fases de superfície.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| REQ-PRICING-001 | cotação server-side, backend confirma | quote + confirm | `app/ride/quote/page.tsx`, `confirm/page.tsx`, `actions.ts` | build prerenderiza; números nunca vêm da URL | quote-expiry |
| REQ-RIDE-001 | request→matching→assigned→…→completed | actions + status | `app/ride/actions.ts`, `app/ride/[id]/page.tsx` | fluxos executam serviços reais (demo) | fluxos fim-a-fim |
| REQ-CXL-001 | cancelamento com taxa da política | cancelRideAction + fee | `actions.ts`, `[id]/page.tsx` | taxa R$ 6/10 calculada do estado | fee-rule |
| DEC-PAY-003 | Pix trava matching sem pago | startMatching via intents | orquestrador (Fase 7) | erro legível na tela (?opError) | dispatch após pago |
| — | 58 gate no aceite demo | acceptDemoAction | `actions.ts` + seed de motorista | motorista demo APPROVED+available | sem oferta sem verificação |
| REQ-RIDE-001 | 26-10 histórico | history | `app/rides/history/page.tsx` | lista do tenant + empty state | histórico permitido |
