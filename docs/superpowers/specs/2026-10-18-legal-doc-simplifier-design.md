# Simplificador de Documentos Jurídicos — Design (PoC)

- **Data:** 2026-10-18
- **Status:** aprovado no brainstorming, aguardando revisão final
- **Decisões relacionadas:** [ADRs em `docs/adr/`](../../adr/README.md)

## 1. Contexto e objetivos

Trabalho acadêmico de graduação: uma prova de conceito que recebe um documento jurídico (PDF, DOCX, HTML ou TXT), extrai e limpa o texto, identifica informações críticas, gera um resumo em português simples e verifica se o resumo é fiel ao original.

O foco é a **pipeline de processamento**. Cada etapa é configurável para permitir montar e comparar cenários (modelos, estratégias de extração, de segmentação e de similaridade).

**Critérios de sucesso**

- `docker compose up` sobe o sistema completo na primeira tentativa, precisando apenas das chaves de API no `.env`.
- As seis etapas funcionam nos 20 documentos do corpus de teste (seção 13).
- A interface reflete o estado da execução em tempo real.
- Todo o processamento fica registrado no Postgres: eventos, chamadas de LLM com prompt e resposta completos, custos e tempos.
- Código limpo, com fronteiras claras entre módulos, testes nas partes determinísticas e ADRs documentando cada decisão.

**Fora do escopo**

- Login, usuários, permissões e multi-tenancy.
- OCR de PDFs escaneados: o sistema detecta e recusa com mensagem clara.
- Deploy em produção, escala horizontal, fila externa ou worker separado.
- Fine-tuning de modelos.
- Qualquer forma de orientação jurídica ao usuário.

## 2. Convenções

| Item | Idioma |
|---|---|
| Código, identificadores, tabelas, colunas, enums, slugs, chaves de config, mensagens de log, nomes de arquivo | inglês |
| Prompts dos subagentes | inglês, com instrução explícita de produzir texto em pt-BR |
| Saídas textuais dos modelos (resumo, rótulos de fatos, explicações de alertas) | pt-BR |
| Citações extraídas | literais, no idioma do documento |
| Interface | pt-BR |
| Spec, ADRs e README | pt-BR |

## 3. Arquitetura

### 3.1 Monorepo

Turborepo com pnpm workspaces. Lint e formatação com Biome na raiz.

```
apps/
  api/          Fastify: REST, SSE e runtime da pipeline (in-process)
  web/          React + Vite + Tailwind + shadcn/ui
packages/
  pipeline/     núcleo: etapas, subagentes, prompts, parsers, métricas (sem HTTP e sem banco)
  shared/       contratos Zod entre API e web: DTOs, PipelineConfig, eventos, catálogo de modelos
  db/           schema Prisma, migrations, client e seed
  tsconfig/     configurações TypeScript compartilhadas
corpus/         stj/, cnj/ e manifest.json
reports/        saída dos scripts de avaliação (ignorado no git)
docs/adr/       ADRs
```

**Regras de dependência**

- `pipeline` depende de `shared` e do pacote `ai` (AI SDK). Não conhece Fastify, Prisma nem sistema de arquivos.
- `api` depende de `pipeline`, `shared` e `db`.
- `web` depende apenas de `shared`.
- Cada etapa recebe um `StageContext` com portas que a `api` implementa:

```ts
interface StageContext {
  runId: string;
  config: PipelineConfig;          // snapshot congelado da run
  models: ModelResolver;           // 'openai:gpt-5' → LanguageModel do AI SDK
  embedder: Embedder;              // embeddings com cache
  recorder: CallRecorder;          // persiste chamadas de LLM e de embedding
  events: StageEventSink;          // progresso e logs da etapa
  signal: AbortSignal;             // cancelamento
}
```

Com isso a pipeline inteira é testável com os modelos mock do AI SDK, sem rede e sem banco.

### 3.2 Estrutura interna

```
packages/pipeline/src/
  core/                  Stage, StageContext, portas, PipelineError, defineAgent, runAgent
  agents/<name>/         um diretório por subagente: prompt, schemas de entrada e saída
  stages/
    text-extraction/     extractors/ (pdf, html, docx, txt), cleaning/rules/
    information-extraction/  classify, segment/, extract/, grounding/, parsers/ (pt-BR)
    summarization/       readability/
    similarity/          chunking/, metrics/
    verification/        pairing/, compare/, severity.ts
    report/
  eval/faults/           mutadores determinísticos para injeção de falhas

apps/api/src/
  modules/               documents, presets, runs, providers, analysis (rotas + service + repository)
  runtime/               PipelineRunner, RunQueue, EventBus, adaptadores das portas (AI SDK, Prisma)
  persistence/           materialização das saídas das etapas em tabelas de domínio
```

### 3.3 Containers

| Serviço | Imagem / build | Papel |
|---|---|---|
| `postgres` | `postgres:17` | banco único (domínio, checkpoints, eventos, logs) |
| `api` | Dockerfile multi-stage com `turbo prune --docker`, Node LTS; o diretório `corpus/` é copiado para a imagem | roda `prisma migrate deploy` e o seed (presets e corpus) ao iniciar, depois sobe o Fastify |
| `web` | build estático do Vite servido por nginx | proxy de `/api` para `api` (sem CORS em produção local) |

Os uploads ficam num volume Docker montado em `/data/uploads`. Para desenvolvimento local, `pnpm dev` roda API e web com hot reload e só o Postgres no Docker (o Vite faz proxy de `/api`).

## 4. Subagentes e providers

### 4.1 Subagente

Toda chamada de LLM do projeto passa por um subagente declarado com `defineAgent`:

```ts
export const summarizer = defineAgent({
  name: 'summarizer',
  version: '1.0.0',
  role: 'summarization',         // slot de modelo em config.models
  input: SummarizerInput,        // Zod
  output: SummarizerOutput,      // Zod, usado como structured output
  system: SYSTEM_PROMPT,         // inglês, pede saída em pt-BR
  prompt: (input) => renderUserPrompt(input),
});
```

`runAgent(agent, input, ctx)`:

1. Resolve o modelo do slot `agent.role` em `ctx.config.models` e aplica só os parâmetros que o catálogo diz que o modelo aceita.
2. Chama o AI SDK com structured output a partir do schema Zod.
3. Em erro transitório (429, 5xx, timeout), usa os retries do AI SDK (`maxRetries: 2`, backoff exponencial).
4. Se a saída não passar no schema, faz **uma** nova tentativa enviando o erro de validação ao modelo. Se falhar de novo, lança `SCHEMA_VALIDATION_FAILED`.
5. Registra cada tentativa via `ctx.recorder`: agente, versão, provider, modelo, parâmetros, mensagens completas, resposta bruta, saída validada, tokens de entrada, saída e raciocínio, custo estimado, latência, número da tentativa e erro.

**Subagentes**

