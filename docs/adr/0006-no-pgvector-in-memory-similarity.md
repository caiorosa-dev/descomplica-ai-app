# 0006. Sem pgvector: vetores em `real[]`, similaridade em memória e cache

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

A Etapa 4 compara embeddings do documento e do resumo, e a Etapa 5 recupera os chunks da fonte mais próximos de cada afirmação. Cada documento gera no máximo algumas centenas de chunks. Não há busca entre documentos em tempo de requisição.

## Decisão

- Vetores guardados como `Float[]` do Prisma (`real[]` no Postgres) na tabela `EmbeddingCache`, com chave `(model, dimensions, textHash)`.
- Similaridade de cosseno, centroides e alinhamentos calculados em TypeScript, em memória, com vetores normalizados.
- O cache evita recalcular embeddings da fonte em reprocessamentos, na avaliação e na matriz cruzada.

## Alternativas consideradas

- **pgvector:** índices ANN e operadores de distância em SQL. Não há ganho em centenas de vetores; o Prisma exigiria `Unsupported("vector")` e consultas em SQL bruto, e a imagem do Postgres precisaria da extensão.
- **Banco vetorial dedicado:** desproporcional para a escala.

## Consequências

- Schema 100% suportado pelo Prisma, sem SQL bruto.
- Cálculo instantâneo na escala do corpus; a matriz cruzada (20 × 20) também roda em memória.
- Se o projeto passar a buscar entre muitos documentos, migrar para pgvector é direto: os vetores já estão no banco.
