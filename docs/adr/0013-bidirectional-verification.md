# 0013. Verificação bidirecional, comparação por código antes do LLM, vereditos e severidade

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

A Etapa 5 deve comparar as informações críticas do documento com as do resumo, apontar divergências em datas, valores, prazos, obrigações e resultados, identificar omissões, **diferenciar o que diverge do que não pôde ser verificado** e explicar cada inconsistência.

## Decisão

**Duas direções:**

- `source_to_summary`: cada fato crítico da fonte está no resumo, e correto? (`consistent`, `divergent`, `omitted`, `unverifiable`)
- `summary_to_source`: cada afirmação do resumo tem respaldo na fonte? (`supported`, `divergent`, `unsupported`, `unverifiable`)

**Fluxo:**

1. `claim-extractor` decompõe o resumo em afirmações atômicas, com valor tipado quando houver.
2. Pareamento determinístico: `factRefs` do parágrafo, fatos de mesma categoria com valor compatível e top-k chunks por embedding.
3. **Comparação por código primeiro** para datas, prazos, valores e referências legais: iguais saem sem LLM; diferentes vão ao `verifier`, pois podem ser erro de pareamento.
4. `verifier` julga os itens restantes em lotes, vendo só os trechos da fonte e a afirmação, nunca o raciocínio do `summarizer`.

**Regras de veredito:** `divergent` exige que os dois lados tratem do mesmo ponto com valores ou sentido em conflito; falta de evidência ou fato de origem `uncertain` gera `unverifiable`, nunca `divergent`; afirmação sem contraparte gera `unsupported`.

**Alertas** com tipo, severidade, categoria, título, explicação em pt-BR e links para a evidência e o parágrafo do resumo. Severidade por matriz fixa em código (por exemplo, divergência em decisão, valor ou prazo é `high`; item não verificável é `low`).

**Métricas:** `factualConsistency`, `claimSupport` e `unverifiableCount` (fora dos denominadores).

## Alternativas consideradas

- **Só uma direção:** fonte → resumo não detecta alucinação; resumo → fonte não detecta omissão.
- **LLM julgando tudo:** mais caro e menos confiável para comparar datas e números, que o código compara com exatidão.
- **Extrair fatos do resumo e comparar só por código:** não cobre obrigações e decisões, que exigem leitura semântica.

## Consequências

- Divergente e não verificável ficam separados por regra explícita, testável.
- O preset `cross-verifier` permite usar outra família de modelo na verificação para reduzir viés.
- A qualidade do próprio verificador é medida pela injeção de falhas ([0014](0014-evaluation-corpus-cross-matrix-fault-injection.md)).