| Nome | Slot | Etapa | Função |
|---|---|---|---|
| `cleaner` | `cleaning` | 1 | marca linhas que são ruído (nunca reescreve) |
| `classifier` | `classification` | 2 | tipo, subtipo e metadados do documento |
| `extractor.court-decision` | `extraction` | 2 | fatos de decisões judiciais |
| `extractor.normative-act` | `extraction` | 2 | fatos de atos normativos (inclui `amendment`) |
| `extractor.generic` | `extraction` | 2 | fatos de documentos de outro tipo |
| `summarizer` | `summarization` | 3 | resumo estruturado em linguagem simples |
| `claim-extractor` | `claimExtraction` | 5 | decompõe o resumo em afirmações atômicas |
| `verifier` | `verification` | 5 | julga pares fonte e resumo |

### 4.2 Providers e catálogo

- Registry do AI SDK: `createProviderRegistry({ openai, anthropic })`. Modelos referenciados como `openai:<id>` e `anthropic:<id>`.
- A Anthropic não tem API de embeddings. **Embeddings sempre via OpenAI** (`text-embedding-3-small` por padrão, `text-embedding-3-large` como opção). A porta `Embedder` deixa a troca de provider isolada.
- Catálogo em `packages/shared/src/models/catalog.ts`, com uma entrada por modelo:

```ts
{
  ref: 'anthropic:claude-sonnet-5-5',
  kind: 'language',               // 'language' | 'embedding'
  contextWindow: number,
  supportsTemperature: boolean,
  supportsReasoningEffort: boolean,
  supportsStructuredOutput: boolean,
  pricePerMTokens: { input: number, output: number },  // estimativa, em USD
}
```

- Os IDs exatos são confirmados na implementação, consultando a documentação dos providers. Candidatos: família GPT-5 da OpenAI (um modelo principal e um modelo pequeno, na versão mais recente disponível), `claude-sonnet-5-5` e `claude-haiku-5-5` da Anthropic.
- Os preços do catálogo são estimativas para comparar cenários, não faturamento.
- `GET /providers` informa quais chaves estão configuradas. A UI desabilita presets que dependem de um provider sem chave.

### 4.3 Parâmetros de geração

| Slot | temperature | reasoningEffort | Justificativa |
|---|---|---|---|
| `cleaning` | 0 | low | tarefa de marcação, sem criatividade |
| `classification` | 0 | low | rótulo entre opções fechadas |
| `extraction` | 0 | medium | precisão, reprodutibilidade, citação literal |
| `summarization` | 0.3 | medium | fluidez para linguagem simples sem abrir espaço para invenção |
| `claimExtraction` | 0 | low | decomposição mecânica |
| `verification` | 0 | medium | julgamento cuidadoso item a item |

Regras:

- Modelos de raciocínio que não aceitam `temperature` usam `reasoningEffort`. O catálogo decide qual parâmetro enviar.
- `topP` nunca é ajustado junto com `temperature`.
- `seed` fixo quando o provider aceita.
- `maxOutputTokens` definido por subagente.

## 5. Configuração e presets

### 5.1 `PipelineConfig`

Schema Zod único em `packages/shared`. Valores padrão:

```ts
{
  models: {
    cleaning:        { model: '<small>', temperature: 0,   reasoningEffort: 'low' },
    classification:  { model: '<small>', temperature: 0,   reasoningEffort: 'low' },
    extraction:      { model: '<main>',  temperature: 0,   reasoningEffort: 'medium' },
    summarization:   { model: '<main>',  temperature: 0.3, reasoningEffort: 'medium' },
    claimExtraction: { model: '<small>', temperature: 0,   reasoningEffort: 'low' },
    verification:    { model: '<main>',  temperature: 0,   reasoningEffort: 'medium' },
  },
  textExtraction: {
    maxFileSizeMb: 20,
    minCharsPerPage: 200,
    pdf: { edgeBandRatio: 0.1, repeatThreshold: 0.5 },
    html: { dropStrikethrough: true },
    cleaning: {
      normalizeUnicode: true,
      removeRepeatedHeadersFooters: true,
      removePageNumbers: true,
      boilerplatePatternSets: ['stj-e-signature', 'dje-header'],
      dehyphenate: true,
      rebuildParagraphs: true,
      llmCleanup: 'off',                 // 'off' | 'edges' | 'full'
    },
  },
  classification: { mode: 'auto' },      // 'auto' | 'court_decision' | 'normative_act' | 'generic'
  extraction: {
    strategy: 'single_pass',             // 'single_pass' | 'chunked'
    maxSinglePassTokens: 60_000,
    chunkTokens: 6_000,
    overlapTokens: 400,
    agentSplit: 'unified',               // 'unified' | 'per_category'
    categories: ['date', 'deadline', 'monetary_value', 'obligation', 'decision', 'legal_reference'],
    grounding: { fuzzyThreshold: 0.9 },
    minConfidence: 'medium',             // 'low' | 'medium' | 'high'
  },
  summarization: {
    audience: 'layperson',               // 'layperson' | 'professional'
    targetLength: 'medium',              // 'short' ~150 | 'medium' ~350 | 'long' ~700 palavras
    strategy: 'direct',                  // 'direct' | 'hierarchical'
    maxDirectTokens: 60_000,
    useExtractedFacts: true,
    uncertainFacts: 'hedge',             // 'omit' | 'hedge'
    includeGlossary: true,
  },
  similarity: {
    embeddingModel: 'openai:text-embedding-3-small',
    dimensions: null,
    chunking: { method: 'structural', maxTokens: 512, overlapTokens: 64 },  // 'structural' | 'fixed'
    headline: 'alignment_f1',            // 'centroid' | 'coverage' | 'support' | 'alignment_f1'
    highlightBottomPercent: 20,
  },
  verification: {
    directions: ['source_to_summary', 'summary_to_source'],
    deterministicFirst: true,
    retrievalTopK: 3,
    batchSize: 10,
    criticalCategories: ['decision', 'deadline', 'monetary_value', 'obligation'],
  },
}
```

`<main>` e `<small>` são resolvidos pelo preset a partir do catálogo (seção 4.2). O schema valida que cada slot aponta para um modelo `language` com `supportsStructuredOutput: true`, e que `similarity.embeddingModel` aponta para um modelo `embedding`.

### 5.2 Presets

Ficam na tabela `Preset`, validados pelo mesmo schema. Os do seed são somente leitura (`isBuiltin`); para alterar, duplica-se.

| Slug | Geração | Embedding | Objetivo |
|---|---|---|---|
| `openai-default` | OpenAI principal e pequeno nos slots correspondentes | `text-embedding-3-small` | baseline |
| `anthropic-default` | Claude Sonnet nos slots principais, Claude Haiku nos pequenos | `text-embedding-3-small` | segundo perfil de provider |
| `cross-verifier` | OpenAI até o resumo; `claimExtraction` e `verification` com Claude | `text-embedding-3-small` | reduz o viés de um modelo validar a própria família |
| `budget` | modelo pequeno da OpenAI em todos os slots, `llmCleanup: 'off'` | `text-embedding-3-small` | custo contra qualidade |

Cada run guarda o **snapshot completo** da config e um `configHash` (SHA-256 do JSON canônico). O hash agrupa execuções equivalentes nos relatórios.

## 6. Pipeline

Etapas (enum `Stage`): `text_extraction`, `information_extraction`, `summarization`, `similarity`, `verification`, `report`.

