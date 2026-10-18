# 0010. Texto canônico imutável, limpeza determinística e `cleaner` que só marca linhas

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

A Etapa 1 precisa remover cabeçalhos, rodapés, numeração de página e outros ruídos. Os acórdãos do STJ repetem cabeçalho, carimbo de assinatura eletrônica e "Página X de Y" em todas as páginas; recortes do DJe trazem cabeçalho de edição. As etapas seguintes precisam apontar para os trechos originais que sustentam cada informação.

## Decisão

- A etapa produz um **`canonicalText` imutável**. Toda referência posterior usa posições `[start, end)` nesse texto, e um `pageMap` converte posições em páginas.
- **Extração com coordenadas** no PDF (`unpdf`/pdf.js), para distinguir cabeçalho e rodapé do corpo pelo posicionamento.
- **Regras determinísticas e configuráveis**, nesta ordem: normalização Unicode; cabeçalho e rodapé repetidos (faixa da página + repetição após trocar dígitos por `#`); números de página; conjuntos nomeados de boilerplate (`stj-e-signature`, `dje-header`); hifenização no fim de linha com exceção de pronomes oblíquos; reconstrução de parágrafos.
- **Limpeza por LLM opcional** (`off`, `edges`, `full`): o `cleaner` recebe linhas numeradas e devolve apenas os números a remover, com motivo. Ele **nunca reescreve texto**.
- **Relatório de limpeza:** cada remoção registra regra, página e texto; métricas de caracteres antes e depois por regra.
- PDFs com pouco texto por página falham com `LOW_TEXT_DENSITY` (OCR fora do escopo).

## Alternativas consideradas

- **LLM reescrevendo o texto limpo:** resultado mais "bonito", mas perde a garantia de literalidade e quebra a ancoragem das citações.
- **Extração de texto plano (`pdf-parse`):** sem coordenadas, cabeçalho e corpo ficam indistinguíveis.
- **Regras fixas sem configuração:** impediria medir o efeito de cada regra.

## Consequências

- Citações e destaques na UI apontam para o texto exatamente como está no documento.
- A Etapa 1 é determinística e testável por snapshot nos 20 documentos, sem chave de API.
- Tabelas de anexos são linearizadas e podem ficar pouco legíveis; limitação aceita na PoC.
