# 0005. PostgreSQL com Prisma; logs e chamadas de LLM no banco

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

O sistema precisa guardar documentos, presets, runs, checkpoints das etapas, entidades extraídas e um log completo de tudo, incluindo prompt e resposta de cada chamada de LLM. Por simplicidade, os logs devem ficar no próprio Postgres, sem stack de observabilidade separada.

## Decisão

- **PostgreSQL 17** como banco único.
- **Prisma** como ORM, migrations e seed, no pacote `packages/db`.
- Persistência em três grupos:
  1. **Controle:** `Document`, `Preset`, `Run`, `StageRun` (com `output` JSONB como checkpoint).
  2. **Domínio, normalizado:** `ExtractedFact`, `FactEvidence`, `Summary`, `Claim`, `VerificationItem`, `Alert`, `RunMetrics`. As entidades pertencem ao `StageRun`, não à run, para que etapas reaproveitadas não dupliquem linhas.
  3. **Observabilidade:** `RunEvent` (eventos e logs de etapa), `LlmCall` (mensagens completas, resposta bruta, saída validada, tokens, custo, latência, tentativa, erro) e `EmbeddingCall`.
- Logs de infraestrutura do Fastify continuam em stdout (pino); o que diz respeito a uma run vai para o banco.

## Alternativas consideradas

- **Drizzle:** tem suporte nativo a pgvector e SQL mais explícito, mas o Prisma foi pedido e atende, já que pgvector não será usado ([0006](0006-no-pgvector-in-memory-similarity.md)).
- **Tudo em JSONB no `StageRun`:** menos tabelas, porém "armazenar de forma estruturada" fica menos evidente e consultas de avaliação e exportação ficam mais difíceis.
- **Stack de observabilidade (Langfuse, OpenTelemetry):** mais recursos, mas um serviço a mais para subir; o requisito aceita o Postgres.

## Consequências

- Uma consulta SQL responde perguntas de avaliação (custo por preset, taxa de fatos incertos, alertas por severidade).
- `LlmCall` cresce rápido com prompts completos; aceitável na escala da PoC (dezenas de documentos).
- Mudanças de schema exigem migration versionada, aplicada automaticamente na subida do container da API.