Cada etapa é um `Stage<I, O>` em `packages/pipeline` com schema de saída Zod. A saída validada é o checkpoint gravado em `StageRun.output`. A `api` também materializa as entidades de domínio em tabelas próprias (seção 10).

### 6.1 Etapa 1 — `text_extraction`

**Invariante:** a etapa produz um `canonicalText` imutável. Toda referência posterior a trechos do documento usa posições `[start, end)` nesse texto.

**Entrada:** `{ buffer, filename }`. A API lê o arquivo do volume e entrega o conteúdo; a pipeline não acessa o sistema de arquivos.

**Detecção de formato** pelo conteúdo (magic bytes, biblioteca `file-type`), não pela extensão. Formato não suportado gera `UNSUPPORTED_FILE`; acima de `maxFileSizeMb`, `FILE_TOO_LARGE`.

**Extratores**

| Formato | Biblioteca | Comportamento |
|---|---|---|
| PDF | `unpdf` (pdf.js) | itens de texto com coordenadas; linhas reconstruídas por posição vertical, guardando página, `y` e tamanho da fonte |
| HTML | `cheerio` | remove `<s>`, `<del>`, `<strike>` quando `dropStrikethrough` (redação revogada em textos compilados do CNJ); converte blocos em linhas |
| DOCX | `mammoth` → HTML | segue o caminho do HTML; cabeçalhos e rodapés do Word já não entram |
| TXT | — | linhas diretas, página única |

Se a média de caracteres por página ficar abaixo de `minCharsPerPage`, a etapa falha com `LOW_TEXT_DENSITY` ("o PDF parece escaneado; OCR está fora do escopo").

**Regras de limpeza**, determinísticas e aplicadas nesta ordem (cada uma liga e desliga pela config):

1. **Normalização Unicode:** NFC, ligaduras (`ﬁ` → `fi`), espaços não separáveis, caracteres de controle.
2. **Cabeçalho e rodapé repetidos:** linhas na faixa superior ou inferior da página (`edgeBandRatio`) cuja forma normalizada (dígitos trocados por `#`, espaços colapsados, minúsculas) se repete em pelo menos `repeatThreshold` das páginas. Só se aplica a documentos com 3 páginas ou mais.
3. **Números de página:** linhas isoladas como `- 3 -`, `3/20`, `Pág. 3`, `Página 3 de 20`.
4. **Boilerplate nomeado:** conjuntos de expressões regulares versionados no código.
   - `stj-e-signature`: carimbo de assinatura eletrônica (Lei 11.419/2006, "Documento eletrônico ... assinado eletronicamente", código de controle, "Site certificado").
   - `dje-header`: cabeçalho de recorte do DJe ("Edição nº X/AAAA Brasília-DF, disponibilização ...").
5. **Hifenização no fim de linha:** linha terminada em `-` seguida de linha iniciada por minúscula é unida sem o hífen, exceto quando o fragmento seguinte é pronome oblíquo (`lhe`, `lhes`, `se`, `o`, `a`, `os`, `as`, `me`, `te`, `nos`, `vos`, `lo`, `la`, `los`, `las`, `no`, `na`).
6. **Reconstrução de parágrafos:** junta linhas consecutivas, exceto quando a linha termina em `.`, `:`, `;`, `?` ou `!`, quando a próxima começa com marcador estrutural (`Art.`, `§`, `I -`, `a)`, `EMENTA`, `ACÓRDÃO`, `RELATÓRIO`, `VOTO`, `CONSIDERANDO`, `CAPÍTULO`, `ANEXO`) ou quando há salto vertical maior que 1,5 vez o espaçamento médio.

**Limpeza por LLM (opcional).** O `cleaner` recebe linhas numeradas e devolve `{ removeLineIds: number[], reasons: Record<number, string> }`. Ele **não reescreve texto**, então o que sobra continua literal.

- `off`: desligado (padrão).
- `edges`: avalia as 3 primeiras e as 3 últimas linhas de cada página que sobraram após as regras.
- `full`: avalia todas as linhas, em lotes.

**Saída**

```ts
TextExtractionOutput = {
  sourceFormat: 'pdf' | 'html' | 'docx' | 'txt',
  canonicalText: string,
  pageMap: { page: number, start: number, end: number }[],
  cleaningReport: {
    removed: { rule: string, page: number | null, text: string }[],
    charsBefore: number,
    charsAfter: number,
    removedByRule: Record<string, number>,
  },
  stats: { pages: number, words: number, estimatedTokens: number },
}
```

### 6.2 Etapa 2 — `information_extraction`

**2a. Classificação.** O `classifier` recebe os primeiros ~4.000 tokens e os últimos ~1.000 do texto canônico e devolve:

```ts
{
  documentType: 'court_decision' | 'normative_act' | 'generic',
  subtype: 'amendment' | null,
  confidence: 'low' | 'medium' | 'high',
  rationale: string,
  metadata: {
    issuer: string | null,          // STJ, CNJ...
    identifier: string | null,      // "REsp 1.969.219/SP", "Resolução 335/2020"
    date: string | null,            // ISO
    judgingBody: string | null,     // "Quarta Turma"
    rapporteur: string | null,
  },
}
```

Com `classification.mode` diferente de `auto`, o tipo é forçado e o subagente só preenche metadados e subtipo. Confiança `low` gera aviso.

**2b. Segmentação** determinística por marcadores, conforme o tipo:

| Tipo | Seções (`SectionKind`) |
|---|---|
| `court_decision` | `headnote` (EMENTA), `judgment` (ACÓRDÃO), `report` (RELATÓRIO), `vote` (VOTO, pode repetir), `operative_part` (dispositivo, o parágrafo final do voto do relator que começa com "Ante o exposto", "Diante do exposto" e equivalentes), `judgment_certificate` (CERTIDÃO DE JULGAMENTO) |
| `normative_act` | `preamble`, `recitals` (CONSIDERANDO), `article` (um por `Art.`, com o capítulo ao qual pertence), `annex` (ANEXO) |
| `generic` | `paragraph` (fallback) |

Se os marcadores esperados não aparecerem, cai em `generic` e registra aviso. Cada seção tem `{ id, kind, label, start, end }`.

**2c. Extração.** O extrator do tipo recebe o texto (inteiro ou em chunks), a lista de seções e as categorias pedidas. Para `subtype: 'amendment'`, a categoria `amendment` é acrescentada automaticamente.

```ts
Fact = {
  id: string,                      // 'F01', 'F02'... estável dentro da run
  category: FactCategory,
  label: string,                   // pt-BR, ex.: "Data do julgamento"
  value: CategoryValue,            // união discriminada por category
  evidence: { quote: string }[],   // trecho literal mínimo que sustenta o fato
  confidence: 'low' | 'medium' | 'high',
}

ExtractorOutput = {
  facts: Fact[],
  notFound: FactCategory[],        // categorias procuradas e ausentes
  ambiguities: { description: string, quote: string }[],
}
```

