# Rastreabilidade — Fase 28 (41-TRACEABILITY)

Escopo: repositório público `movobr/movo-brasil` com o monorepo e o CI
da Fase 16 rodando. Push via `git subtree split` (root do git local é
o home; só a subárvore do projeto foi publicada, 27 commits).

| REQ | Regra/Decisão | Superfície | Evidência | Aceite |
|---|---|---|---|---|
| — | Owner: criar repo | https://github.com/movobr/movo-brasil | repo público, Actions on | CI `movo-ci` disparado no push |
| — | sem segredos | scan pré-push | só nomes de env + placeholder | nenhum valor real |
| — | gate manual | environment `production` | Fase 16 (revisores no GitHub) | configurar reviewers |
