# 0007. Registry de providers do AI SDK; perfis OpenAI e Anthropic; embeddings via OpenAI

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

O projeto usa modelos da OpenAI para geração e embeddings e deve oferecer a Anthropic como segundo perfil. A troca de modelo precisa ser configurável por etapa. A Anthropic não oferece API de embeddings.

## Decisão

- **AI SDK** (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) com `createProviderRegistry`. Modelos referenciados como `openai:<id>` ou `anthropic:<id>`.
- **Embeddings sempre via OpenAI** (`text-embedding-3-small` por padrão, `text-embedding-3-large` opcional), atrás da porta `Embedder`.
- **Catálogo de modelos** em `packages/shared` declara, por modelo: tipo (`language` ou `embedding`), janela de contexto, suporte a `temperature`, `reasoningEffort` e structured output, e preço estimado por milhão de tokens.
- `GET /providers` informa quais chaves existem; a UI desabilita presets cujo provider não tem chave.
- Os IDs exatos e preços são confirmados na documentação oficial durante a implementação.

## Alternativas consideradas

- **SDKs oficiais de cada provider:** duas APIs diferentes para structured output, streaming e erros; o AI SDK unifica.
- **Voyage AI para embeddings no perfil Anthropic:** perfil "100% Anthropic", porém exige terceira chave. Fica viável no futuro pela porta `Embedder`.
- **Embeddings locais (transformers.js, Ollama):** sem chave extra, mas imagem pesada e processamento lento.

## Consequências

- Trocar o modelo de qualquer etapa é mudar uma string no preset.
- O perfil Anthropic ainda depende de `OPENAI_API_KEY` para a Etapa 4; isso é documentado no README e na UI.
- Preços no catálogo são estimativas para comparação, não faturamento.