| Categoria | `value` |
|---|---|
| `date` | `{ iso, role: 'judgment' \| 'publication' \| 'effective' \| 'signature' \| 'filing' \| 'other' }` |
| `deadline` | `{ amount, unit: 'days' \| 'months' \| 'years', businessDays: boolean \| null, trigger: string \| null }` |
| `monetary_value` | `{ amount, currency: 'BRL', role: string }` |
| `obligation` | `{ bearer, action, modality: 'must' \| 'must_not' \| 'may', condition: string \| null }` |
| `decision` | `{ outcome: 'granted' \| 'partially_granted' \| 'denied' \| 'not_heard' \| 'other', description, unanimity: 'unanimous' \| 'majority' \| 'unknown' }` |
| `legal_reference` | `{ normType, number: string \| null, year: number \| null, provision: string \| null, citation }` |
| `amendment` | `{ targetAct, targetProvision, changeType: 'added' \| 'amended' \| 'revoked', newText: string \| null }` |

Regras do prompt: extrair só o que está explícito; a citação deve ser literal e mínima; nunca inferir datas ou valores; na dúvida, usar `confidence: 'low'` e registrar em `ambiguities`; listar em `notFound` as categorias procuradas e ausentes.

**Estratégias**

- `single_pass`: o texto inteiro numa chamada. Se `estimatedTokens > maxSinglePassTokens`, muda para `chunked` e registra aviso.
- `chunked`: chunks alinhados às seções (até `chunkTokens`, com `overlapTokens`), extraídos em paralelo (limitado por `LLM_CONCURRENCY`) e unidos depois.
- `agentSplit: 'unified'`: uma chamada cobre todas as categorias.
- `agentSplit: 'per_category'`: uma chamada focada por grupo (`date` + `deadline`; `monetary_value`; `obligation`; `decision`; `legal_reference`; `amendment`).

**Pós-processamento determinístico**

1. **Ancoragem.** Cada citação é procurada no `canonicalText`:
   - `exact`: correspondência após normalizar espaços, maiúsculas e minúsculas, e aspas;
   - `fuzzy`: janela deslizante com similaridade (Levenshtein normalizada) de pelo menos `fuzzyThreshold`;
   - `not_found`: nenhuma das duas.
   Grava `start`, `end`, `page` (via `pageMap`), `matchType`, `matchScore` e a seção que contém o trecho.
2. **Conferência do valor.** Parsers pt-BR conferem se o valor normalizado está na citação:
   - datas: "24 de março de 2025", "24/03/2025", "24.3.2025", "1º de janeiro de 2025";
   - dinheiro: "R$ 1.234,56", "R$ 10 mil", "R$ 2,5 milhões";
   - prazos: "15 (quinze) dias úteis", "trinta dias", "6 meses".
   Categorias sem parser (`obligation`, `decision`, `legal_reference`, `amendment`) passam direto nesta conferência.
3. **Status**
   - `confirmed`: ancorado (`exact` ou `fuzzy`), valor conferido e confiança maior ou igual a `minConfidence`.
   - `uncertain`: qualquer falha, com `uncertaintyReasons` em `quote_not_found`, `value_mismatch`, `low_confidence`, `ambiguous`.
   - Fatos `uncertain` são mantidos e exibidos com sinalização.
4. **União** (modos `chunked` e `per_category`): mesma categoria, mesmo valor normalizado e evidências sobrepostas viram um fato só, mantendo todas as evidências e a maior confiança. IDs são reatribuídos em ordem de posição no texto.

### 6.3 Etapa 3 — `summarization`

**Entrada do `summarizer`:** texto canônico (ou seções, na estratégia `hierarchical`), tipo e metadados, e os fatos (`confirmed` e, conforme `uncertainFacts`, os `uncertain` marcados como tal) com seus IDs.

**Saída**

```ts
Summary = {
  title: string,
  overview: string,                // "Em resumo", 2 a 3 frases
  sections: {
    heading: string,
    paragraphs: { text: string, factRefs: string[] }[],
  }[],
  glossary: { term: string, explanation: string }[],
}
```

**Seções por tipo**

| Tipo | Seções |
|---|---|
| `court_decision` | "O que foi discutido", "O que o tribunal decidiu", "Por quê", "O que muda na prática" |
| `normative_act` | "Do que trata", "Quem precisa cumprir", "O que deve ser feito", "Prazos e vigência" |
| `normative_act` com subtipo `amendment` | "O que mudou" como primeira seção, seguida das seções de `normative_act` |
| `generic` | "Do que trata", "Pontos principais", "Prazos e valores" |

**Regras do prompt**

- Linguagem simples conforme a Recomendação CNJ 144/2023: frases curtas, voz ativa, jargão explicado ou levado ao glossário.
- Usar apenas informação presente na fonte; não opinar nem orientar.
- Datas, valores e prazos copiados exatamente como nos fatos.
- Cada parágrafo lista em `factRefs` os fatos em que se apoia.
- `uncertainFacts: 'omit'` exclui fatos incertos; `'hedge'` permite citá-los com ressalva explícita ("o documento não deixa claro se ...").
- `audience: 'professional'` mantém termos técnicos com explicação breve.

**Estratégia `hierarchical`:** resume cada seção (ou grupo de seções até `maxDirectTokens`) e depois combina os resumos parciais com os fatos. É ativada automaticamente quando o texto passa de `maxDirectTokens`.

**Métricas determinísticas**

- **Legibilidade:** índice de Flesch adaptado ao português (Martins et al., 1996), `248,835 − 1,015 × (palavras/frases) − 84,6 × (sílabas/palavras)`, calculado para o texto canônico e para o resumo. A contagem de sílabas é heurística (grupos vocálicos com tratamento de ditongos e hiatos comuns) e documentada como aproximação.
- **Compressão:** palavras do original divididas pelas palavras do resumo.

### 6.4 Etapa 4 — `similarity`

**Segmentação**

- Fonte, `structural`: usa as seções da etapa 2; junta seções pequenas e divide as grandes por parágrafo até `maxTokens`.
- Fonte, `fixed`: janelas de `maxTokens` com `overlapTokens`.
- Resumo: um chunk por parágrafo, mais o `overview`.
- Tokens contados com `gpt-tokenizer`.

**Embeddings:** via porta `Embedder`, em lote, com cache na tabela `EmbeddingCache` por `(model, dimensions, sha256(text))`. Os vetores são normalizados (norma L2) antes do cálculo.

**Métricas**

| Métrica | Cálculo |
|---|---|
| `centroid` | cosseno entre a média dos vetores da fonte e a média dos vetores do resumo |
| `coverage` | para cada chunk da fonte, o maior cosseno contra os chunks do resumo; média ponderada pelos tokens do chunk |
| `support` | para cada chunk do resumo, o maior cosseno contra os chunks da fonte; média simples |
| `alignment_f1` | média harmônica de `coverage` e `support` |

`similarity.headline` define qual métrica aparece como "índice de similaridade semântica". As outras aparecem nos detalhes.

**Saídas para a interface**

- `coverageByChunk`: posições e score de cada chunk da fonte (mapa de calor).
- `supportByParagraph`: score de cada parágrafo do resumo.
- Os piores `highlightBottomPercent`% de cada lista são marcados. O destaque é por percentil porque a escala do cosseno varia entre modelos de embedding.

