# Rastreabilidade — Fase 3 (41-TRACEABILITY)

Escopo: Pricing V1 puro (cálculo server-authoritative, sem HTTP, sem Maps,
sem pagamento). Distância/duração chegam em metros/segundos inteiros
(conversão exata — DERIVED-006); o adaptador Maps resolve origem/destino
em fase própria.

| REQ | Regra/Decisão | Domínio | Arquivo | Teste | Aceite |
|---|---|---|---|---|---|
| REQ-PRICING-001 | DEC-PRICE-001 fórmula, 14 pipeline | quoteFare | `src/domain/pricing.ts` | `tests/unit/pricing.test.ts` (2800, mínima, pedágio) | server-authoritative-fare |
| REQ-PRICING-001 | DEC-PRICE-002/003 catálogo, 004 espera | DEFAULT_CATALOG | `src/domain/pricing.ts` | espera grátis 3min + cobrança | valores padrão exatos |
| REQ-PRICING-001 | DEC-PRICE-006 surge 1.00–1.80, 14 base | surge sobre componentes, antes de descontos/pedágios | `src/domain/pricing.ts` | 1.5× antes de pedágio; faixa rejeita | — |
| REQ-PRICING-001 | DEC-PRICE-007 cupom+1 auto, teto no subtotal | discounts | `src/domain/pricing.ts` | ordem, teto, total nunca negativo | — |
| REQ-PRICING-001 | DEC-PRICE-008 centavos ao final, BRL | inteiro escala 60000, round único | `src/domain/money.ts`, `pricing.ts` | caso 335.5833→336 | integer-minor-units |
| REQ-PRICING-001 | DEC-PRICE-009 expiração | expiresAt + matches | `src/domain/pricing.ts` | 120 s + troca origem/destino | quote-expiry |
| REQ-PRICING-001 | 14 calculation version + policy snapshot | FareQuote | `src/domain/pricing.ts` | `calculationVersion`, snapshot do catálogo | versão persistida (pelo chamador) |
