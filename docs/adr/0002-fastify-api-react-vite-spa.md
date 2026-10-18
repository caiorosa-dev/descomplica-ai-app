# 0002. API em Fastify e SPA em React/Vite com shadcn, Tailwind e TanStack

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

A interface precisa mostrar o andamento da pipeline em tempo real e apresentar resultados densos (resumo, fatos, alertas, trechos do documento) de forma limpa. Não há login nem SEO. A stack deve ser TypeScript de ponta a ponta.

## Decisão

**API:** Fastify com `fastify-type-provider-zod`, validando entrada e saída com os schemas de `packages/shared`. Upload via `@fastify/multipart`. Logs com pino (padrão do Fastify).

**Web:** SPA com React, Vite e TypeScript.

- **Tailwind v4** para todo o estilo, sem CSS escrito à mão fora de tokens de tema.
- **shadcn/ui** como base de componentes (Card, Tabs, Table, Badge, Sheet, Dialog, Accordion, Tooltip, Progress, Skeleton, Sonner, Chart).
- **TanStack Router** para rotas tipadas e **TanStack Query** para estado do servidor.
- **react-hook-form** com resolver Zod para os formulários de preset, reaproveitando o schema `PipelineConfig`.
- Ícones lucide; gráficos do shadcn (Recharts).
- Tema claro e escuro; cor reservada para status e severidade.

## Alternativas consideradas

- **Next.js:** SSR e rotas de servidor não trazem ganho para uma SPA sem SEO e duplicariam o papel da API Fastify.
- **Express ou NestJS:** Express tem tipagem e validação mais fracas; NestJS adiciona uma camada de framework desnecessária para o tamanho do projeto.
- **React Router:** funcionaria, mas TanStack Router dá parâmetros e search params tipados, úteis em `/compare?runs=a,b`.
- **Biblioteca de componentes fechada (MUI, Chakra):** shadcn copia os componentes para o projeto, combina com Tailwind e facilita um visual próprio e limpo.

## Consequências

- Um único conjunto de schemas valida formulários, requisições e respostas.
- A web é servida como arquivos estáticos (nginx no compose), sem servidor Node próprio.
- Componentes do shadcn passam a ser código do projeto e precisam ser mantidos como tal.