**Posição explícita:** similaridade alta indica proximidade de assunto, não fidelidade factual. A UI exibe esse aviso junto do índice, e a avaliação (seção 13) demonstra isso com a matriz cruzada.

### 6.5 Etapa 5 — `verification`

Verificação nas duas direções:

| Direção | Unidade | Vereditos |
|---|---|---|
| `source_to_summary` | cada fato da etapa 2, de todas as categorias (`criticalCategories` define quais geram alerta de omissão e entram em `factualConsistency`) | `consistent`, `divergent`, `omitted`, `unverifiable` |
| `summary_to_source` | cada afirmação do resumo | `supported`, `divergent`, `unsupported`, `unverifiable` |

**Fluxo**

1. **Afirmações.** O `claim-extractor` decompõe o resumo em `Claim { id, text, paragraphRef, category | null, value | null }`. Quando a afirmação contém data, prazo, valor, decisão ou referência legal, o valor sai tipado com os schemas da etapa 2.
2. **Pareamento** (determinístico). Candidatos para cada afirmação, em ordem de prioridade:
   1. fatos citados nos `factRefs` do parágrafo de origem;
   2. fatos da mesma categoria cujo valor normalizado é compatível;
   3. os `retrievalTopK` chunks da fonte mais similares (embedding da afirmação contra os vetores já em cache).
   Cada fato crítico sem afirmação pareada é candidato a `omitted`.
3. **Comparação por código** (`deterministicFirst`). Para pares com valores tipados comparáveis (`date`, `deadline`, `monetary_value`, `legal_reference`):
   - iguais → `consistent` / `supported`, sem chamada de LLM;
   - diferentes → vão ao `verifier`, porque podem ser erro de pareamento (data de publicação contra data de julgamento, por exemplo).
4. **`verifier`.** Recebe, em lotes de `batchSize`, os itens restantes: afirmação ou fato, candidatos e trechos da fonte (citações ancoradas e chunks recuperados). **Não recebe o raciocínio do `summarizer`.** Devolve `{ itemId, verdict, explanation (pt-BR), usedQuotes[] }`.
5. **Regras para os vereditos** (no prompt e nos testes):
   - `divergent`: os dois lados tratam do mesmo ponto e os valores ou o sentido conflitam ("15 dias" contra "15 dias úteis"; "negou provimento" contra "deu parcial provimento").
   - `unverifiable`: os trechos disponíveis não bastam para decidir, **ou** o fato de origem está `uncertain`. É proibido usar `divergent` quando falta evidência.
   - `unsupported`: a afirmação não tem contraparte na fonte (risco de alucinação).
   - `omitted`: fato crítico da fonte ausente do resumo.

**Alertas.** Geram alerta:

- todo `divergent` e todo `unsupported`, em qualquer categoria;
- `omitted` e `unverifiable` de fatos em categorias críticas;
- `unverifiable` de afirmações do resumo.

`omitted` e `unverifiable` de fatos não críticos (por exemplo, uma referência legal que o resumo não cita) ficam registrados como `VerificationItem` e aparecem na aba Verificação como "não incluídos no resumo", sem gerar alerta. Isso evita ruído, já que um resumo omite muitos detalhes por definição. Em documentos `amendment`, a categoria `amendment` conta como crítica.

Formato:

```ts
Alert = {
  id: string,
  type: 'divergence' | 'omission' | 'unsupported_claim' | 'unverifiable',
  severity: 'high' | 'medium' | 'low',
  category: FactCategory | null,
  title: string,                   // pt-BR, curto
  explanation: string,             // pt-BR, vindo do verifier ou de template
  sourceFactId: string | null,
  claimId: string | null,
  sourceEvidence: { start: number, end: number, page: number | null }[],
  summaryRef: { sectionIndex: number, paragraphIndex: number } | null,
}
```

**Matriz de severidade** (em `severity.ts`, com testes):

| Situação | Severidade |
|---|---|
| `divergence` em `decision`, `monetary_value` ou `deadline` | high |
| `divergence` nas demais categorias | medium |
| `omission` de `decision` | high |
| `omission` de `deadline`, `monetary_value`, `obligation` ou (em documentos `amendment`) `amendment` | medium |
| `unsupported_claim` com valor tipado | high |
| `unsupported_claim` sem valor tipado | medium |
| `unverifiable` | low |

**Métricas factuais**

- `factualConsistency` = `consistent` ÷ (`consistent` + `divergent` + `omitted`), contando apenas fatos de categorias críticas.
- `claimSupport` = `supported` ÷ total de afirmações.
- Itens `unverifiable` ficam fora dos dois denominadores e são contados à parte (`unverifiableCount`).

### 6.6 Etapa 6 — `report`

Consolida a run, sem LLM:

- grava `RunMetrics` (seção 10) com todas as métricas das etapas 3 a 5, contagens de fatos por status, alertas por severidade, tokens, custo e duração;
- define o status final da run;
- emite o evento final.

A apresentação dos resultados fica na interface (seção 9).

## 7. Execução, tempo real e reprocessamento

**Fila.** `RunQueue` in-process com `p-queue`, concorrência `RUN_CONCURRENCY` (padrão 2). Dentro de uma run, chamadas paralelas (chunks, lotes) são limitadas por `LLM_CONCURRENCY` (padrão 4).

**Runner.** Para cada etapa, em ordem:

1. cria ou atualiza o `StageRun` como `running` e emite `stage.started`;
2. monta a entrada a partir das saídas anteriores;
3. executa `stage.run(input, ctx)`;
4. valida a saída, grava o checkpoint, materializa as entidades de domínio na mesma transação e emite `stage.completed` com duração e métricas;
5. em erro: marca etapa e run como `failed`, grava o erro e emite `stage.failed`.

**Eventos** (união discriminada Zod em `shared`):

| Tipo | Dados |
|---|---|
| `run.status` | `status` |
| `stage.started` | `stage` |
| `stage.progress` | `stage`, `message`, `current?`, `total?` |
| `stage.completed` | `stage`, `durationMs`, `metrics` |
| `stage.failed` | `stage`, `error` |
| `stage.reused` | `stage`, `fromStageRunId` |
| `log` | `level`, `message`, `data?` |
| `llm.call` | `callId`, `agent`, `model`, `inputTokens`, `outputTokens`, `costUsd`, `latencyMs`, `status` |

Cada evento é gravado em `RunEvent` com `seq` crescente por run **e** publicado num `EventEmitter`.

**SSE.** `GET /runs/:id/events`:

1. reenvia do banco os eventos com `seq` maior que `Last-Event-ID` (ou todos);
2. passa a transmitir os eventos ao vivo, com `id: <seq>`;
3. envia heartbeat a cada 15 s;
4. encerra após o evento final de uma run em estado terminal.

Recarregar a página não perde nada.

**Reprocessamento.** `POST /runs/:id/rerun { fromStage, configOverrides?, summaryOverride? }`:

