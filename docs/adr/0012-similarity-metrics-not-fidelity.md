# 0012. Métricas de similaridade e a posição "similaridade não é fidelidade"

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

A Etapa 4 deve gerar embeddings do documento e do resumo, calcular a similaridade semântica, considerar segmentação para documentos extensos e **não** tratar similaridade alta como garantia de fidelidade factual. Os documentos passam do limite de entrada dos modelos de embedding, e um único vetor por documento perde detalhes.

## Decisão

- **Segmentação** da fonte `structural` (seções da Etapa 2, ajustadas a `maxTokens`) ou `fixed` (janelas com sobreposição); o resumo é segmentado por parágrafo.
- **Quatro métricas**, todas calculadas a partir dos mesmos embeddings:
  - `centroid`: cosseno entre as médias dos vetores;
  - `coverage`: para cada chunk da fonte, o melhor cosseno contra o resumo; média ponderada por tokens;
  - `support`: para cada parágrafo do resumo, o melhor cosseno contra a fonte;
  - `alignment_f1`: média harmônica de `coverage` e `support`, **índice principal por padrão**.
- `coverageByChunk` vira mapa de calor sobre o documento; `supportByParagraph` destaca parágrafos fracos. Destaques por percentil, porque a escala do cosseno varia entre modelos.
- A UI exibe o aviso de que similaridade mede proximidade de assunto, não exatidão dos fatos, ao lado das métricas factuais da Etapa 5.
- A avaliação calcula uma **matriz cruzada** (resumo de cada documento contra todos os documentos) para demonstrar o ponto com dados ([0014](0014-evaluation-corpus-cross-matrix-fault-injection.md)).

## Alternativas consideradas

- **Um embedding por documento, truncado:** ignora a maior parte de documentos longos.
- **Só `centroid`:** tende a valores altos para qualquer texto do mesmo tema; pouco discriminativo.
- **Faixas qualitativas fixas ("alta", "média"):** arbitrárias e dependentes do modelo.

## Consequências

- O índice principal é mais informativo que o cosseno global e aponta onde estão as lacunas.
- Mais chamadas de embedding por documento, compensadas pelo cache.
- Os números não são porcentagens de fidelidade; a interface e o README deixam isso explícito.
