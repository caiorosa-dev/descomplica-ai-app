# 0015. Exportação em JSON e ZIP de CSVs

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

Os resumos, dados extraídos, métricas e alertas devem poder ser salvos em arquivos estruturados, como JSON ou CSV. Os resultados de uma run são hierárquicos (fatos com várias evidências, alertas ligados a fatos e afirmações), e CSV só representa bem tabelas planas.

## Decisão

- **JSON:** `GET /runs/:id/export?format=json` gera `run-<id>.json` com `schemaVersion: 1`, metadados do documento, snapshot da config, classificação, fatos com evidências e posições, resumo, métricas, afirmações, vereditos, alertas e custos. O formato é um schema Zod em `shared`.
- **CSV:** `?format=csv` gera `run-<id>.zip` com `facts.csv`, `claims.csv`, `alerts.csv`, `metrics.csv` e `llm_calls.csv`, em UTF-8 com BOM para abrir direto em planilhas. Relações entre arquivos por chaves (`fact_key`, `claim_key`).
- Os scripts de avaliação gravam `results.json`, `results.csv` e `summary.md` em `reports/<timestamp>/`.

## Alternativas consideradas

- **Um único CSV achatado:** repetiria colunas e perderia a relação entre fatos e evidências.
- **Excel (.xlsx):** dependência extra sem ganho real sobre CSV para o propósito.

## Consequências

- O JSON é completo e versionado; o ZIP de CSVs atende análise em planilha.
- Mudanças no formato JSON exigem incrementar `schemaVersion`.