- cria uma nova `Run` com `parentRunId` e `startFromStage`;
- config = snapshot da run de origem mesclado com `configOverrides`; overrides que afetem etapas anteriores a `fromStage` são rejeitados com 400;
- etapas anteriores a `fromStage` viram `StageRun` com status `reused` e `reusedFromStageRunId` apontando para o `StageRun` original (resolvido de forma transitiva);
- `summaryOverride` (uso da avaliação, seção 13) só é aceito com `fromStage: 'similarity'`; o `StageRun` de `summarization` recebe status `overridden` com o resumo fornecido;
- a mesma rota atende "tentar de novo a partir desta etapa" após falha.

**Cancelamento.** `POST /runs/:id/cancel` aciona o `AbortController` da run; o sinal chega às chamadas do AI SDK. Status final `cancelled`.

**Reinício da API.** Na subida, runs em `running` ou `queued` passam para `interrupted`. A UI oferece retomar, que é um rerun a partir da primeira etapa não concluída.

## 8. API

Fastify com `fastify-type-provider-zod`; todos os contratos vêm de `shared`. Erros sempre como `{ error: { code, message, details? } }`.

| Método | Rota | Função |
|---|---|---|
| GET | `/health` | status da API e do banco |
| GET | `/providers` | providers configurados e catálogo de modelos |
| GET | `/documents` | lista, com contagem de runs e status da última |
| POST | `/documents` | upload multipart; deduplica por `sha256` |
| GET | `/documents/:id` | metadados |
| GET | `/documents/:id/file` | arquivo original |
| GET | `/presets` | lista |
| POST | `/presets` | cria (valida a config) |
| GET | `/presets/:id` | detalhe |
| PUT | `/presets/:id` | edita (409 se `isBuiltin`) |
| DELETE | `/presets/:id` | remove (409 se `isBuiltin`) |
| POST | `/presets/:id/duplicate` | duplica |
| GET | `/runs?documentId=` | lista |
| POST | `/runs` | `{ documentId, presetId, configOverrides? }` → 202 com a run |
| GET | `/runs/:id` | run com os `StageRun` |
| GET | `/runs/:id/events` | SSE |
| GET | `/runs/:id/result` | resumo, fatos com evidências, métricas, afirmações, vereditos e alertas |
| GET | `/runs/:id/text` | texto canônico, seções, `pageMap`, relatório de limpeza, cobertura por chunk |
| GET | `/runs/:id/llm-calls` | lista resumida |
| GET | `/runs/:id/llm-calls/:callId` | chamada completa |
| POST | `/runs/:id/rerun` | reprocessamento (seção 7) |
| POST | `/runs/:id/cancel` | cancelamento |
| GET | `/runs/:id/export?format=json\|csv` | exportação (seção 11) |
| POST | `/analysis/cross-similarity` | `{ runIds }` → matriz resumo × documento (seção 13) |

## 9. Interface

**Stack:** React, Vite, TypeScript, Tailwind v4 (todo o estilo via utilitários), shadcn/ui como base de componentes, TanStack Router, TanStack Query, react-hook-form com resolver Zod, gráficos do shadcn (Recharts), ícones lucide.

**Diretrizes visuais:** interface limpa e moderna; paleta neutra com cor reservada a status e severidade (vermelho = high, âmbar = medium, azul = low/informativo; verde = confirmado/consistente); tema claro e escuro; skeletons em carregamento; estados vazios com orientação; navegação completa por teclado.

**Telas**

1. **Documentos (`/`).** Área de upload com arrastar e soltar; tabela com nome, origem (`upload` ou `corpus`), tipo detectado, páginas, número de runs e status da última. "Processar" abre um diálogo de escolha de preset (com override opcional).
2. **Execução (`/runs/:id`).**
   - Cabeçalho: documento, preset, status, custo e tempo acumulados, ações (exportar, reprocessar, cancelar, comparar).
   - Stepper lateral com as 6 etapas, atualizado por SSE: pendente, rodando (com a última mensagem de progresso), concluída, reaproveitada, falha. Cada etapa mostra duração, tokens e custo.
   - Abas:
     - **Resumo:** seções com chips dos fatos citados (hover mostra o fato); sublinhado colorido em parágrafos com alerta ou baixo `support`; glossário; legibilidade antes e depois; compressão.
     - **Dados extraídos:** fatos agrupados por categoria, com valor formatado, confiança, badge `confirmado` ou `incerto` (com motivos), seção de origem e "ver trecho". Filtros por categoria e status. Bloco com `notFound` e `ambiguities`.
     - **Verificação:** cartões com o índice de similaridade (e o aviso), `factualConsistency`, `claimSupport` e `unverifiableCount`; lista de alertas por severidade com título, explicação e "o documento diz / o resumo diz" lado a lado.
     - **Documento:** texto canônico com índice de seções; destaque das evidências; mapa de calor de cobertura (alternável); sub-aba "removido na limpeza" com o relatório por regra.
     - **Logs:** linha do tempo dos eventos; tabela de chamadas de LLM (agente, modelo, tokens, custo, latência, status) com painel lateral mostrando prompt e resposta completos.
   - Todo "ver trecho" abre um `Sheet` com o texto canônico rolado até o trecho, destacado, com número da página.
   - "Reprocessar a partir de..." abre diálogo com seleção da etapa e o formulário de config restrito às etapas seguintes.
   - Run com falha mostra cartão de erro com "tentar de novo a partir desta etapa".
3. **Comparar (`/compare?runs=a,b`).** Diff de config (campos alterados destacados), métricas lado a lado (gráfico de barras), resumos lado a lado, alertas por severidade, custo e latência. O diff é calculado no cliente a partir dos snapshots.
4. **Presets (`/presets`).** Lista; formulário em acordeão com um bloco por etapa (`models`, `textExtraction`, `classification`/`extraction`, `summarization`, `similarity`, `verification`) e visualização do JSON. Presets do seed somente leitura, com "duplicar".

**Tempo real no cliente.** `EventSource` por run aberta; cada evento atualiza o cache do TanStack Query (`setQueryData`) por um reducer puro e testado; o evento final invalida as queries de resultado.

## 10. Modelo de dados

Prisma sobre Postgres 17. IDs UUID. Datas `timestamptz`.

