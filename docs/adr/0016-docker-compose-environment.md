# 0016. Docker Compose e configuração de ambiente

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

Toda a infraestrutura deve subir com Docker. Quem for avaliar precisa rodar o sistema com o mínimo de passos: clonar, configurar as chaves de API e subir.

## Decisão

**`docker compose up`** com três serviços:

| Serviço | Conteúdo |
|---|---|
| `postgres` | `postgres:17`, volume persistente, healthcheck |
| `api` | Dockerfile multi-stage com `turbo prune --docker` e Node LTS; na subida roda `prisma migrate deploy` e o seed (presets e corpus), depois inicia o Fastify; volume `/data/uploads` |
| `web` | build estático do Vite servido por nginx; proxy de `/api` para `api`, com buffering desativado na rota de SSE |

- `api` só inicia depois do healthcheck do Postgres.
- `.env.example` versionado, `.env` ignorado. Variáveis: `DATABASE_URL`, `TEST_DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `UPLOAD_DIR`, `RUN_CONCURRENCY`, `LLM_CONCURRENCY`, `PORT`, `LOG_LEVEL`.
- **Desenvolvimento local:** `pnpm dev` roda API e web com hot reload, com só o Postgres no Docker; o Vite faz proxy de `/api`.
- Seed idempotente: rodar de novo não duplica presets nem documentos do corpus (deduplicação por `slug` e `sha256`).

## Alternativas consideradas

- **Compose com hot reload como padrão:** bom para desenvolvimento, mas lento e frágil para quem só quer rodar o sistema.
- **Servir a web pela própria API:** um container a menos, mas mistura responsabilidades e complica o cache de arquivos estáticos.

## Consequências

- Um comando sobe o sistema completo, com banco migrado, presets e corpus prontos.
- O perfil Anthropic exige as duas chaves (embeddings via OpenAI); o README deixa isso claro.
- Imagens enxutas graças ao `turbo prune`, ao custo de um Dockerfile um pouco mais elaborado.
