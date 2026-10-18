# 0009. `PipelineConfig` em Zod, presets e snapshot por run

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

Cada etapa precisa de configurações relevantes para montar cenários diferentes (modelos, estratégias de extração, segmentação, métrica principal). Os resultados só são comparáveis se cada execução registrar exatamente a configuração usada.

## Decisão

- **Schema único** `PipelineConfig` em `packages/shared`, com um bloco por etapa (`models`, `textExtraction`, `classification`, `extraction`, `summarization`, `similarity`, `verification`) e valores padrão no próprio schema.
- Validações cruzadas no schema: slots de geração apontam para modelos `language` com structured output; `similarity.embeddingModel` aponta para um modelo `embedding`.
- **Presets** na tabela `Preset`, validados pelo mesmo schema. O seed cria `openai-default`, `anthropic-default`, `cross-verifier` e `budget`, somente leitura; para alterar, duplica-se.
- **Snapshot por run:** `Run.config` guarda a config completa já mesclada com overrides, e `Run.configHash` (SHA-256 do JSON canônico) agrupa execuções equivalentes.
- A UI edita presets num formulário por etapa (react-hook-form + o mesmo schema) com visualização do JSON.

## Alternativas consideradas

- **Config em variáveis de ambiente ou arquivos YAML:** não permite cenários lado a lado nem edição pela interface.
- **Referenciar o preset na run, sem snapshot:** editar o preset alteraria retroativamente o significado de runs antigas.
- **Formulário gerado automaticamente a partir do Zod:** menos código, mas controle fraco sobre layout e textos de ajuda.

## Consequências

- Toda run é reproduzível a partir do próprio registro.
- Comparar runs é comparar dois JSONs; a tela de comparação destaca os campos diferentes.
- Novos parâmetros entram no schema com valor padrão, sem quebrar presets existentes.
