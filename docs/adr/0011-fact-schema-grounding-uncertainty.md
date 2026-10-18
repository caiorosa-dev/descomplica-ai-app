# 0011. Schema de fatos, ancoragem de citações e sinalização de incerteza

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

A Etapa 2 deve identificar datas, prazos, valores, obrigações, decisões e referências legais; guardá-los de forma estruturada; preservar os trechos que os sustentam; e sinalizar o que não foi identificado com segurança. O corpus mistura acórdãos do STJ e atos normativos do CNJ, incluindo atos que só alteram outros atos.

## Decisão

- **Classificação antes da extração:** o `classifier` define `documentType` (`court_decision`, `normative_act`, `generic`), `subtype` (`amendment` ou nulo) e metadados. Cada tipo tem extrator próprio e segmentação determinística própria (ementa, voto, dispositivo; considerandos, artigos, anexos).
- **Schema de fato** com `id`, `category`, `label` (pt-BR), `value` tipado por categoria (união discriminada), `evidence[]` com citações literais mínimas e `confidence`. O extrator também devolve `notFound` (categorias procuradas e ausentes) e `ambiguities`.
- **Pós-processamento determinístico:**
  1. ancoragem de cada citação no texto canônico (`exact`, `fuzzy` com limiar configurável, `not_found`), com posição, página e seção;
  2. conferência do valor contra a citação com parsers pt-BR de datas, valores e prazos;
  3. status `confirmed` ou `uncertain`, com motivos (`quote_not_found`, `value_mismatch`, `low_confidence`, `ambiguous`). Fatos incertos são mantidos e exibidos.
- **Estratégias configuráveis:** `single_pass` ou `chunked` (com troca automática acima do limite de tokens) e `unified` ou `per_category`.
- Persistência normalizada em `ExtractedFact` e `FactEvidence`.

## Alternativas consideradas

- **Confiar na confiança declarada pelo modelo:** modelos superestimam a própria certeza e podem inventar citações; a ancoragem detecta isso de forma objetiva.
- **Extração por regex pura:** boa para datas e valores, fraca para obrigações e decisões.
- **Schema único sem classificação:** extração genérica fraca para dois tipos de documento tão diferentes.

## Consequências

- Toda informação exibida tem um trecho clicável no documento ou é explicitamente marcada como incerta.
- "Não encontrado" fica distinguível de "não extraído".
- Os modos de extração viram dimensões de comparação (custo, cobertura, taxa de incertos).
