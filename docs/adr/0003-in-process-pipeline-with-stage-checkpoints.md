# 0003. Execução da pipeline in-process com checkpoint por etapa

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

Cada documento passa por seis etapas, algumas com várias chamadas de LLM; uma execução leva de dezenas de segundos a alguns minutos. É preciso acompanhar o progresso, comparar cenários e, idealmente, refazer só parte da pipeline ao mudar uma configuração. É uma PoC de usuário único, sem requisito de escala.

## Decisão

A pipeline roda **dentro do processo da API**:

- `RunQueue` com `p-queue` limita runs simultâneas (`RUN_CONCURRENCY`, padrão 2); chamadas paralelas dentro de uma run são limitadas por `LLM_CONCURRENCY` (padrão 4).
- O `PipelineRunner` executa as etapas em ordem. Cada etapa grava um `StageRun` com status, duração, métricas, avisos e a **saída validada por Zod como checkpoint** (`output`).
- **Reprocessamento a partir da etapa N** (`POST /runs/:id/rerun`): nova run com `parentRunId`; etapas anteriores a N ficam como `reused`, apontando para o `StageRun` original. Overrides de config que afetem etapas reaproveitadas são rejeitados.
- **Cancelamento** por `AbortController`, com o sinal propagado até o AI SDK.
- **Reinício da API:** runs `running` ou `queued` viram `interrupted` e podem ser retomadas pela primeira etapa não concluída.

## Alternativas consideradas

- **Worker separado com fila no Postgres (pg-boss):** mais robusto a reinícios e com separação física de responsabilidades, mas acrescenta um container e a ponte LISTEN/NOTIFY para o tempo real. Descartado por escolha do autor, priorizando simplicidade.
- **Motor de workflow (Inngest, Temporal):** durabilidade pronta, porém infraestrutura pesada e abstração que esconde justamente a pipeline, foco do trabalho.

## Consequências

- Menos peças: API, web e Postgres.
- O checkpoint por etapa viabiliza comparar cenários pagando só as etapas alteradas e sustenta a injeção de falhas ([0014](0014-evaluation-corpus-cross-matrix-fault-injection.md)).
- Trabalho longo divide o processo com o servidor HTTP; a concorrência limitada evita saturar a API e os rate limits dos providers.
- Uma run interrompida por reinício não continua sozinha; depende de o usuário retomar.
- Se o projeto crescer, o runner pode ser movido para um worker sem mudar `packages/pipeline`, porque a pipeline só conhece as portas do `StageContext`.