| Modelo | Campos principais |
|---|---|
| `Document` | `filename`, `mimeType`, `sizeBytes`, `sha256` (único), `storagePath`, `source` (`upload` \| `corpus`), `corpusKey?` |
| `Preset` | `slug` (único), `name`, `description`, `config` (Json), `isBuiltin` |
| `Run` | `documentId`, `presetId?`, `parentRunId?`, `startFromStage?`, `label?`, `status` (`queued` \| `running` \| `completed` \| `failed` \| `cancelled` \| `interrupted`), `config` (Json), `configHash`, `injectedFaults` (Json?), `error` (Json?), `startedAt?`, `finishedAt?` |
| `StageRun` | `runId`, `stage`, `status` (`pending` \| `running` \| `completed` \| `failed` \| `reused` \| `overridden`), `reusedFromStageRunId?`, `output` (Json?), `metrics` (Json?), `warnings` (Json), `error` (Json?), `durationMs?` |
| `RunEvent` | `runId`, `seq` (único com `runId`), `type`, `stage?`, `data` (Json), `createdAt` |
| `LlmCall` | `runId`, `stageRunId`, `agent`, `agentVersion`, `provider`, `model`, `params` (Json), `messages` (Json), `rawResponse` (Json), `parsedOutput` (Json?), `inputTokens`, `outputTokens`, `reasoningTokens?`, `costUsd`, `latencyMs`, `attempt`, `status`, `error` (Json?) |
| `EmbeddingCall` | `runId`, `stageRunId`, `model`, `inputCount`, `tokens`, `cacheHits`, `costUsd`, `latencyMs` |
| `EmbeddingCache` | chave `(model, dimensions, textHash)`, `vector` (`Float[]` → `real[]`) |
| `ExtractedFact` | `stageRunId`, `key` (`F01`), `category`, `label`, `value` (Json), `confidence`, `status`, `uncertaintyReasons` (String[]) |
| `FactEvidence` | `factId`, `quote`, `start?`, `end?`, `page?`, `sectionId?`, `matchType`, `matchScore?` |
| `Summary` | `stageRunId` (único), `content` (Json), `readabilitySource`, `readabilitySummary`, `compressionRatio` |
| `Claim` | `stageRunId`, `key`, `text`, `paragraphRef` (Json), `category?`, `value` (Json?) |
| `VerificationItem` | `stageRunId`, `direction`, `verdict`, `explanation`, `factId?`, `claimId?`, `decidedBy` (`code` \| `llm`), `usedQuotes` (Json) |
| `Alert` | `stageRunId`, `verificationItemId`, `type`, `severity`, `category?`, `title`, `explanation`, `sourceEvidence` (Json), `summaryRef` (Json?) |
| `RunMetrics` | `runId` (único), `centroid`, `coverage`, `support`, `alignmentF1`, `factualConsistency`, `claimSupport`, `unverifiableCount`, `factsConfirmed`, `factsUncertain`, `alertsHigh`, `alertsMedium`, `alertsLow`, `readabilitySource`, `readabilitySummary`, `compressionRatio`, `inputTokens`, `outputTokens`, `costUsd`, `durationMs` |

As entidades de domínio pertencem ao **`StageRun`**, não à run. Uma etapa reaproveitada lê os dados do `StageRun` original via `reusedFromStageRunId`, então reprocessar não duplica linhas. O texto canônico, as seções e os chunks ficam no `output` dos respectivos `StageRun`.

## 11. Exportação

- **JSON:** `GET /runs/:id/export?format=json` → arquivo único `run-<id>.json` com `schemaVersion: 1`, metadados do documento, snapshot da config, classificação, fatos com evidências e posições, resumo, métricas, afirmações, vereditos, alertas e totais de custo. O schema do arquivo é um Zod em `shared`.
- **CSV:** `?format=csv` → `run-<id>.zip` com `facts.csv`, `claims.csv`, `alerts.csv`, `metrics.csv` e `llm_calls.csv` (UTF-8 com BOM, separador vírgula, para abrir direto em planilhas).
- **Avaliação:** os scripts da seção 13 gravam em `reports/<timestamp>/` os arquivos `results.json`, `results.csv` e `summary.md`.

## 12. Erros

`PipelineError` com `code`, mensagem em inglês para log e mensagem em pt-BR para a UI:

| Código | Quando | Recuperação |
|---|---|---|
| `UNSUPPORTED_FILE` | formato não reconhecido | enviar outro arquivo |
| `FILE_TOO_LARGE` | acima de `maxFileSizeMb` | enviar outro arquivo |
| `LOW_TEXT_DENSITY` | PDF provavelmente escaneado | fora do escopo |
| `PROVIDER_NOT_CONFIGURED` | config usa provider sem chave | configurar `.env` ou trocar preset |
| `PROVIDER_ERROR` | falha do provider após retries | tentar de novo a partir da etapa |
| `RATE_LIMITED` | 429 persistente após retries | tentar de novo; reduzir concorrência |
| `SCHEMA_VALIDATION_FAILED` | saída fora do schema após o retry de correção | tentar de novo; trocar modelo |
| `CANCELLED` | cancelamento pelo usuário | reprocessar |
| `INTERRUPTED` | API reiniciou durante a run | retomar |

Degradações que não impedem o resultado viram **avisos** em `StageRun.warnings` (segmentação em fallback, classificação com baixa confiança, troca automática para `chunked` ou `hierarchical`), não falhas.

Config inválida é rejeitada ao salvar preset e ao criar run, incluindo checagem de capacidades do modelo no catálogo.

## 13. Corpus e avaliação

### 13.1 Corpus

20 documentos em `corpus/`, descritos em `corpus/manifest.json`:

```ts
{
  key: 'stj-resp-1969219-sp',
  file: 'stj/resp-1969219-sp.pdf',
  issuer: 'STJ' | 'CNJ',
  title: string,
  expectedType: 'court_decision' | 'normative_act',
  expectedSubtype: 'amendment' | null,
  version: 'original' | 'compiled',
  officialUrl: string,
  sha256: string,
  retrievedAt: string,
}
```

**STJ (10 acórdãos, `court_decision`, PDF do inteiro teor):** REsp 1.969.219-SP, REsp 1.999.905-RS, REsp 2.025.013-RJ, AgInt no AgInt no REsp 1.975.502-SP, REsp 2.136.836-SP, REsp 2.186.037-AM, REsp 2.200.180-SP, REsp 2.109.311-RJ, REsp 2.072.052-RJ, HC 989.426-PR.

**CNJ (10 atos, `normative_act`):**

| Ato | Versão | Subtipo |
|---|---|---|
| Resolução 335/2020 | compilada | — |
| Resolução 401/2021 | compilada | — |
| Resolução 455/2022 | compilada | — |
| Recomendação 144/2023 | original | — |
| Resolução 550/2024 | original | `amendment` (altera a Res. 400/2021) |
| Resolução 560/2024 | original | `amendment` (altera as Res. 293/2019 e 343/2020) |
| Recomendação 154/2024 | original | — |
| Resolução 600/2024 | original | — |
| Resolução 615/2025 | compilada | — |
| Resolução 674/2026 | original | `amendment` (altera o art. 15 da Res. 615/2025) |

Para os atos do CNJ, prefere-se o HTML da página oficial ou o PDF limpo ao recorte do DJe.

**Aquisição:** os portais do STJ (SCON) e do CNJ bloqueiam acesso automatizado (HTTP 403). Os arquivos são baixados na implementação pelo navegador embutido, com permissão do usuário por arquivo; o que continuar bloqueado é baixado manualmente pelo usuário. O corpus é congelado no repositório com `sha256` no manifest. O seed cadastra os 20 arquivos como `Document` com `source: 'corpus'`.

### 13.2 `pnpm eval:corpus`

`pnpm eval:corpus --preset <slug> [--preset <slug> ...] [--only <key>]`

