# Rastreabilidade — Fase 29 (41-TRACEABILITY)

Escopo: CI `movo-ci` verde no GitHub (era Fase 28 pendente). Gates 7–8
pulam sem VPS (correto: deploy real exige infra + reviewers).

| Gate | Status remoto | Correção aplicada nesta fase |
|---|---|---|
| 1–2 lint/typecheck/testes | ✅ success | repair do opcional `@rollup/rollup-linux-x64-gnu` (npm/cli#4828) |
| 3 migrations 0001–0004 | ✅ success | incluída a 0004 (estava só até 0003) |
| 4 trivy CRITICAL,HIGH | ✅ success | runtime sem npm + upgrade libcrypto3 + postcss 8.5.28 via overrides |
| 5–6 staging + smoke | ✅ success | smoke local sem VPS; push/deploy condicionais a `vars.VPS_HOST` |
| 7–8 produção | ⏭️ skipped | sem VPS: correto pular; reviewers no environment quando houver infra |
