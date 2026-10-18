# Architecture Decision Records

Decisões de arquitetura do Simplificador de Documentos Jurídicos, no formato MADR resumido (contexto, decisão, alternativas, consequências). O design completo está em [`docs/superpowers/specs/2026-10-18-legal-doc-simplifier-design.md`](../superpowers/specs/2026-10-18-legal-doc-simplifier-design.md).

| # | Decisão | Status |
|---|---|---|
| [0001](0001-monorepo-turborepo-pnpm.md) | Monorepo com Turborepo, pnpm e fronteiras entre pacotes | aceito |
| [0002](0002-fastify-api-react-vite-spa.md) | API em Fastify e SPA em React/Vite com shadcn, Tailwind e TanStack | aceito |
| [0003](0003-in-process-pipeline-with-stage-checkpoints.md) | Execução da pipeline in-process com checkpoint por etapa | aceito |
| [0004](0004-realtime-sse-event-log-replay.md) | Tempo real via SSE com replay do log de eventos | aceito |
| [0005](0005-postgresql-prisma-logs-in-database.md) | PostgreSQL com Prisma; logs e chamadas de LLM no banco | aceito |
| [0006](0006-no-pgvector-in-memory-similarity.md) | Sem pgvector: vetores em `real[]`, similaridade em memória e cache | aceito |
| [0007](0007-ai-sdk-provider-registry.md) | Registry de providers do AI SDK; perfis OpenAI e Anthropic; embeddings via OpenAI | aceito |
| [0008](0008-typed-subagents-structured-output.md) | Subagentes tipados com structured output, prompts em inglês e parâmetros de geração | aceito |
| [0009](0009-pipeline-config-presets-snapshot.md) | `PipelineConfig` em Zod, presets e snapshot por run | aceito |
| [0010](0010-immutable-canonical-text-deterministic-cleaning.md) | Texto canônico imutável, limpeza determinística e `cleaner` que só marca linhas | aceito |
| [0011](0011-fact-schema-grounding-uncertainty.md) | Schema de fatos, ancoragem de citações e sinalização de incerteza | aceito |
| [0012](0012-similarity-metrics-not-fidelity.md) | Métricas de similaridade e a posição "similaridade não é fidelidade" | aceito |
| [0013](0013-bidirectional-verification.md) | Verificação bidirecional, comparação por código antes do LLM, vereditos e severidade | aceito |
| [0014](0014-evaluation-corpus-cross-matrix-fault-injection.md) | Avaliação: lote do corpus, matriz cruzada e injeção de falhas | aceito |
| [0015](0015-export-json-csv-zip.md) | Exportação em JSON e ZIP de CSVs | aceito |
| [0016](0016-docker-compose-environment.md) | Docker Compose e configuração de ambiente | aceito |

Para registrar uma nova decisão, crie `NNNN-titulo-em-ingles.md` com o próximo número e acrescente a linha nesta tabela. Uma decisão substituída recebe status `substituído por NNNN`.