- Chama a API por HTTP (mesmo caminho de execução; as runs aparecem na UI com `label: 'eval-corpus'`).
- Para cada documento e preset, coleta: tipo esperado contra detectado, fatos por categoria e status, legibilidade, compressão, as quatro métricas de similaridade, `factualConsistency`, `claimSupport`, `unverifiableCount`, alertas por severidade, tokens, custo e latência.
- **Matriz cruzada** por preset via `POST /analysis/cross-similarity`: `alignment_f1` de cada resumo contra todos os documentos do corpus, usando o cache de embeddings. O relatório compara a diagonal (resumo contra o próprio documento) com o restante.
- **Correlação** entre `alignment_f1` e `factualConsistency` nos 20 documentos, por preset.
- Saída em `reports/<timestamp>/`.

### 13.3 `pnpm eval:faults`

`pnpm eval:faults --from-label eval-corpus [--preset <slug>]`

Para cada run concluída, aplica mutadores determinísticos (`packages/pipeline/src/eval/faults/`) ao resumo, cada um registrando a detecção esperada:

| Mutador | Alteração | Detecção esperada |
|---|---|---|
| `date_shift` | altera uma data citada no resumo | `divergence` / `date` |
| `value_change` | altera um valor monetário | `divergence` / `monetary_value` |
| `deadline_change` | altera a quantidade ou remove "úteis" de um prazo | `divergence` / `deadline` |
| `outcome_flip` | inverte o resultado da decisão por léxico pt-BR ("negou provimento" ↔ "deu provimento", etc.) | `divergence` / `decision` |
| `omission` | remove o parágrafo que cita um fato crítico | `omission` |
| `fabrication` | insere uma frase com prazo ou valor inexistente | `unsupported_claim` |

O mutador só atua quando o alvo aparece literalmente no resumo; caso contrário, registra "não aplicável" para aquele documento. Cada resumo mutado vira um rerun com `fromStage: 'similarity'` e `summaryOverride` (similaridade é refeita porque o resumo mudou; o custo é baixo graças ao cache). O relatório traz a taxa de detecção por tipo de falha e os alertas novos que não correspondem a nenhuma falha injetada (comparados aos alertas da run de origem).

## 14. Testes

Vitest em todos os pacotes. Tarefas do Turbo: `lint` (Biome), `typecheck`, `test`, `build`.

| Nível | Alvo | Observação |
|---|---|---|
| Unitário | regras de limpeza | fixtures sintéticas com rodapé do STJ, cabeçalho do DJe, numeração de página |
| Unitário | hifenização | inclui pronomes oblíquos ("dar-lhe", "aplica-se") |
| Unitário | parsers pt-BR | datas, valores, prazos por extenso e numéricos |
| Unitário | ancoragem | `exact`, `fuzzy`, `not_found`, mapeamento de página |
| Unitário | segmentação | marcadores de acórdão e de ato normativo, fallback |
| Unitário | métricas | cosseno, centroid, coverage, support, F1, Flesch |
| Unitário | comparador, matriz de severidade, mutadores | tabelas de casos |
| Agente | `runAgent` | modelo mock do AI SDK: log, retry de correção, mapeamento de erros, parâmetros por capacidade |
| Snapshot | Etapa 1 nos 20 documentos do corpus | determinística, sem chave de API; pega regressões de limpeza |
| Integração | API | `fastify.inject` contra banco de teste no Postgres do compose (`TEST_DATABASE_URL`), providers mockados: upload, run, SSE, rerun, exportação |
| Web | reducer de eventos SSE | Vitest |
| Avaliação real | `eval:corpus`, `eval:faults` | com chaves reais, fora da suíte automatizada |

## 15. Infra e ambiente

**Variáveis (`.env.example` versionado, `.env` ignorado):**

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | `postgresql://app:app@postgres:5432/app` | Prisma |
| `TEST_DATABASE_URL` | `postgresql://app:app@localhost:5432/app_test` | testes de integração |
| `OPENAI_API_KEY` | — | geração e embeddings |
| `ANTHROPIC_API_KEY` | — | perfil Anthropic |
| `UPLOAD_DIR` | `/data/uploads` | arquivos enviados |
| `RUN_CONCURRENCY` | `2` | runs simultâneas |
| `LLM_CONCURRENCY` | `4` | chamadas paralelas por run |
| `PORT` | `3333` | API |
| `LOG_LEVEL` | `info` | pino |

**Scripts na raiz:** `dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`, `eval:corpus`, `eval:faults`.

**README:** pré-requisitos, `cp .env.example .env`, `docker compose up`, URLs, diagrama da arquitetura (Mermaid), descrição das etapas, como rodar a avaliação, link para os ADRs.

## 16. ADRs

Índice em [`docs/adr/README.md`](../../adr/README.md).

| # | Decisão |
|---|---|
| 0001 | Monorepo com Turborepo, pnpm e fronteiras entre pacotes |
| 0002 | API em Fastify e SPA em React/Vite com shadcn, Tailwind e TanStack |
| 0003 | Execução da pipeline in-process com checkpoint por etapa |
| 0004 | Tempo real via SSE com replay do log de eventos |
| 0005 | PostgreSQL com Prisma; logs e chamadas de LLM no banco |
| 0006 | Sem pgvector: vetores em `real[]`, similaridade em memória e cache |
| 0007 | Registry de providers do AI SDK; perfis OpenAI e Anthropic; embeddings via OpenAI |
| 0008 | Subagentes tipados com structured output, prompts em inglês e parâmetros de geração |
| 0009 | `PipelineConfig` em Zod, presets e snapshot por run |
| 0010 | Texto canônico imutável, limpeza determinística e `cleaner` que só marca linhas |
| 0011 | Schema de fatos, ancoragem de citações e sinalização de incerteza |
| 0012 | Métricas de similaridade e a posição "similaridade não é fidelidade" |
| 0013 | Verificação bidirecional, comparação por código antes do LLM, vereditos e severidade |
| 0014 | Avaliação: lote do corpus, matriz cruzada e injeção de falhas |
| 0015 | Exportação em JSON e ZIP de CSVs |
| 0016 | Docker Compose e configuração de ambiente |

## 17. Riscos e pontos a confirmar na implementação

- **IDs de modelo e preços:** confirmar na documentação da OpenAI e da Anthropic antes de preencher o catálogo.
- **Versões de bibliotecas:** usar as versões estáveis atuais de AI SDK, Prisma, Fastify, Tailwind e shadcn, conferindo as APIs na documentação no momento da implementação (structured output do AI SDK, setup do client do Prisma).
- **Download do corpus:** bloqueios dos portais podem exigir download manual de parte dos arquivos.
- **Recortes do DJe:** alguns PDFs "originais" do CNJ podem trazer trechos de outros atos na mesma página. Mitigação: preferir HTML ou PDF limpo; se inevitável, registrar no manifest e tratar como ruído conhecido.
- **Anexos em tabela** (Res. 550, 615, Rec. 154, Res. 401): a extração de PDF lineariza tabelas e pode gerar texto pouco legível. Aceito na PoC; registrado como limitação.
- **Contagem de sílabas** do Flesch-PT é heurística; o índice serve para comparação relativa, não absoluta.
- **Custo da avaliação:** 20 documentos × 4 presets × 6 etapas, mais as falhas injetadas. O relatório mostra o custo estimado acumulado e `eval:corpus` aceita `--only` para rodadas parciais.
