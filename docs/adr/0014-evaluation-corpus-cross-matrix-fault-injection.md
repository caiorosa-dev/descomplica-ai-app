# 0014. Avaliação: lote do corpus, matriz cruzada e injeção de falhas

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

O sistema será testado com 20 documentos: 10 acórdãos do STJ e 10 atos normativos do CNJ (três deles atos de alteração). É preciso comparar presets, demonstrar que similaridade não equivale a fidelidade e ter alguma medida de quanto o verificador acerta.

## Decisão

**Corpus congelado** em `corpus/` com `manifest.json` (tipo e subtipo esperados, versão original ou compilada, URL oficial, `sha256`). Atos "Alterado" do CNJ usam o texto compilado; atos de alteração entram como estão e exercitam o sub-perfil `amendment`. O seed cadastra os 20 arquivos como documentos `corpus`.

**`pnpm eval:corpus`** chama a API por HTTP (mesmo caminho de execução, runs visíveis na UI) para cada documento × preset e gera em `reports/<timestamp>/`:

- métricas por documento (classificação correta, fatos por status, legibilidade, compressão, similaridade, métricas factuais, alertas, tokens, custo, latência);
- **matriz cruzada** de `alignment_f1` (resumo de cada documento contra todos os documentos), comparando a diagonal com o restante;
- correlação entre `alignment_f1` e `factualConsistency`.

**`pnpm eval:faults`** aplica mutadores determinísticos aos resumos de runs concluídas (`date_shift`, `value_change`, `deadline_change`, `outcome_flip`, `omission`, `fabrication`), cada um com a detecção esperada, e reprocessa a partir da Etapa 4 com `summaryOverride`. O relatório traz a taxa de detecção por tipo de falha e os alertas que não correspondem a falhas injetadas.

## Alternativas consideradas

- **Gabarito anotado manualmente:** a medida mais rigorosa de qualidade da extração, mas custo de anotação alto para o prazo de um trabalho de graduação.
- **Testar só pela interface, documento a documento:** sem números comparáveis entre presets.
- **Matriz de experimentos na UI:** mais trabalho de interface para algo que um script resolve.

## Consequências

- A afirmação "similaridade não é fidelidade" é sustentada por dados do próprio corpus.
- A taxa de detecção de falhas mede o verificador em vez de só confiar nele.
- Não há medida direta de recall da extração na fonte (sem gabarito); limitação registrada.
- O custo da avaliação completa é relevante; o script aceita `--only` e mostra o custo acumulado.
