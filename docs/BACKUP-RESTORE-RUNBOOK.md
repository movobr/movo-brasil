# Backup, Restore e DR — Runbook V1 (61 + DEC-NFR-006)

Alvos decididos: RTO crítico <= 4 h; RPO <= 15 min para dados críticos,
condicionado à capacidade real do plano de banco escolhido.

| Classe de dados | Mecanismo | Frequência | Retenção | Restauração |
|---|---|---|---|---|
| PostgreSQL (Supabase) transacional | PITR + snapshots do plano contratado | Conforme o plano; validar RPO <= 15 min | Conforme o plano + 90 d de histórico bruto de localização (DEC-GEO-007) | Restore test obrigatório antes do aceite de produção (61) |
| Supabase Storage (branding/docs) | Versionamento + replicação do bucket | Contínua | 30 d | Reidratação por objeto com signed URLs reemitidas |
| Segredos (72) | Cofre do VPS + selagem; nunca no repo | Por rotação | N-1 | Reemissão pelos provedores |
| Código/migrations | Git + tags por release | Por commit | Permanente | Rebuild + `migrate up` até a tag |

Teste de restore: obrigatório e com evidência antes da produção. Este
repositório não declara capacidade de recuperação pela mera existência
de backups (61). Itens pendentes do Owner: dono de cada classe, cadência
do teste de restore, plano de banco contratado (condiciona RPO/RTO).
