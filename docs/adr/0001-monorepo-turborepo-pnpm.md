# 0001. Monorepo com Turborepo, pnpm e fronteiras entre pacotes

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

O sistema tem uma API, uma SPA e uma pipeline de processamento que concentra a lógica do trabalho. API e web precisam compartilhar contratos (DTOs, configuração da pipeline, eventos). A pipeline precisa ser testável sem servidor HTTP e sem banco.

## Decisão

Monorepo com **Turborepo** e **pnpm workspaces**:

- `apps/api`: Fastify, rotas, runtime da pipeline e persistência.
- `apps/web`: React + Vite.
- `packages/pipeline`: etapas, subagentes, prompts, parsers e métricas. Não importa Fastify, Prisma nem `fs`.
- `packages/shared`: schemas Zod usados pelos dois lados (DTOs, `PipelineConfig`, eventos, catálogo de modelos).
- `packages/db`: schema Prisma, migrations, client e seed.
- `packages/tsconfig`: configurações TypeScript.

Regras de dependência: `web → shared`; `api → pipeline, shared, db`; `pipeline → shared, ai`. Biome na raiz para lint e formatação. Tarefas do Turbo: `lint`, `typecheck`, `test`, `build`, com cache.

## Alternativas consideradas

- **Repositórios separados:** duplicaria contratos e complicaria o versionamento conjunto. Descartado.
- **Nx:** mais recursos do que o projeto precisa; Turborepo foi pedido e é suficiente.
- **ESLint + Prettier:** duas ferramentas e mais configuração; Biome cobre os dois papéis com menos atrito.

## Consequências

- Contratos tipados de ponta a ponta: uma mudança em `shared` quebra o typecheck da API e da web ao mesmo tempo.
- A pipeline pode ser testada isoladamente com modelos mock.
- `turbo prune --docker` gera contextos de build enxutos para as imagens (ver [0016](0016-docker-compose-environment.md)).
- Exige disciplina para não importar `db` ou Fastify dentro de `pipeline`; a regra é verificada no code review e pela ausência dessas dependências no `package.json` do pacote.
