# Rastreabilidade — Fase 19 (41-TRACEABILITY)

Escopo: recibo do passageiro (26-9, cadeia 42). Avaliação sem escala,
regras ou visibilidade no Blueprint: UNSPECIFIED-008, sem código.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 26-9 recibo pós-corrida | buildReceipt (read-model puro) | `domain/receipt.ts` | 2 testes (composição + recusa) | tarifa + split + pagamento |
| — | 42 Completion→Receipt | seção Recibo no COMPLETED | `app/ride/[id]/page.tsx` | rota no build | recibo real renderizado |
| — | rating sem contrato | UNSPECIFIED-008 | página (nota honesta) | sem escala inventada | Owner decide |
