# 0008. Subagentes tipados com structured output, prompts em inglês e parâmetros de geração

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

O requisito pede "prompts estruturados como subagentes em toda parte do projeto". Cada chamada de LLM precisa ter entrada e saída previsíveis, ser registrada por completo e ser reproduzível ao comparar cenários.

## Decisão

**Unidade padrão:** `defineAgent({ name, version, role, input, output, system, prompt })`.

- `input` e `output` são schemas Zod; `output` vira structured output no AI SDK.
- `role` aponta para um slot de modelo em `config.models` (`cleaning`, `classification`, `extraction`, `summarization`, `claimExtraction`, `verification`).
- `version` (semver) é gravado em cada `LlmCall`; mudar o prompt exige subir a versão.
- Um diretório por agente em `packages/pipeline/src/agents/<name>/`.

**Execução:** `runAgent(agent, input, ctx)` resolve o modelo, aplica só os parâmetros que o catálogo aceita, usa 2 retries para erros transitórios, faz **uma** tentativa de correção reenviando o erro de validação e registra cada tentativa em `LlmCall`.

**Idioma:** prompts em inglês, com instrução explícita de produzir texto em pt-BR; citações extraídas literais.

**Parâmetros de geração:**

| Slot | temperature | reasoningEffort |
|---|---|---|
| `cleaning`, `classification`, `claimExtraction` | 0 | low |
| `extraction`, `verification` | 0 | medium |
| `summarization` | 0.3 | medium |

Modelos que não aceitam `temperature` usam `reasoningEffort`; `topP` não é ajustado; `seed` fixo quando suportado; `maxOutputTokens` por agente.

## Alternativas consideradas

- **Texto livre com parsing manual:** frágil e difícil de validar.
- **Framework de agentes (LangChain, Mastra):** abstrações a mais para chamadas que são, na prática, funções tipadas de uma única rodada.
- **Prompts em pt-BR:** possível, mas modelos seguem instruções em inglês com mais consistência; a saída em pt-BR é garantida por instrução e verificada nos testes.

## Consequências

- Toda saída de LLM é validada antes de entrar na pipeline.
- O log permite reconstruir exatamente o que cada agente recebeu e devolveu.
- Temperatura 0 reduz, mas não elimina, a variação entre execuções; a avaliação registra isso.
