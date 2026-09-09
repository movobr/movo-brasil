# Rastreabilidade — Fase 18 (41-TRACEABILITY)

Escopo: chat contextual à corrida (19) e notificações por evento (18,
DEC-NOT-001/002). Transporte realtime, FCM/Twilio vivos e tabelas SQL:
fases de infra com credenciais.

| REQ | Regra/Decisão | Superfície | Arquivo | Teste/Evidência | Aceite |
|---|---|---|---|---|---|
| — | 19 escopo + acesso | Conversation.open + membership | `domain/conversation.ts`, `conversation-service.ts` | 3 testes (abertura pós-aceite, outsider, suporte) | participantes + suporte |
| — | 19 ordem + dedupe servidor | sequence + clientMessageId | `conversation-service.ts` | redelivery retorna mesma msg | sem duplicata |
| — | 19 abuso pré-produção | reportMessage (flag, sem auto-ação) | `conversation.ts`, `app/ride/actions.ts` | teste de flag | controle definido* |
| — | 18 definição completa | catálogo V1 por evento | `domain/notification.ts` | mapeamento ride.completed→receipt | trigger→canal→template→retry→fallback |
| — | 18 sem copy hard-coded | templateKey + PLATFORM_TEMPLATES | `notification.ts` | overrides por tenant injetados | copy por chave |
| — | 18 dedupe + retry + fallback | dispatch/deliver | `notification-service.ts` | push falha 3x→in-app, 2º dispatch null | 1 evento = 1 notificação |
| — | 18 DeviceToken (10) | DeviceToken + store | `notification.ts`, `memory/communication.ts` | tokens por usuário | registro pronto p/ FCM |
| — | eventos→notificações | handleRideEvent via publisher | `lib/backend.ts` | teste de evento | consumo real no demo |

*Auto-moderação (threshold/bloqueio) é decisão do Owner; denúncia +
trilha existem, produção exige a política.
