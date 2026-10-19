# Simplificador de Documentos Jurídicos — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a PoC do spec: monorepo com API Fastify, SPA React e uma pipeline de 6 etapas que extrai, limpa, analisa, resume e verifica documentos jurídicos, avaliada num corpus de 20 documentos do STJ e do CNJ.

**Architecture:** `@app/pipeline` concentra a lógica das etapas e dos subagentes, sem HTTP nem banco, recebendo um `StageContext` com portas. `@app/api` (Fastify) executa a pipeline in-process numa fila, grava checkpoints por etapa e eventos no Postgres via Prisma e transmite o progresso por SSE. `@app/web` (React + Vite + shadcn) consome a API usando os contratos Zod de `@app/shared`.

**Tech Stack:** Node 24 LTS, pnpm, Turborepo, TypeScript (strict, ESM), Biome, Vitest, Zod 4, AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`), Fastify 5 + `fastify-type-provider-zod`, Prisma + PostgreSQL 17, `unpdf`, `mammoth`, `cheerio`, `file-type`, `gpt-tokenizer`, `fastest-levenshtein`, `p-queue`, `fflate`, `tsup`, React 19, Vite, Tailwind v4, shadcn/ui, TanStack Router e Query, react-hook-form, Docker Compose e nginx. Na Task 1, usar a versão estável mais recente de cada pacote e fixá-la no lockfile.

**Spec:** [`docs/superpowers/specs/2026-10-18-legal-doc-simplifier-design.md`](../specs/2026-10-18-legal-doc-simplifier-design.md). As decisões estão em [`docs/adr/`](../../adr/README.md). Referências como "spec §6.2" apontam para seções do spec.

## Global Constraints

- Idioma (spec §2): código, identificadores, tabelas, colunas, enums, slugs, chaves de config, logs e nomes de arquivo em inglês. UI, texto gerado pelos modelos, mensagens de erro para o usuário, README e ADRs em pt-BR.
- Prompts em inglês. Todo system prompt termina com `PT_BR_OUTPUT_INSTRUCTION` (Task 6). Citações sempre literais.
- Valores de enum em `snake_case`; chaves de objeto e de config em `camelCase`.
- Node 24 (`.nvmrc` = `24`), pnpm via corepack, `"type": "module"` e `strict: true` em todos os pacotes.
- Pacotes: `@app/shared`, `@app/pipeline`, `@app/db`, `@app/api`, `@app/web`, `@app/tsconfig`. Os pacotes internos são TypeScript "just-in-time": `exports` aponta para `src/*.ts`. A API é empacotada com `tsup` (`noExternal: [/^@app\//]`, com `@prisma/*` e o client gerado como externos). A web é empacotada pelo Vite.
- O código de `src/` em `@app/pipeline` não importa `fastify`, `@prisma/*`, `@app/db`, `node:fs` nem `node:path`. Arquivos de teste podem usar `node:fs`.
- `@app/web` só depende de `@app/shared` entre os pacotes internos.
- Schemas usados como structured output de LLM seguem o modo estrito da OpenAI:
  - todo campo é obrigatório; para campos opcionais, usar `.nullable()`, nunca `.optional()`;
  - uniões são `z.discriminatedUnion` de objetos planos, sem `.and()` (que vira `allOf`);
  - mapas viram arrays de `{ key, value }`.
- Parâmetros de geração conforme spec §4.3. Nunca enviar `topP`. Enviar `seed: 42` quando o modelo tem `supportsSeed`.
- Respostas de erro HTTP sempre no formato `{ error: { code, message, details? } }`.
- IDs em UUID; datas em `timestamptz`. Tabelas em `snake_case` no plural (`@@map`) e colunas em `snake_case` (`@map`).
- Sem pgvector: vetores em `Float[]`. Sem login.
- UI: todo o estilo via Tailwind v4, componentes shadcn/ui, paleta neutra, cor só para status e severidade (spec §9).
- Testes ficam ao lado do código, como `*.test.ts(x)`. Os testes de integração da API ficam em `apps/api/test/` e usam `TEST_DATABASE_URL`.
- Commits pequenos no formato Conventional Commits, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Adições ao spec feitas neste plano** (o spec deixa estes pontos em aberto):
  - código de erro `INTERNAL_ERROR` para falhas inesperadas;
  - flag `supportsSeed` no catálogo de modelos;
  - campo `Section.parentLabel` (capítulo de um artigo);
  - `CleaningReport.removedByRule` como array `{ rule, count }[]`, em vez de `Record<string, number>`;
  - variável de ambiente `CORPUS_DIR`;
  - códigos de erro HTTP adicionais: `VALIDATION_ERROR`, `NOT_FOUND`, `PRESET_READ_ONLY`, `OVERRIDE_BEFORE_FROM_STAGE`, `MISSING_CHECKPOINT`, `RUN_NOT_COMPLETED`, `RUN_NOT_ACTIVE`, `MIXED_EMBEDDING_MODELS`;
  - tipos `FaultType` e `InjectedFault` em `@app/shared`.

## Review Focus

1. **Citações com reticências.** Modelos abreviam trechos com "..." ou "[...]". Esperado: a ancoragem divide a citação nesses marcadores, encontra os segmentos em ordem e usa o intervalo do primeiro ao último. Só marca `not_found` se algum segmento faltar. Teste na Task 13.
2. **Mesmo valor escrito de formas diferentes** no resumo e na fonte: "R$ 10 mil" × "R$ 10.000,00", "24 de março de 2025" × "24/03/2025". Esperado: o comparador por código normaliza com os parsers e decide `equal`, mesmo quando o LLM tipou o valor errado. Teste na Task 21.
3. **Documento sem fatos críticos, ou resumo sem afirmações.** Esperado: métricas com denominador zero viram `null` (a UI mostra "—"), nunca `NaN`, e as etapas 5 e 6 concluem normalmente. Testes nas Tasks 22 e 23.
4. **Run criada com preset cujo provider não tem chave.** Esperado: `POST /runs` responde 400 `PROVIDER_NOT_CONFIGURED` antes de enfileirar, sem deixar run com falha no histórico. Teste na Task 30.
5. **Mesmo arquivo enviado duas vezes.** Esperado: `POST /documents` devolve o documento existente (200, `deduplicated: true`), sem erro e sem duplicar. Teste na Task 26.

## File Structure

```
package.json · pnpm-workspace.yaml · turbo.json · biome.json · .nvmrc · .env.example · docker-compose.yml
packages/tsconfig/            base.json, node.json, react.json
packages/shared/src/
  domain/                     enums, document, facts, summary, similarity, verification, metrics, faults
  config/                     catalog, pipeline-config, overrides, presets
  api/                        errors, providers, documents, presets, runs, analysis
  events.ts · export.ts · corpus.ts · index.ts
packages/db/
  prisma/schema.prisma · prisma/migrations/ · src/{client,storage-path,seed,index}.ts
packages/pipeline/src/
  core/                       errors, context, stage, tokens, concurrency, agent, call-settings
  testing/                    context.ts (createTestContext), fixtures.ts (makePdf, makeDocx), fake-embedder.ts
  agents/                     cleaner, classifier, extractor, summarizer, claim-extractor, verifier
  stages/text-extraction/     detect-format, extractors/, cleaning/, assembly/, stage.ts
  stages/information-extraction/  parsers/, grounding/, classify, segment/, extract/, postprocess, stage.ts
  stages/summarization/       readability, stage.ts
  stages/similarity/          chunking, metrics, stage.ts
  stages/verification/        claims, pairing, compare, items, severity, alerts, metrics, stage.ts
  stages/report/stage.ts
  eval/faults/                um arquivo por mutador + index.ts
apps/api/src/
  main.ts · app.ts · env.ts · plugins/ · storage/
  modules/                    health, providers, documents, presets, runs, analysis
  runtime/                    event-bus, event-recorder, run-queue, pipeline-runner, stage-inputs, stages, adapters/, persistence/
  cli/                        seed, eval-corpus, eval-faults, http-client, report/
apps/api/test/                global-setup.ts, helpers/, *.test.ts
apps/web/src/
  routes/                     __root, index, runs/$runId, presets, compare
  lib/                        api-client, query-client, format, labels
  components/                 app-shell, theme-toggle, ui/ (shadcn)
  features/                   documents/, runs/ (tabs/, config-form/), presets/, compare/
corpus/                       manifest.json, stj/, cnj/, README.md
```

---

## Fase 0 — Fundação

### Task 1: Monorepo e ferramentas

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `.gitignore`, `.nvmrc`, `.env.example`
- Create: `packages/tsconfig/{package.json,base.json,node.json,react.json}`
- Create: `packages/shared/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/index.test.ts}`

**Interfaces:**
- Produces:
  - scripts na raiz: `dev`, `build`, `lint` (`biome check .`), `format`, `typecheck`, `test`. Os scripts `db:migrate`, `db:seed`, `eval:corpus` e `eval:faults` entram nas tasks que os implementam.
  - todo pacote tem os scripts `typecheck` (`tsc --noEmit`) e `test` (`vitest run`).
  - `turbo.json` define as tarefas `build` (`dependsOn: ["^build"]`, `outputs: ["dist/**"]`), `typecheck`, `test` e `dev` (`persistent: true`, `cache: false`).

- [ ] **Step 1: Escrever o teste de fumaça que falha**

```ts
// packages/shared/src/index.test.ts
import { SHARED_PACKAGE } from './index';
test('exports package marker', () => expect(SHARED_PACKAGE).toBe('@app/shared'));
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm install && pnpm --filter @app/shared test`
Expected: FAIL (`SHARED_PACKAGE` não existe)

- [ ] **Step 3: Criar o scaffold**

- O `.gitignore` cobre `node_modules`, `dist`, `.env`, `reports/`, `.turbo` e `coverage`.
- O `.env.example` traz as variáveis do spec §15 e `CORPUS_DIR=./corpus`.
- `packages/tsconfig/base.json`: `strict`, `module`/`moduleResolution` `bundler`, `target` `ES2023`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`.
- Exportar `SHARED_PACKAGE = '@app/shared'` em `src/index.ts`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: tudo PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold turborepo monorepo with shared package"
```

### Task 2: Pacote de banco (Prisma) e Postgres

**Files:**
- Create: `docker-compose.yml` (só o serviço `postgres` por enquanto), `scripts/postgres/init-test-db.sql`
- Create: `packages/db/{package.json,tsconfig.json,vitest.config.ts,prisma/schema.prisma,src/client.ts,src/storage-path.ts,src/index.ts,src/client.test.ts}`
- Create: `prisma.config.ts` em `packages/db`, se a versão instalada do Prisma o exigir

**Interfaces:**
- Produces:
  - `createPrismaClient(url?: string): PrismaClient` e o singleton `prisma`;
  - reexportação dos tipos de modelo e de `Prisma`;
  - `buildStoragePath(uploadDir: string, sha256: string, extension: string): string`, que devolve `${uploadDir}/${sha256}.${extension}`;
  - script `db:migrate` (`prisma migrate dev`) no pacote e na raiz.

- [ ] **Step 1: Conferir o setup do Prisma**

Ler a documentação da versão estável atual do Prisma. Se for a v7 ou superior, usar o generator `prisma-client` com `output` explícito, o `prisma.config.ts` e o driver adapter `@prisma/adapter-pg`.

- [ ] **Step 2: Subir o Postgres**

O compose tem `postgres:17` com `POSTGRES_USER/PASSWORD/DB=app`, o volume `pgdata`, a porta `5432:5432`, healthcheck com `pg_isready -U app` e `init-test-db.sql` (`CREATE DATABASE app_test;`) montado em `/docker-entrypoint-initdb.d/`.

Run: `docker compose up -d postgres && docker compose ps`
Expected: `postgres` com status `healthy`

- [ ] **Step 3: Escrever o teste de integração que falha**

```ts
// packages/db/src/client.test.ts  (usa TEST_DATABASE_URL)
test('persists a run with stage runs and enforces unique event seq', async () => {
  const doc = await db.document.create({ data: { filename: 'a.txt', mimeType: 'text/plain', sizeBytes: 3, sha256: 'x', storagePath: '/tmp/x.txt', source: 'upload' } });
  const run = await db.run.create({ data: { documentId: doc.id, status: 'queued', config: {}, configHash: 'h' } });
  await db.runEvent.create({ data: { runId: run.id, seq: 1, type: 'run.status', data: {} } });
  await expect(db.runEvent.create({ data: { runId: run.id, seq: 1, type: 'log', data: {} } })).rejects.toThrow();
});
test('buildStoragePath', () => expect(buildStoragePath('/data/uploads', 'abc', 'pdf')).toBe('/data/uploads/abc.pdf'));
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm --filter @app/db test`
Expected: FAIL (schema e client não existem)

- [ ] **Step 5: Escrever o `schema.prisma`**

- Todos os modelos do spec §10, com os campos listados lá.
- Prisma enums com os mesmos valores dos enums Zod (Task 3): `RunStatus`, `StageRunStatus`, `StageName`, `DocumentSource`, `FactCategory`, `Confidence`, `FactStatus`, `MatchType`, `Direction`, `Verdict`, `AlertType`, `Severity`, `DecidedBy`, `LlmCallStatus` (`success` | `error`).
- Unicidades:
  - `@@unique([runId, seq])` em `RunEvent`;
  - `@@unique([runId, stage])` em `StageRun`;
  - `@@unique([stageRunId, key])` em `ExtractedFact` e `Claim`;
  - `@@id([model, dimensions, textHash])` em `EmbeddingCache`, com `dimensions Int` e `0` representando "padrão do modelo".
- Deleção em cascata de `Document` para `Run`, de `Run` para todos os filhos e de `StageRun` para as entidades de domínio.
- Índices: `Run.documentId`, `Run.label`, `LlmCall.runId`.

- [ ] **Step 6: Gerar a migration e rodar o teste**

Run: `pnpm --filter @app/db exec prisma migrate dev --name init && DATABASE_URL=$TEST_DATABASE_URL pnpm --filter @app/db exec prisma migrate deploy && pnpm --filter @app/db test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(db): add prisma schema, initial migration and postgres compose service"
```

---

## Fase 1 — Contratos

### Task 3: Schemas de domínio e eventos

**Files:**
- Create: `packages/shared/src/domain/{enums,document,facts,summary,similarity,verification,metrics,faults}.ts`, `packages/shared/src/events.ts`
- Test: `packages/shared/src/domain/facts.test.ts`, `packages/shared/src/events.test.ts`
- Modify: `packages/shared/src/index.ts` (reexportar tudo)

**Interfaces:**
- Produces (cada schema `X` com `type X = z.infer<typeof X>`):
  - **`enums.ts`:** `StageName` (`text_extraction`, `information_extraction`, `summarization`, `similarity`, `verification`, `report`); `STAGE_ORDER = StageName.options`; `stageIndex(s: StageName): number`; `RunStatus`; `TERMINAL_RUN_STATUSES = ['completed','failed','cancelled','interrupted']`; `StageRunStatus`; `DocumentSource`; `SourceFormat` (`pdf`, `html`, `docx`, `txt`); `DocumentType`; `DocumentSubtype` (`amendment`); `SectionKind` (`preamble`, `headnote`, `judgment`, `report`, `vote`, `operative_part`, `judgment_certificate`, `recitals`, `article`, `annex`, `paragraph`); `FactCategory`; `Confidence` com `confidenceRank(c): 0|1|2`; `FactStatus`; `UncertaintyReason`; `MatchType`; `Direction`; `Verdict`; `SOURCE_VERDICTS = ['consistent','divergent','omitted','unverifiable']`; `CLAIM_VERDICTS = ['supported','divergent','unsupported','unverifiable']`; `AlertType`; `Severity`; `DecidedBy` (`code`, `llm`).
  - **`document.ts`:** `Section { id, kind, label, parentLabel: string|null, start, end }`; `Classification` (spec §6.2a, metadados `.nullable()`); `PageRange { page, start, end }`; `RemovedLine { rule: string, page: number|null, text: string }`; `CleaningReport { removed, charsBefore, charsAfter, removedByRule: { rule, count }[] }`; `TextExtractionOutput` (spec §6.1, com `cleaningReport` usando esse formato).
  - **`facts.ts`:** schemas de valor `DateValue`, `DeadlineValue`, `MonetaryValue`, `ObligationValue`, `DecisionValue`, `LegalReferenceValue`, `AmendmentValue` (spec §6.2c); `CategoryValue` (união dos sete); `FactDraft` (saída do LLM: `{ id, category, label, value, evidence: { quote }[] (min 1), confidence }`); `GroundedEvidence { quote, start, end, page, sectionId, matchType, matchScore }` (campos posicionais `.nullable()`); `GroundedFactDraft` (`FactDraft` com `evidence: GroundedEvidence[]`); `Fact` (`GroundedFactDraft` com `status` e `uncertaintyReasons`); `ExtractorOutput { facts: FactDraft[], notFound: FactCategory[], ambiguities: { description, quote }[] }`; `InformationExtractionOutput { classification, sections, facts: Fact[], notFound, ambiguities }`. As quatro variantes de fato são construídas por um helper `factVariants(common)`, gerando uma `z.discriminatedUnion('category', ...)` de objetos planos.
  - **`summary.ts`:** `Summary` (spec §6.3); `SummarizationOutput { summary, readability: { source: number, summary: number }, compressionRatio: number }`.
  - **`similarity.ts`:** `Chunk { id, start, end, tokens }`; `SummaryChunk { id, text, tokens, sectionIndex: number|null, paragraphIndex: number|null }`; `SimilarityMetrics { centroid, coverage, support, alignmentF1 }`; `SimilarityHeadline = 'centroid'|'coverage'|'support'|'alignment_f1'`; `SimilarityOutput { sourceChunks, summaryChunks, metrics, headline: { metric: SimilarityHeadline, value: number }, coverageByChunk: { chunkId, score, highlighted }[], supportByParagraph: { chunkId, score, highlighted }[] }`.
  - **`verification.ts`:** `ParagraphRef { sectionIndex: number, paragraphIndex: number }`; `ClaimDraft` (variantes tipadas por categoria mais `{ category: 'untyped', value: null }`, cada uma com `text` e `paragraphIndexInInput: number`); `Claim { id, text, paragraphRef: ParagraphRef|null, category: FactCategory|null, value: CategoryValue|null }`; `VerificationItem { id, direction, verdict, explanation, factId: string|null, claimId: string|null, decidedBy, usedQuotes: string[] }`; `Alert` (spec §6.5); `VerificationOutput { claims, items, alerts, metrics: { factualConsistency: number|null, claimSupport: number|null, unverifiableCount: number } }`.
  - **`metrics.ts`:** `RunMetricsShape` com os campos de `RunMetrics` do spec §10. As métricas que podem faltar são `number|null`.
  - **`faults.ts`:** `FaultType` (`date_shift`, `value_change`, `deadline_change`, `outcome_flip`, `omission`, `fabrication`); `InjectedFault { type, description: string, expected: { alertType: AlertType, category: FactCategory|null } }`.
  - **`events.ts`:** `RunEvent`, união discriminada por `type` com os tipos e dados do spec §7. Base de todo evento: `{ runId, seq: number, createdAt: string, stage: StageName|null }`. `RunEventInput` é o `RunEvent` sem `seq` e `createdAt`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// facts.test.ts
const deadline = { id: 'F01', category: 'deadline', label: 'Prazo para recorrer',
  value: { amount: 15, unit: 'days', businessDays: true, trigger: 'intimação' },
  evidence: [{ quote: '15 (quinze) dias úteis' }], confidence: 'high' };
test('accepts a deadline fact', () => expect(FactDraft.parse(deadline)).toEqual(deadline));
test('rejects value of another category', () =>
  expect(() => FactDraft.parse({ ...deadline, category: 'date' })).toThrow());
test('rejects empty evidence', () => expect(() => FactDraft.parse({ ...deadline, evidence: [] })).toThrow());
test('LLM schemas have no allOf', () => {
  for (const s of [ExtractorOutput, Summary, z.object({ claims: z.array(ClaimDraft) })])
    expect(JSON.stringify(z.toJSONSchema(s))).not.toContain('"allOf"');
});
// events.test.ts
test('parses stage.progress', () => expect(RunEvent.parse({ type: 'stage.progress', runId: crypto.randomUUID(), seq: 3,
  createdAt: new Date().toISOString(), stage: 'information_extraction', message: 'Extraindo fatos: chunk 3/8', current: 3, total: 8 }).type).toBe('stage.progress'));
test('verdict subsets', () => {
  expect(SOURCE_VERDICTS).toEqual(['consistent', 'divergent', 'omitted', 'unverifiable']);
  expect(CLAIM_VERDICTS).toEqual(['supported', 'divergent', 'unsupported', 'unverifiable']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/shared test`
Expected: FAIL (módulos inexistentes)

- [ ] **Step 3: Implementar os schemas listados em Interfaces**

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/shared test && pnpm --filter @app/shared typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(shared): add domain schemas and run events"
```

### Task 4: Catálogo de modelos, `PipelineConfig` e presets

**Files:**
- Create: `packages/shared/src/config/{catalog,pipeline-config,overrides,presets}.ts`
- Test: `packages/shared/src/config/{pipeline-config,overrides,catalog}.test.ts`

**Interfaces:**
- Consumes: enums da Task 3.
- Produces:
  - `ModelCatalogEntry { ref, provider: 'openai'|'anthropic', kind: 'language'|'embedding', label, contextWindow, supportsTemperature, supportsReasoningEffort, supportsStructuredOutput, supportsSeed, embeddingDimensions: number|null, pricePerMTokens: { input, output } }`.
  - `MODEL_REFS = { openaiMain, openaiSmall, anthropicMain, anthropicSmall, embeddingSmall: 'openai:text-embedding-3-small', embeddingLarge: 'openai:text-embedding-3-large' }`; `MODEL_CATALOG: ModelCatalogEntry[]`.
  - `findModel(ref: string): ModelCatalogEntry | undefined`, `providerOf(ref: string): 'openai'|'anthropic'`, `estimateCostUsd(ref: string, inputTokens: number, outputTokens?: number): number`.
  - `ReasoningEffort = 'low'|'medium'|'high'`; `ModelSettings { model: string, temperature: number|null, reasoningEffort: ReasoningEffort|null, maxOutputTokens: number|null }`; `AgentRole = 'cleaning'|'classification'|'extraction'|'summarization'|'claimExtraction'|'verification'`.
  - `PipelineConfig` (schema Zod com os padrões exatos do spec §5.1, onde `<main>` = `MODEL_REFS.openaiMain` e `<small>` = `MODEL_REFS.openaiSmall`); `type PipelineConfig = z.output<...>`; `type PipelineConfigInput = z.input<...>`; `parsePipelineConfig(input: unknown): PipelineConfig`.
  - `DeepPartial<T>`; `mergeConfig(base: PipelineConfig, overrides: DeepPartial<PipelineConfig>): PipelineConfig` (mescla objetos em profundidade, substitui arrays e valida o resultado de novo).
  - `earliestStageAffected(overrides: DeepPartial<PipelineConfig>): StageName | null`, pelo mapeamento: `models.cleaning`, `textExtraction` → `text_extraction`; `models.classification`, `models.extraction`, `classification`, `extraction` → `information_extraction`; `models.summarization`, `summarization` → `summarization`; `similarity` → `similarity`; `models.claimExtraction`, `models.verification`, `verification` → `verification`.
  - `requiredProviders(config: PipelineConfig): Set<'openai'|'anthropic'>`, olhando todos os slots e o modelo de embedding.
  - `BUILTIN_PRESETS: { slug, name, description, config: PipelineConfigInput }[]`, conforme o spec §5.2, com nomes e descrições em pt-BR.

- [ ] **Step 1: Confirmar IDs e preços dos modelos**

Abrir as páginas oficiais de modelos e de preços da OpenAI e da Anthropic.
- Preencher `MODEL_CATALOG` com:
  - o modelo principal e o pequeno mais recentes da família GPT-5;
  - `anthropic:claude-sonnet-5-5` e `anthropic:claude-haiku-5-5`, se os IDs se confirmarem;
  - os dois modelos de embedding.
- Flags de capacidade:
  - modelos de raciocínio da OpenAI: `supportsTemperature: false` e `supportsReasoningEffort: true`;
  - Claude: `supportsTemperature: true` e `supportsReasoningEffort: false` (esta PoC não liga extended thinking);
  - `supportsSeed` conforme a documentação de cada modelo.
- Registrar no topo do arquivo a data e as URLs consultadas.

- [ ] **Step 2: Escrever os testes que falham**

```ts
test('defaults', () => {
  const c = parsePipelineConfig({});
  expect(c.extraction.maxSinglePassTokens).toBe(60_000);
  expect(c.models.summarization.temperature).toBe(0.3);
  expect(c.similarity.headline).toBe('alignment_f1');
  expect(c.textExtraction.cleaning.llmCleanup).toBe('off');
});
test('rejects embedding model in a generation slot', () => {
  const r = PipelineConfig.safeParse({ models: { extraction: { model: MODEL_REFS.embeddingSmall } } });
  expect(r.success).toBe(false);
  expect(r.error!.issues[0]!.path).toEqual(['models', 'extraction', 'model']);
});
test('rejects language model as embedding model', () =>
  expect(PipelineConfig.safeParse({ similarity: { embeddingModel: MODEL_REFS.openaiMain } }).success).toBe(false));
test('rejects unknown ref', () =>
  expect(PipelineConfig.safeParse({ models: { extraction: { model: 'openai:does-not-exist' } } }).success).toBe(false));
test('mergeConfig keeps siblings', () => {
  const m = mergeConfig(parsePipelineConfig({}), { summarization: { targetLength: 'short' } });
  expect(m.summarization).toMatchObject({ targetLength: 'short', audience: 'layperson' });
});
test('earliestStageAffected', () => {
  expect(earliestStageAffected({ summarization: { targetLength: 'short' } })).toBe('summarization');
  expect(earliestStageAffected({ models: { verification: { temperature: 0 } }, similarity: { headline: 'centroid' } })).toBe('similarity');
  expect(earliestStageAffected({})).toBeNull();
});
test('presets parse and need the right providers', () => {
  expect(BUILTIN_PRESETS.map((p) => p.slug)).toEqual(['openai-default', 'anthropic-default', 'cross-verifier', 'budget']);
  const bySlug = Object.fromEntries(BUILTIN_PRESETS.map((p) => [p.slug, parsePipelineConfig(p.config)]));
  expect([...requiredProviders(bySlug['anthropic-default']!)].sort()).toEqual(['anthropic', 'openai']);
  expect([...requiredProviders(bySlug['openai-default']!)]).toEqual(['openai']);
});
test('estimateCostUsd', () => {
  const e = findModel(MODEL_REFS.openaiMain)!;
  expect(estimateCostUsd(e.ref, 1_000_000, 0)).toBeCloseTo(e.pricePerMTokens.input);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @app/shared test src/config`
Expected: FAIL

- [ ] **Step 4: Implementar os módulos listados em Interfaces**

As validações cruzadas ficam num `superRefine` sobre o objeto inteiro, com caminhos (`path`) precisos.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @app/shared test && pnpm --filter @app/shared typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(shared): add model catalog, pipeline config schema and builtin presets"
```

---

## Fase 2 — Núcleo da pipeline

### Task 5: Erros, portas, tokens e concorrência

**Files:**
- Create: `packages/pipeline/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`
- Create: `packages/pipeline/src/core/{errors,context,stage,tokens,concurrency}.ts`, `packages/pipeline/src/testing/context.ts`
- Test: `packages/pipeline/src/core/{errors,tokens,concurrency}.test.ts`

**Interfaces:**
- Consumes: `PipelineConfig`, `StageName` (Tasks 3 e 4).
- Produces:
  - `PipelineErrorCode` (os 9 códigos do spec §12, mais `INTERNAL_ERROR`).
  - `class PipelineError extends Error { code: PipelineErrorCode; userMessage: string; details?: unknown; constructor(code, message: string, details?: unknown) }`, `USER_MESSAGES: Record<PipelineErrorCode, string>` (pt-BR) e `isPipelineError(e: unknown): e is PipelineError`.
  - `LlmCallRecord` e `EmbeddingCallRecord`: os campos de `LlmCall` e de `EmbeddingCall` do spec §10, sem ids e sem `runId`/`stageRunId`.
  - Portas:
    - `ModelResolver { resolve(ref: string): LanguageModel }`;
    - `Embedder { embed(texts: string[], options: { model: string; dimensions: number|null }): Promise<number[][]> }`;
    - `CallRecorder { recordLlmCall(r: LlmCallRecord): Promise<void>; recordEmbeddingCall(r: EmbeddingCallRecord): Promise<void> }`;
    - `StageEventSink { progress(message: string, current?: number, total?: number): void; log(level: 'debug'|'info'|'warn'|'error', message: string, data?: unknown): void; warn(code: string, message: string): void }`.
  - `StageContext { runId: string; config: PipelineConfig; models: ModelResolver; embedder: Embedder; recorder: CallRecorder; events: StageEventSink; signal: AbortSignal; llmConcurrency: number }`.
  - `Stage<I, O> { name: StageName; output: z.ZodType<O>; run(input: I, ctx: StageContext): Promise<O> }`.
  - `countTokens(text: string): number` (`encode(text).length` do `gpt-tokenizer`), `headTokens(text: string, n: number): string` e `tailTokens(text: string, n: number): string`.
  - `mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>, signal?: AbortSignal): Promise<R[]>`, que preserva a ordem e rejeita com `PipelineError('CANCELLED')` quando abortado.
  - Subpath `@app/pipeline/testing`: `createTestContext(overrides?: Partial<StageContext>)` devolve um `StageContext` com `recorded: { llm: LlmCallRecord[]; embeddings: EmbeddingCallRecord[] }` e `emitted: { progress: string[]; logs: { level; message }[]; warnings: { code; message }[] }`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('user message in pt-BR', () =>
  expect(new PipelineError('LOW_TEXT_DENSITY', 'x').userMessage).toMatch(/escaneado/));
test('countTokens', () => { expect(countTokens('')).toBe(0); expect(countTokens('Recurso especial provido.')).toBeGreaterThan(0); });
test('mapWithConcurrency respects limit and order', async () => {
  let active = 0, peak = 0;
  const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
    active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 5)); active--; return n * 2;
  });
  expect(peak).toBe(2); expect(out).toEqual([2, 4, 6, 8, 10]);
});
test('mapWithConcurrency aborts', async () => {
  const ac = new AbortController(); ac.abort();
  await expect(mapWithConcurrency([1], 1, async (n) => n, ac.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test src/core`
Expected: FAIL

- [ ] **Step 3: Implementar os módulos listados em Interfaces**

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test && pnpm --filter @app/pipeline typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add core errors, context ports, token and concurrency utils"
```

### Task 6: Runtime de subagentes

**Files:**
- Create: `packages/pipeline/src/core/{agent,call-settings}.ts`
- Test: `packages/pipeline/src/core/{agent,call-settings}.test.ts`

**Interfaces:**
- Consumes: `StageContext`, `PipelineError`, `findModel`, `estimateCostUsd`, `ModelSettings`, `AgentRole`.
- Produces:
  - `PT_BR_OUTPUT_INSTRUCTION = 'Write every free-text field in Brazilian Portuguese (pt-BR). Copy quotes verbatim from the source, without translating or correcting them.'`
  - `defineAgent<I extends z.ZodType, O extends z.ZodType>(def: { name: string; version: string; role: AgentRole; input: I; output: O; system: string; prompt: (input: z.output<I>) => string; maxOutputTokens: number }): AgentDefinition<I, O>`.
  - `runAgent<I extends z.ZodType, O extends z.ZodType>(agent: AgentDefinition<I, O>, input: z.input<I>, ctx: StageContext): Promise<z.output<O>>`.
  - `buildCallSettings(settings: ModelSettings, entry: ModelCatalogEntry, agentMaxOutputTokens: number): { temperature?: number; seed?: number; maxOutputTokens: number; providerOptions?: Record<string, Record<string, unknown>> }`.

- [ ] **Step 1: Ler a documentação do AI SDK instalado**

Confirmar três coisas na versão instalada:
- a API de structured output que não está depreciada (`generateText` com `Output.object`, ou `generateObject`);
- o modelo mock exportado por `ai/test`;
- a classe de erro de falha de objeto (`NoObjectGeneratedError`) e os campos de uso (`inputTokens`, `outputTokens`, `reasoningTokens`).

- [ ] **Step 2: Escrever os testes que falham**

Os testes usam o mock do `ai/test` e o `createTestContext`.

```ts
test('returns parsed output and records one call', async () => {
  const out = await runAgent(echoAgent, { text: 'oi' }, ctxWith(mockReturning({ answer: 'olá' })));
  expect(out).toEqual({ answer: 'olá' });
  expect(ctx.recorded.llm).toHaveLength(1);
  expect(ctx.recorded.llm[0]).toMatchObject({ agent: 'echo', agentVersion: '1.0.0', attempt: 1, status: 'success' });
});
test('retries once on schema mismatch', async () => { /* mock: 1ª resposta inválida, 2ª válida */
  expect(ctx.recorded.llm.map((r) => r.attempt)).toEqual([1, 2]);
  expect(JSON.stringify(ctx.recorded.llm[1]!.messages)).toContain('did not match the required schema');
});
test('throws SCHEMA_VALIDATION_FAILED after second mismatch', /* ... */ () => {});
test('maps HTTP 429 to RATE_LIMITED', /* ... */ () => {});
test('throws CANCELLED when signal already aborted', /* ... */ () => {});
test('system prompt ends with PT_BR_OUTPUT_INSTRUCTION', /* inspecionar a chamada do mock */ () => {});
// call-settings.test.ts
test('reasoning model uses reasoningEffort, never temperature/topP', () => {
  const s = buildCallSettings({ model: 'x', temperature: 0, reasoningEffort: 'medium', maxOutputTokens: null }, openaiReasoningEntry, 4000);
  expect(s.temperature).toBeUndefined();
  expect(s.providerOptions?.openai?.reasoningEffort).toBe('medium');
  expect(s).not.toHaveProperty('topP');
});
test('claude uses temperature and no providerOptions', () => {
  const s = buildCallSettings({ model: 'x', temperature: 0.3, reasoningEffort: 'medium', maxOutputTokens: null }, claudeEntry, 4000);
  expect(s.temperature).toBe(0.3); expect(s.providerOptions).toBeUndefined();
});
test('seed only when supported; maxOutputTokens falls back to agent default', () => {
  expect(buildCallSettings(settings, { ...claudeEntry, supportsSeed: true }, 4000).seed).toBe(42);
  expect(buildCallSettings({ ...settings, maxOutputTokens: null }, claudeEntry, 4000).maxOutputTokens).toBe(4000);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test src/core/agent src/core/call-settings`
Expected: FAIL

- [ ] **Step 4: Implementar `runAgent` e `buildCallSettings`**

`runAgent` segue esta ordem:
1. Valida a entrada com `agent.input`. Entrada inválida é erro de programação: lança `INTERNAL_ERROR`.
2. Lê o slot com `ctx.config.models[agent.role]` e procura a entrada no catálogo.
3. Monta o system prompt como `agent.system + '\n\n' + PT_BR_OUTPUT_INSTRUCTION`.
4. Faz a chamada com `maxRetries: 2` e `abortSignal: ctx.signal`.
5. Se a resposta não bater com o schema, repete uma vez acrescentando a mensagem do usuário `Your previous answer did not match the required schema. Validation errors: <issues>. Answer again following the schema exactly.`
6. Mapeia os erros: HTTP 429 → `RATE_LIMITED`; outros erros de API → `PROVIDER_ERROR`; abort → `CANCELLED`; segunda falha de schema → `SCHEMA_VALIDATION_FAILED`.
7. Registra cada tentativa com `latencyMs` e `costUsd` (calculado por `estimateCostUsd`).

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add typed subagent runtime with schema repair and call recording"
```

---

## Fase 3 — Etapa 1: extração e limpeza

### Task 7: Detecção de formato e extratores

**Files:**
- Create: `packages/pipeline/src/stages/text-extraction/{types,detect-format}.ts`, `.../extractors/{pdf,html,docx,txt,index}.ts`
- Create: `packages/pipeline/src/testing/fixtures.ts`
- Test: `.../text-extraction/detect-format.test.ts`, `.../extractors/extractors.test.ts`

**Interfaces:**
- Produces:
  - `Line { id: number; text: string; y: number; height: number; page: number }`, em que `y` é medido a partir do topo da página (`pageHeight - transform[5]`) e `id` é sequencial no documento inteiro;
  - `Page { number: number; height: number; lines: Line[] }`;
  - `LineDocument { format: SourceFormat; pages: Page[] }`;
  - `detectFormat(buffer: Uint8Array, filename: string): Promise<SourceFormat>`;
  - `extractLines(buffer: Uint8Array, format: SourceFormat, options: { dropStrikethrough: boolean }): Promise<LineDocument>`;
  - no subpath `testing`: `makePdf(pages: string[][]): Promise<Uint8Array>` (pdf-lib, Helvetica 11pt, primeira linha em y=50, espaçamento de 14pt, página A4) e `makeDocx(paragraphs: string[]): Promise<Uint8Array>` (pacote `docx`). Os dois ficam em devDependencies.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('detects formats', async () => {
  expect(await detectFormat(await makePdf([['Art. 1º']]), 'a.pdf')).toBe('pdf');
  expect(await detectFormat(await makeDocx(['Art. 1º']), 'a.docx')).toBe('docx');
  expect(await detectFormat(enc('<html><body><p>Art. 1º</p></body></html>'), 'a.html')).toBe('html');
  expect(await detectFormat(enc('Art. 1º Fica instituído'), 'a.txt')).toBe('txt');
  await expect(detectFormat(PNG_HEADER, 'a.png')).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' });
});
test('pdf lines per page, top to bottom', async () => {
  const doc = await extractLines(await makePdf([['Linha A', 'Linha B'], ['Linha C']]), 'pdf', { dropStrikethrough: true });
  expect(doc.pages.map((p) => p.lines.map((l) => l.text))).toEqual([['Linha A', 'Linha B'], ['Linha C']]);
  expect(doc.pages[0]!.lines[0]!.y).toBeLessThan(doc.pages[0]!.lines[1]!.y);
});
test('html drops strikethrough when asked', async () => {
  const html = enc('<p>Texto <s>revogado</s> vigente</p>');
  expect((await extractLines(html, 'html', { dropStrikethrough: true })).pages[0]!.lines[0]!.text).toBe('Texto vigente');
  expect((await extractLines(html, 'html', { dropStrikethrough: false })).pages[0]!.lines[0]!.text).toBe('Texto revogado vigente');
});
test('docx paragraphs become lines', async () =>
  expect((await extractLines(await makeDocx(['Um', 'Dois']), 'docx', { dropStrikethrough: true })).pages[0]!.lines.map((l) => l.text)).toEqual(['Um', 'Dois']));
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test src/stages/text-extraction`
Expected: FAIL

- [ ] **Step 3: Implementar a detecção e os extratores**

- **`detectFormat`:** usa `fileTypeFromBuffer` para `pdf` e `docx`. Outros formatos binários dão `UNSUPPORTED_FILE`. Se o `file-type` não reconhecer nada, decodifica como UTF-8 com `fatal: true` (falha também dá `UNSUPPORTED_FILE`). É `html` quando os primeiros 2 KB casam `/<(!doctype html|html|body|div|p)\b/i`; senão, `txt`.
- **PDF:** `getDocumentProxy` do `unpdf`, depois `getTextContent()` por página.
  - Itens com |Δy| ≤ 2 formam uma linha, ordenados por x.
  - Junta os itens com espaço quando a distância horizontal é maior que 0,5 × a altura da fonte.
  - A `height` da linha é a maior altura entre os itens.
- **HTML:** carrega com `cheerio` e remove `script`, `style`, `nav`, `header` e `footer` (e também `s`, `del`, `strike` se `dropStrikethrough`).
  - Cada `p`, `li`, `h1`–`h6`, `td` e cada `div` sem filhos de bloco vira uma linha.
  - Espaços são colapsados.
  - Tudo fica numa página só, com `y` = índice da linha e `height` = 1.
- **DOCX:** `mammoth.convertToHtml({ buffer })`, depois o extrator de HTML.
- **TXT:** uma linha por `\n`, numa página.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test src/stages/text-extraction`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add format detection and pdf/html/docx/txt line extractors"
```

### Task 8: Regras de limpeza (normalização, bordas repetidas, numeração, boilerplate)

**Files:**
- Create: `.../text-extraction/cleaning/{types,normalize-unicode,repeated-edges,page-numbers,boilerplate,patterns}.ts`
- Test: `.../cleaning/cleaning.test.ts`

**Interfaces:**
- Consumes: `LineDocument`, `RemovedLine`.
- Produces:
  - `CleaningResult { doc: LineDocument; removed: RemovedLine[] }`;
  - `normalizeUnicode(doc: LineDocument): LineDocument`;
  - `removeRepeatedEdges(doc: LineDocument, opts: { edgeBandRatio: number; repeatThreshold: number }): CleaningResult` (regra `repeated_edge`);
  - `removePageNumbers(doc: LineDocument): CleaningResult` (regra `page_number`);
  - `BOILERPLATE_PATTERN_SETS: Record<'stj-e-signature' | 'dje-header', RegExp[]>`;
  - `removeBoilerplate(doc: LineDocument, sets: (keyof typeof BOILERPLATE_PATTERN_SETS)[]): CleaningResult` (regra `boilerplate:<set>`).

- [ ] **Step 1: Escrever os testes que falham**

```ts
const page = (n: number, body: string[]) => ({ number: n, height: 800, lines: [
  line('SUPERIOR TRIBUNAL DE JUSTIÇA', 20, n), ...body.map((t, i) => line(t, 200 + i * 14, n)), line(`Página ${n} de 4`, 780, n)] });
test('removes header/footer repeated across >= 3 pages', () => {
  const r = removeRepeatedEdges(doc([page(1, ['a']), page(2, ['b']), page(3, ['c']), page(4, ['d'])]), { edgeBandRatio: 0.1, repeatThreshold: 0.5 });
  expect(r.removed).toHaveLength(8);
  expect(r.doc.pages.flatMap((p) => p.lines.map((l) => l.text))).toEqual(['a', 'b', 'c', 'd']);
});
test('skips documents with fewer than 3 pages', () => expect(removeRepeatedEdges(doc([page(1, ['a']), page(2, ['b'])]), opts).removed).toEqual([]));
test('keeps repeated text outside the edge band', /* mesma linha em y=400 em todas as páginas fica */ () => {});
test('page numbers', () => {
  for (const t of ['- 3 -', '3/20', 'Pág. 3', 'Página 3 de 20', '12']) expect(isRemoved(removePageNumbers, t)).toBe(true);
  expect(isRemoved(removePageNumbers, 'Art. 3')).toBe(false);
});
test('stj signature stamp removed, body citation kept', () => {
  expect(isRemoved(stj, 'Documento eletrônico VDA123 assinado eletronicamente nos termos do Art.1º §2º inciso III da Lei 11.419/2006')).toBe(true);
  expect(isRemoved(stj, 'Código de Controle do Documento: 1a2b3c')).toBe(true);
  expect(isRemoved(stj, 'nos termos da Lei 11.419/2006, o processo eletrônico admite')).toBe(false);
});
test('dje header removed', () => expect(isRemoved(dje, 'Edição nº 101/2022 Brasília - DF, disponibilização: terça-feira, 10 de maio de 2022')).toBe(true));
test('normalizeUnicode', () => {
  expect(norm('eﬁcácia')).toBe('eficácia'); expect(norm('R$ 10')).toBe('R$ 10');
  expect(norm('ação')).toBe('ação');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test src/stages/text-extraction/cleaning`
Expected: FAIL

- [ ] **Step 3: Implementar as regras**

- **Bordas repetidas:**
  - só se aplica com 3 páginas ou mais;
  - candidatas são as linhas com `y ≤ band × height` ou `y ≥ (1 − band) × height`;
  - a chave de comparação é o texto em minúsculas, com dígitos trocados por `#` e espaços colapsados, contada uma vez por página;
  - remove as candidatas cuja chave aparece em pelo menos `ceil(repeatThreshold × páginas)` páginas.
- **Numeração de página:** remove linhas que casam
  - `^-?\s*\d{1,4}\s*-?$`;
  - `^\d{1,4}\s*\/\s*\d{1,4}$`;
  - `^p[áa]g(ina|\.)?\s*\d{1,4}(\s*(de|\/)\s*\d{1,4})?$` (sem diferenciar maiúsculas).
- **Padrões iniciais**, refinados com o corpus na Task 11:
  - `stj-e-signature`: `/assinado eletronicamente/i`, `/c[óo]digo de controle/i`, `/site certificado/i`, `/^documento:?\s*\d+.*p[áa]gina\s*\d+\s*de\s*\d+/i`;
  - `dje-header`: `/^edi[çc][ãa]o\s*n[ºo°]?\s*\d+\/\d{4}/i`, `/^di[áa]rio da justi[çc]a eletr[ôo]nico/i`.
- **Normalização:** NFC; ligaduras `ﬀ ﬁ ﬂ ﬃ ﬄ`; ` `, ` ` e ` ` viram espaço; remove caracteres de controle; trim; colapsa espaços.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test src/stages/text-extraction/cleaning`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add deterministic cleaning rules for edges, page numbers and boilerplate"
```

### Task 9: Texto canônico e estágio `text_extraction`

**Files:**
- Create: `.../text-extraction/assembly/{dehyphenate,paragraphs,canonical}.ts`, `.../text-extraction/stage.ts`
- Test: `.../assembly/assembly.test.ts`, `.../text-extraction/stage.test.ts`

**Interfaces:**
- Consumes: Tasks 5, 7 e 8.
- Produces:
  - `CLITICS = ['lhe','lhes','se','o','a','os','as','me','te','nos','vos','lo','la','los','las','no','na']`;
  - `dehyphenate(lines: Line[]): Line[]`;
  - `STRUCTURAL_MARKER: RegExp` (spec §6.1, regra 6);
  - `paragraphBreaks(doc: LineDocument): boolean[]` (`true` = começa parágrafo antes da linha i, na ordem do documento);
  - `buildCanonicalText(lines: Line[], breaks: boolean[]): { canonicalText: string; pageMap: PageRange[]; lineSpans: { lineId: number; start: number; end: number }[] }`;
  - `TextExtractionInput { buffer: Uint8Array; filename: string }`;
  - `textExtractionStage: Stage<TextExtractionInput, TextExtractionOutput>`;
  - um hook `llmCleanupHook` com a mesma assinatura de `applyLlmCleanup` (Task 10). Até a Task 10 ele não remove nada, e nunca é chamado quando `llmCleanup` vale `'off'`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('dehyphenate joins word, keeps clitic hyphen, ignores uppercase', () => {
  expect(texts(dehyphenate(ls(['a obriga-', 'ção de pagar'])))).toEqual(['a obrigação', 'de pagar']);
  expect(texts(dehyphenate(ls(['cumpre dar-', 'lhe ciência'])))).toEqual(['cumpre dar-lhe', 'ciência']);
  expect(texts(dehyphenate(ls(['Superior-', 'Tribunal'])))).toEqual(['Superior-', 'Tribunal']);
});
test('paragraphs break on terminal punctuation and structural markers', () => {
  const d = docFromLines(['O recurso foi', 'provido.', 'Art. 1º Fica', 'instituído']);
  expect(buildCanonicalText(allLines(d), paragraphBreaks(d)).canonicalText).toBe('O recurso foi provido.\n\nArt. 1º Fica instituído');
});
test('pageMap slices map back to pages', /* texto em 2 páginas; slice(pageMap[1]) contém o texto da página 2 */ () => {});
test('stage cleans a synthetic STJ-like pdf', async () => {
  const pdf = await makePdf([1, 2, 3, 4].map((n) => ['SUPERIOR TRIBUNAL DE JUSTIÇA', 'a obriga-', 'ção de pagar.', `Página ${n} de 4`]));
  const out = await textExtractionStage.run({ buffer: pdf, filename: 'x.pdf' }, createTestContext());
  expect(out.canonicalText).toContain('obrigação de pagar.');
  expect(out.canonicalText).not.toContain('Página');
  expect(out.cleaningReport.removedByRule).toEqual(expect.arrayContaining([{ rule: 'repeated_edge', count: 8 }]));
  expect(out.stats.pages).toBe(4);
});
test('toggle off keeps headers', /* removeRepeatedHeadersFooters: false → texto contém o cabeçalho */ () => {});
test('FILE_TOO_LARGE', /* maxFileSizeMb: 0.0001 */ () => {});
test('LOW_TEXT_DENSITY', /* 3 páginas com 'x' e minCharsPerPage 200 */ () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test src/stages/text-extraction`
Expected: FAIL

- [ ] **Step 3: Implementar a montagem e o estágio**

- **`dehyphenate`:** vale quando a linha i termina em `/[a-zà-ú]-$/i` e a linha i+1 começa com letra minúscula.
  - Se a primeira palavra da linha i+1 está em `CLITICS`, mantém o hífen e cola a palavra na linha i ("dar-" + "lhe" → "dar-lhe").
  - Senão, tira o hífen e cola a palavra na linha i.
  - O que sobra da linha i+1 continua nela. Isso funciona também entre páginas.
- **`paragraphBreaks`:** começa um parágrafo novo quando:
  - a linha anterior termina em `[.:;?!]`;
  - a linha atual casa `STRUCTURAL_MARKER`;
  - ou, na mesma página, `y_i − y_{i−1}` passa de 1,5 × a mediana dos espaçamentos daquela página.
- **`buildCanonicalText`:** junta as linhas com `' '` dentro do parágrafo e `'\n\n'` entre parágrafos. Registra o `[start, end)` de cada linha; o `pageMap` de cada página vai do menor `start` ao maior `end` das linhas dela.
- **Ordem do estágio:**
  1. Checagem de tamanho (`maxFileSizeMb × 1024²` bytes).
  2. `detectFormat` e `extractLines`.
  3. Densidade (só para `pdf`): total de caracteres ÷ páginas abaixo de `minCharsPerPage` dá `LOW_TEXT_DENSITY`.
  4. `normalizeUnicode`, bordas repetidas, numeração de página e boilerplate, cada um conforme seu toggle na config.
  5. Limpeza por LLM, quando não está em `'off'`.
  6. `dehyphenate`.
  7. Quebras de parágrafo; com `rebuildParagraphs: false`, cada linha vira um parágrafo.
  8. Texto canônico.
- **Métricas do relatório:**
  - `charsBefore` = soma dos caracteres das linhas logo após a extração;
  - `charsAfter` = `canonicalText.length`;
  - `stats.words` = número de tokens separados por `/\s+/`;
  - `estimatedTokens` = `countTokens(canonicalText)`.
- Emitir `ctx.events.progress` a cada passo, com rótulos em pt-BR (por exemplo, "Removendo cabeçalhos e rodapés").

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test src/stages/text-extraction`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): assemble immutable canonical text and text_extraction stage"
```

### Task 10: Limpeza por LLM (`cleaner`)

**Files:**
- Create: `packages/pipeline/src/agents/cleaner/{agent,prompt}.ts`, `.../text-extraction/cleaning/llm-cleanup.ts`
- Modify: `.../text-extraction/stage.ts` (ligar o hook)
- Test: `.../cleaning/llm-cleanup.test.ts`

**Interfaces:**
- Consumes: `defineAgent`, `runAgent`, `mapWithConcurrency`, `CleaningResult`.
- Produces:
  - `cleanerAgent` (nome `cleaner`, role `cleaning`, versão `1.0.0`, `maxOutputTokens: 2000`), com entrada `{ lines: { id: number; page: number; text: string }[] }` e saída `{ removeLineIds: number[]; reasons: { id: number; reason: string }[] }`;
  - `applyLlmCleanup(doc: LineDocument, mode: 'edges' | 'full', ctx: StageContext): Promise<CleaningResult>` (regra `llm_cleaner`).

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('edges mode sends only first/last 3 lines of each page', /* mock captura o prompt; IDs do meio da página não aparecem */ () => {});
test('removes returned ids and ignores unknown ids', /* mock devolve [2, 999] → linha 2 removida, nada mais */ () => {});
test('stage makes no LLM call when llmCleanup is off', async () => {
  const ctx = createTestContext(); await textExtractionStage.run(input, ctx); expect(ctx.recorded.llm).toHaveLength(0);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test llm-cleanup`
Expected: FAIL

- [ ] **Step 3: Implementar o agente e `applyLlmCleanup`**

- Lotes de 200 linhas, executados com `mapWithConcurrency(ctx.llmConcurrency)`.
- O prompt (em inglês) manda marcar apenas os elementos de página:
  - cabeçalhos, rodapés e números de página;
  - carimbos de assinatura, marcas d'água e URLs de rodapé;
  - timbre repetido do tribunal.
- O prompt proíbe marcar:
  - texto do corpo;
  - títulos de seção (EMENTA, VOTO);
  - artigos e citações.
- Na dúvida, o modelo deve manter a linha.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test src/stages/text-extraction`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add flag-only llm cleaner with edges and full modes"
```

### Task 11: Corpus (aquisição, manifest e snapshots da Etapa 1)

> **Executar na sessão principal, com o usuário presente.** Cada download exige permissão explícita do usuário. Não delegar a subagente.

**Files:**
- Create: `corpus/manifest.json`, `corpus/README.md`, `corpus/stj/*.pdf`, `corpus/cnj/*.(pdf|html)`
- Create: `packages/shared/src/corpus.ts`
- Create: `packages/pipeline/src/stages/text-extraction/corpus.snapshot.test.ts`
- Modify: `.../cleaning/patterns.ts` e `.../cleaning/cleaning.test.ts` (padrões novos vindos do corpus)

**Interfaces:**
- Produces: `CorpusManifestEntry` (spec §13.1) e `parseCorpusManifest(json: unknown): CorpusManifestEntry[]` em `@app/shared`.

- [ ] **Step 1: Localizar e baixar os 20 documentos**

- Usar o navegador embutido.
- **STJ:** informativo → SCON → PDF do "Inteiro Teor".
- **CNJ:** `https://atos.cnj.jus.br/atos/detalhar/<id>`, com os ids:

| Ato | id |
|---|---|
| Res. 335/2020 | 3496 |
| Res. 401/2021 | 3987 |
| Res. 455/2022 | 4509 |
| Rec. 144/2023 | 5233 |
| Res. 550/2024 | 5509 |
| Res. 560/2024 | 5581 (confirmar) |
| Rec. 154/2024 | 5693 |
| Res. 600/2024 | 5905 |
| Res. 615/2025 | 6001 |
| Res. 674/2026 | 6836 |

- Antes de cada download, informar ao usuário o nome do arquivo, a origem e o tamanho, e esperar a confirmação.
- Versões conforme o spec §13.1: texto compilado para 335, 401, 455 e 615. Para os atos do CNJ, preferir o PDF limpo; se o PDF for um recorte do DJe, salvar o HTML da página.
- Se algum site bloquear o download, pedir ao usuário que baixe aquele arquivo manualmente para o caminho indicado.

- [ ] **Step 2: Nomear os arquivos e escrever o manifest**

- Nomes de arquivo: `stj/resp-1969219-sp.pdf`, `stj/agint-agint-resp-1975502-sp.pdf`, `stj/hc-989426-pr.pdf`, `cnj/res-335-2020.pdf`, `cnj/rec-144-2023.html` e assim por diante.
- Chave de cada entrada: o prefixo da origem mais o nome sem extensão (`stj-resp-1969219-sp`).
- Calcular o `sha256` com `shasum -a 256` e preencher o `manifest.json`.
- No `corpus/README.md`, registrar as fontes e a data de coleta.

- [ ] **Step 3: Escrever o teste de snapshot que falha**

```ts
const manifest = parseCorpusManifest(JSON.parse(readFileSync(CORPUS_MANIFEST, 'utf8')));
test('manifest files exist and match sha256', () => { for (const e of manifest) expect(sha256(readFileSync(path(e))).toBe(e.sha256)); });
test.each(manifest)('stage 1 snapshot: $key', async (e) => {
  const out = await textExtractionStage.run({ buffer: readFileSync(path(e)), filename: e.file }, createTestContext());
  expect(out.canonicalText).toMatchSnapshot();
  for (const set of Object.values(BOILERPLATE_PATTERN_SETS)) for (const re of set)
    expect(out.canonicalText.split('\n').some((l) => re.test(l))).toBe(false);
  if (e.issuer === 'STJ') expect(out.cleaningReport.removedByRule.find((r) => r.rule === 'repeated_edge')?.count ?? 0).toBeGreaterThan(0);
});
```

- [ ] **Step 4: Rodar, inspecionar e refinar**

Run: `pnpm --filter @app/pipeline test corpus.snapshot`

Para cada falha, ou cada snapshot com ruído aparente (cabeçalho, rodapé, carimbo, linhas partidas), ajustar `patterns.ts` ou os parâmetros de limpeza. Cada padrão novo ganha um teste de regressão no `cleaning.test.ts`.

- [ ] **Step 5: Revisar os snapshots à mão**

Ler 3 snapshots do STJ e 3 do CNJ. Não pode haver cabeçalho, rodapé ou numeração, e os parágrafos precisam estar coerentes. Depois, rodar de novo com `-u` para gravar os snapshots.

Run: `pnpm --filter @app/pipeline test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(corpus): add 20-document test corpus, manifest and stage 1 snapshots"
```

---

## Fase 4 — Etapa 2: classificação e extração de informações

### Task 12: Parsers pt-BR

**Files:**
- Create: `packages/pipeline/src/stages/information-extraction/parsers/{numbers,dates,money,durations,value-check}.ts`
- Test: `.../parsers/parsers.test.ts`

**Interfaces:**
- Produces:
  - `parsePtNumberWords(text: string): number | null`, para números de 1 a 999 escritos por extenso;
  - `findDates(text: string): { iso: string; start: number; end: number }[]`;
  - `findMoney(text: string): { amount: number; start: number; end: number }[]`;
  - `findDurations(text: string): { amount: number; unit: 'days'|'months'|'years'; businessDays: boolean|null; start: number; end: number }[]`;
  - `valueAppearsIn(category: FactCategory, value: CategoryValue, quote: string): boolean | null`, que devolve `null` para `obligation`, `decision`, `legal_reference` e `amendment`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test.each([['quinze', 15], ['trinta e cinco', 35], ['cento e vinte', 120], ['cem', 100], ['novecentos e noventa e nove', 999], ['banana', null]])
  ('parsePtNumberWords(%s)', (t, n) => expect(parsePtNumberWords(t)).toBe(n));
test.each([
  ['julgado em 24 de março de 2025', '2025-03-24'], ['em 1º de janeiro de 2025', '2025-01-01'],
  ['DJe 24/03/2025', '2025-03-24'], ['em 24.3.2025', '2025-03-24'], ['em 05/06/25', '2025-06-05'],
])('findDates(%s)', (t, iso) => expect(findDates(t).map((d) => d.iso)).toEqual([iso]));
test('invalid date skipped', () => expect(findDates('31/02/2025')).toEqual([]));
test.each([['R$ 1.234,56', 1234.56], ['R$1234', 1234], ['R$ 10 mil', 10_000], ['R$ 2,5 milhões', 2_500_000], ['R$ 3 bilhões', 3e9]])
  ('findMoney(%s)', (t, n) => expect(findMoney(t)[0]!.amount).toBeCloseTo(n));
test.each([
  ['15 (quinze) dias úteis', { amount: 15, unit: 'days', businessDays: true }],
  ['trinta dias', { amount: 30, unit: 'days', businessDays: null }],
  ['10 dias corridos', { amount: 10, unit: 'days', businessDays: false }],
  ['6 meses', { amount: 6, unit: 'months', businessDays: null }],
  ['cento e vinte dias', { amount: 120, unit: 'days', businessDays: null }],
])('findDurations(%s)', (t, d) => expect(findDurations(t)[0]).toMatchObject(d));
test('valueAppearsIn', () => {
  expect(valueAppearsIn('date', { iso: '2025-03-24', role: 'judgment' }, 'em 24/03/2025')).toBe(true);
  expect(valueAppearsIn('date', { iso: '2025-03-24', role: 'judgment' }, 'em 25/03/2025')).toBe(false);
  expect(valueAppearsIn('deadline', { amount: 15, unit: 'days', businessDays: true, trigger: null }, 'prazo de 15 dias')).toBe(true);
  expect(valueAppearsIn('obligation', obligation, 'qualquer')).toBeNull();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test parsers`
Expected: FAIL

- [ ] **Step 3: Implementar os parsers**

- Datas no formato `DD/MM/YY` são interpretadas como `20YY`.
- Valores monetários são guardados em reais, com precisão de centavos.
- Na comparação de prazos, `businessDays: null` é compatível com qualquer valor.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test parsers`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add pt-BR parsers for dates, money, durations and number words"
```

### Task 13: Ancoragem de citações

**Files:**
- Create: `.../information-extraction/grounding/{normalize,index,ground-quote}.ts`
- Test: `.../grounding/grounding.test.ts`

**Interfaces:**
- Consumes: `PageRange`, `Section`, `MatchType`.
- Produces:
  - `normalizeWithMap(text: string): { normalized: string; map: number[] }`, em que `map[i]` é a posição no texto original do caractere normalizado `i` (com `map.length === normalized.length + 1`);
  - `GroundingIndex` e `buildGroundingIndex(canonicalText: string, pageMap: PageRange[], sections: Section[]): GroundingIndex`;
  - `GroundingMatch { start: number|null; end: number|null; page: number|null; sectionId: string|null; matchType: MatchType; matchScore: number|null }`;
  - `groundQuote(quote: string, index: GroundingIndex, fuzzyThreshold: number): GroundingMatch`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
const text = 'O Tribunal  negou\nprovimento ao recurso especial interposto pela União.';
const idx = buildGroundingIndex(text, [{ page: 1, start: 0, end: text.length }], []);
test('exact ignoring case and whitespace', () => {
  const m = groundQuote('tribunal negou provimento', idx, 0.9);
  expect(m.matchType).toBe('exact'); expect(text.slice(m.start!, m.end!)).toBe('Tribunal  negou\nprovimento'); expect(m.page).toBe(1);
});
test('curly quotes normalized', /* “negou” acha "negou" */ () => {});
test('fuzzy with a typo', () => {
  const m = groundQuote('negou provimeto ao recurso especial', idx, 0.9);
  expect(m.matchType).toBe('fuzzy'); expect(m.matchScore!).toBeGreaterThanOrEqual(0.9); expect(m.matchScore!).toBeLessThan(1);
});
test('not found', () => expect(groundQuote('deu provimento à apelação do município', idx, 0.9).matchType).toBe('not_found'));
test('ellipsis segments grounded in order (Review Focus 1)', () => {
  const m = groundQuote('O Tribunal [...] interposto pela União', idx, 0.9);
  expect(m.matchType).toBe('exact'); expect(text.slice(m.start!, m.end!)).toBe('O Tribunal  negou\nprovimento ao recurso especial interposto pela União');
  expect(groundQuote('O Tribunal ... pelo Estado', idx, 0.9).matchType).toBe('not_found');
});
test('section lookup', /* seção [0, 20) → sectionId preenchido */ () => {});
test('performance guard', /* texto de 50k caracteres e 100 citações → menos de 500 ms */ () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test grounding`
Expected: FAIL

- [ ] **Step 3: Implementar a ancoragem**

O algoritmo é este; os testes não o determinam sozinhos:

```
normalize: minúsculas; aspas e apóstrofos curvos → retos; – e — → -; qualquer sequência de espaço em branco → ' '.
index: texto normalizado + map + Map<trigrama de palavras, posições de início no texto normalizado>.
groundQuote:
  1. segments = quote dividida em /\s*(\[\s*(\.{3}|…)\s*\]|\(\s*(\.{3}|…)\s*\)|\.{3}|…)\s*/, sem os vazios
  2. from = 0; para cada segmento, em ordem:
       n = normalize(segment)
       exato: pos = normalized.indexOf(n, from) → span [pos, pos + n.length), score 1
       senão, se o segmento tem ≥ 3 palavras → fuzzy:
         para cada trigrama do segmento (deslocamento k dentro de n), para cada posição p ≥ from no índice:
           para cada len em {n.length, round(0.9 * n.length), round(1.1 * n.length)}:
             w = normalized.slice(p - k, p - k + len)
             score = 1 - levenshtein(w, n) / max(w.length, n.length)
         melhor score ≥ fuzzyThreshold → span
       se não achou → devolve not_found (todos os campos posicionais null, score null)
       from = fim do span
  3. start = map[início do 1º span]; end = map[fim do último span];
     matchType = todos exatos ? 'exact' : 'fuzzy'; matchScore = menor score entre os segmentos
  4. page = entrada do pageMap que contém start; sectionId = seção que contém start, ou null
  5. com várias ocorrências, vence a primeira (comportamento determinístico)
```

`levenshtein` vem de `fastest-levenshtein`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test grounding`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add quote grounding with exact, fuzzy and ellipsis-aware matching"
```

### Task 14: Classificação e segmentação

**Files:**
- Create: `packages/pipeline/src/agents/classifier/{agent,prompt}.ts`, `.../information-extraction/classify.ts`, `.../information-extraction/segment/{court-decision,normative-act,generic,index}.ts`
- Test: `.../information-extraction/classify.test.ts`, `.../segment/segment.test.ts`

**Interfaces:**
- Consumes: `runAgent`, `headTokens`, `tailTokens`, `countTokens`, `Classification`, `Section`.
- Produces:
  - `classifierAgent` (nome `classifier`, role `classification`, versão `1.0.0`, `maxOutputTokens: 800`), com entrada `{ head: string; tail: string; forcedType: DocumentType | null }` e saída `Classification`;
  - `classifyDocument(text: TextExtractionOutput, ctx: StageContext): Promise<Classification>`;
  - `segmentDocument(canonicalText: string, type: DocumentType): { sections: Section[]; fallback: boolean }`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
const acordao = ['RECURSO ESPECIAL Nº 1.969.219 - SP', 'EMENTA', 'Direito civil...', 'ACÓRDÃO', 'Vistos...', 'RELATÓRIO', 'Trata-se...',
  'VOTO', 'O recurso merece...', 'Ante o exposto, nego provimento ao recurso especial.', 'CERTIDÃO DE JULGAMENTO', 'Certifico...'].join('\n\n');
test('court decision sections are ordered and contiguous', () => {
  const { sections, fallback } = segmentDocument(acordao, 'court_decision');
  expect(fallback).toBe(false);
  expect(sections.map((s) => s.kind)).toEqual(['preamble', 'headnote', 'judgment', 'report', 'vote', 'operative_part', 'judgment_certificate']);
  for (let i = 1; i < sections.length; i++) expect(sections[i]!.start).toBeGreaterThanOrEqual(sections[i - 1]!.end);
});
test('normative act sections with chapter as parentLabel', () => {
  const ato = ['RESOLUÇÃO Nº 615, DE 11 DE MARÇO DE 2025', 'CONSIDERANDO a ...', 'CONSIDERANDO o ...', 'RESOLVE:', 'CAPÍTULO I', 'Art. 1º Esta Resolução...', 'Art. 2º Para fins...', 'ANEXO I', 'Tabela...'].join('\n\n');
  const { sections } = segmentDocument(ato, 'normative_act');
  expect(sections.map((s) => s.kind)).toEqual(['preamble', 'recitals', 'article', 'article', 'annex']);
  expect(sections[3]).toMatchObject({ label: 'Art. 2º', parentLabel: 'CAPÍTULO I' });
});
test('fallback to generic paragraphs', () => {
  const r = segmentDocument('Primeiro parágrafo.\n\nSegundo parágrafo.', 'court_decision');
  expect(r.fallback).toBe(true); expect(r.sections.map((s) => s.kind)).toEqual(['paragraph', 'paragraph']);
});
test('forced type overrides model output and low confidence warns', async () => {
  const ctx = ctxWithMock({ documentType: 'generic', subtype: null, confidence: 'low', rationale: 'x', metadata: nullMeta });
  ctx.config.classification.mode = 'normative_act';
  expect((await classifyDocument(textOutput, ctx)).documentType).toBe('normative_act');
  expect(ctx.emitted.warnings.map((w) => w.code)).toContain('classification_low_confidence');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test classify segment`
Expected: FAIL

- [ ] **Step 3: Implementar a classificação e a segmentação**

- **Entrada do classificador:**
  - `head = headTokens(text, 4000)`;
  - `tail = tailTokens(text, 1000)` quando o texto passa de 5.000 tokens; senão, `''`.
- **Segmentação** (a unidade é o parágrafo do texto canônico, separado por `\n\n`):
  - **`court_decision`:** parágrafos que são exatamente um marcador em maiúsculas.
    - `EMENTA` → `headnote`; `ACÓRDÃO` → `judgment`; `RELATÓRIO` → `report`.
    - `VOTO`, `VOTO-VISTA` e `VOTO VENCIDO` → `vote`.
    - `CERTIDÃO DE JULGAMENTO` → `judgment_certificate`.
    - Texto antes do primeiro marcador → `preamble`.
    - `operative_part` começa, dentro do **primeiro** voto, no último parágrafo que casa `/^(Ante o exposto|Diante do exposto|Pelo exposto|Em face do exposto|Isso posto|Com essas considerações)/`, e vai até o fim desse voto. O voto termina onde o dispositivo começa.
    - Fallback quando não há nem `EMENTA` nem `VOTO`.
  - **`normative_act`:**
    - parágrafos `CONSIDERANDO` contíguos → um `recitals`;
    - cada `Art. N` → `article` (rótulo `Art. Nº`, `parentLabel` = último `CAPÍTULO ...` visto);
    - `ANEXO ...` → `annex`, até o próximo anexo ou o fim;
    - o que vem antes, incluindo `RESOLVE:`, → `preamble`;
    - parágrafos de `CAPÍTULO` entram no artigo seguinte;
    - fallback quando não há nenhum artigo.
  - **`generic`:** um `paragraph` por parágrafo.
- **Seções:**
  - IDs `S01`, `S02`...;
  - rótulos em pt-BR: `Ementa`, `Acórdão`, `Relatório`, `Voto`, `Dispositivo`, `Certidão de julgamento`, `Preâmbulo`, `Considerandos`, `Art. 5º`, `Anexo I`, `Parágrafo 3`;
  - as seções não se sobrepõem.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test classify segment`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add document classifier and type-aware deterministic segmentation"
```

### Task 15: Extratores e estratégias

**Files:**
- Create: `packages/pipeline/src/agents/extractor/{base-prompt,court-decision,normative-act,generic,index}.ts`, `.../information-extraction/extract/{chunk-sections,call-extractors,merge}.ts`
- Test: `.../extract/{chunk-sections,call-extractors,merge}.test.ts`

**Interfaces:**
- Consumes: `runAgent`, `mapWithConcurrency`, `countTokens`, `ExtractorOutput`, `GroundedFactDraft`, `Section`, `Classification`.
- Produces:
  - `createExtractorAgent(type: DocumentType): AgentDefinition`, com nomes `extractor.court-decision`, `extractor.normative-act` e `extractor.generic` (role `extraction`, versão `1.0.0`, `maxOutputTokens: 8000`), entrada `{ documentType; subtype: DocumentSubtype|null; text: string; sections: { id: string; kind: SectionKind; label: string }[]; categories: FactCategory[] }` e saída `ExtractorOutput`;
  - `TextChunk { start: number; end: number; text: string }` e `chunkBySections(text: string, sections: Section[], chunkTokens: number, overlapTokens: number): TextChunk[]`;
  - `CATEGORY_GROUPS: FactCategory[][] = [['date','deadline'],['monetary_value'],['obligation'],['decision'],['legal_reference'],['amendment']]`;
  - `callExtractors(input: { text: string; sections: Section[]; classification: Classification }, ctx: StageContext): Promise<{ outputs: { chunk: TextChunk; output: ExtractorOutput }[]; strategyUsed: 'single_pass' | 'chunked' }>`;
  - `GroundedExtractorOutput { facts: GroundedFactDraft[]; notFound: FactCategory[]; ambiguities: { description: string; quote: string; match: GroundingMatch }[] }`;
  - `valueKey(category: FactCategory, value: CategoryValue): string`;
  - `mergeFacts(outputs: GroundedExtractorOutput[]): GroundedExtractorOutput`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('chunkBySections packs sections and overlaps', () => {
  const chunks = chunkBySections(longText, sectionsOf(longText), 1000, 100);
  expect(chunks.length).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.start).toBeLessThan(chunks[i - 1]!.end);
  expect(chunks[0]!.start).toBe(0); expect(chunks.at(-1)!.end).toBe(longText.length);
});
test('single_pass unified → one call', /* contagem de chamadas no mock = 1 */ () => {});
test('per_category → one call per non-empty group', /* categories [date, deadline, decision] → 2 chamadas */ () => {});
test('auto-chunks above maxSinglePassTokens and warns', /* maxSinglePassTokens: 50 → strategyUsed chunked, aviso extraction_auto_chunked */ () => {});
test('amendment subtype adds amendment category', /* prompt do mock contém 'amendment' */ () => {});
test('mergeFacts dedupes by value and overlapping evidence', () => {
  const m = mergeFacts([out([deadlineAt(10, 30, 'medium', 'q1')]), out([deadlineAt(12, 30, 'high', 'q2')])]);
  expect(m.facts).toHaveLength(1); expect(m.facts[0]!.confidence).toBe('high'); expect(m.facts[0]!.evidence).toHaveLength(2);
});
test('mergeFacts keeps different values and reassigns ids in text order', /* fatos em 50 e 10 → F01 é o de 10 */ () => {});
test('notFound = categories absent in every output and with no merged facts', /* ... */ () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test extract`
Expected: FAIL

- [ ] **Step 3: Implementar os extratores, os chunks e a junção**

- **Prompts:** as regras do spec §6.2c ficam em `base-prompt.ts`. A orientação específica de cada tipo:
  - **`court_decision`:** o resultado vem do dispositivo e da certidão; a data de julgamento usa o role `judgment`; relator e partes não são fatos.
  - **`normative_act`:**
    - obrigações com `bearer` explícito (por exemplo, "os tribunais");
    - prazos de implementação;
    - vigência como data com role `effective`;
    - revogações como `legal_reference` com `citation` começando por "revoga".
  - **`amendment`:** um fato por dispositivo alterado.
- **`chunkBySections`:**
  - agrupa seções consecutivas até `chunkTokens`;
  - uma seção maior que isso é dividida por parágrafo, e um parágrafo maior é dividido por tokens;
  - cada chunk depois do primeiro começa `overlapTokens` tokens antes do fim do anterior.
- **`callExtractors`:**
  - usa `chunked` quando a config pede ou quando `countTokens(text) > maxSinglePassTokens`; neste segundo caso, emite o aviso `extraction_auto_chunked`;
  - as categorias são as da config, mais `amendment` se o subtipo for `amendment`;
  - com `per_category`, faz uma chamada por grupo de `CATEGORY_GROUPS` que tenha alguma categoria pedida;
  - total de chamadas = chunks × grupos, executadas com `mapWithConcurrency`;
  - progresso: "Extraindo fatos: chamada i/N".
- **`valueKey`:**
  - `date` → iso + role;
  - `deadline` → amount + unit + businessDays;
  - `monetary_value` → amount com 2 casas;
  - `legal_reference` → citation em minúsculas e sem espaços;
  - `obligation` → bearer + action normalizados;
  - `decision` → outcome;
  - `amendment` → targetProvision + changeType.
- **`mergeFacts`:**
  - dois fatos são o mesmo quando têm a mesma categoria, o mesmo `valueKey` e algum span de evidência sobreposto (ou, se os dois não foram ancorados, a mesma citação normalizada);
  - no fato unido, as evidências são as citações únicas e a confiança é a maior;
  - IDs `F01`, `F02`... reatribuídos pelo menor `start` de evidência, com os fatos sem âncora por último;
  - ambiguidades sem duplicatas (comparando a citação normalizada).

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test extract`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add type-specific extractors, chunking strategies and fact merging"
```

### Task 16: Pós-processamento dos fatos e estágio `information_extraction`

**Files:**
- Create: `.../information-extraction/{postprocess,stage}.ts`
- Test: `.../information-extraction/{postprocess,stage}.test.ts`

**Interfaces:**
- Consumes: Tasks 12 a 15.
- Produces:
  - `finalizeFacts(merged: GroundedExtractorOutput, minConfidence: Confidence): Fact[]`;
  - `InformationExtractionInput { text: TextExtractionOutput }`;
  - `informationExtractionStage: Stage<InformationExtractionInput, InformationExtractionOutput>`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test.each([
  ['anchored, value ok, high', fact({ anchored: true, quote: 'em 24/03/2025', iso: '2025-03-24', confidence: 'high' }), []],
  ['no evidence anchored', fact({ anchored: false }), ['quote_not_found']],
  ['value mismatch', fact({ anchored: true, quote: 'em 25/03/2025', iso: '2025-03-24' }), ['value_mismatch']],
  ['low confidence', fact({ anchored: true, confidence: 'low' }), ['low_confidence']],
  ['overlaps ambiguity', fact({ anchored: true, start: 10, end: 30, ambiguityAt: [20, 40] }), ['ambiguous']],
  ['obligation has no parser', obligationFact({ anchored: true }), []],
])('%s', (_, merged, reasons) => {
  const [f] = finalizeFacts(merged, 'medium');
  expect(f!.uncertaintyReasons).toEqual(reasons); expect(f!.status).toBe(reasons.length ? 'uncertain' : 'confirmed');
});
test('stage end-to-end with mocks flags invented quote', async () => {
  const out = await informationExtractionStage.run({ text: acordaoTextOutput }, ctxWithMocks({ classifier: courtDecision, extractor: threeFactsOneInvented }));
  expect(out.facts).toHaveLength(3);
  expect(out.facts.filter((f) => f.uncertaintyReasons.includes('quote_not_found'))).toHaveLength(1);
  expect(out.sections.length).toBeGreaterThan(0); expect(out.classification.documentType).toBe('court_decision');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test information-extraction`
Expected: FAIL

- [ ] **Step 3: Implementar `finalizeFacts` e o estágio**

- **Regras de `finalizeFacts`:**
  - `quote_not_found` só quando **nenhuma** evidência foi ancorada;
  - `value_mismatch` quando `valueAppearsIn` devolve `false` para todas as evidências ancoradas;
  - `low_confidence` quando `confidenceRank` fica abaixo do mínimo;
  - `ambiguous` quando o span de alguma ambiguidade ancorada se sobrepõe a um span de evidência.
- **Ordem do estágio:**
  1. `classifyDocument`.
  2. `segmentDocument`; com fallback, aviso `segmentation_fallback`.
  3. `callExtractors`.
  4. `buildGroundingIndex` uma única vez, e `groundQuote` para cada evidência e cada ambiguidade, com `extraction.grounding.fuzzyThreshold`.
  5. `mergeFacts`.
  6. `finalizeFacts`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): finalize facts with uncertainty flags and information_extraction stage"
```

---

## Fase 5 — Etapa 3: resumo

### Task 17: Legibilidade e compressão

**Files:**
- Create: `packages/pipeline/src/stages/summarization/readability.ts`
- Test: `.../summarization/readability.test.ts`

**Interfaces:**
- Produces:
  - `countSyllablesPt(word: string): number`;
  - `splitSentences(text: string): string[]`;
  - `fleschPt(text: string): number`;
  - `compressionRatio(sourceWords: number, summaryWords: number): number`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test.each([['casa', 2], ['jurídico', 4], ['pão', 1], ['Judiciário', 4]])('syllables %s', (w, n) => expect(countSyllablesPt(w)).toBe(n));
test('abbreviations do not split sentences', () =>
  expect(splitSentences('Conforme o art. 5º, o pedido foi negado. O Min. Relator votou.')).toHaveLength(2));
test('simpler text scores higher', () =>
  expect(fleschPt('O juiz negou o pedido.')).toBeGreaterThan(fleschPt('A jurisprudência consolidada desta Corte Superior estabelece a imprescindibilidade da demonstração inequívoca do prejuízo processual.')));
test('empty text', () => expect(fleschPt('')).toBe(0));
test('compression', () => { expect(compressionRatio(1000, 250)).toBe(4); expect(compressionRatio(1000, 0)).toBe(0); });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test readability`
Expected: FAIL

- [ ] **Step 3: Implementar**

- **Sílabas:** número de grupos de vogais consecutivas em `[aeiouáéíóúâêôãõàü]`, com mínimo de 1. É uma heurística e deve estar documentada como tal num comentário.
- **Frases:** divide após `[.!?]+` seguido de espaço ou fim de texto. Não divide depois de `art.`, `arts.`, `nº.`, `inc.`, `p.`, `fls.`, `min.`, `rel.`, `dr.`, `sr.`, `sra.`, `n.`, `ltda.` (sem diferenciar maiúsculas).
- **Flesch:** fórmula do spec §6.3.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test readability`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add portuguese flesch readability and compression metrics"
```

### Task 18: `summarizer` e estágio `summarization`

**Files:**
- Create: `packages/pipeline/src/agents/summarizer/{agent,prompt,headings}.ts`, `.../summarization/stage.ts`
- Test: `.../summarization/stage.test.ts`, `.../agents/summarizer/headings.test.ts`

**Interfaces:**
- Consumes: `runAgent`, `chunkBySections`, `countTokens`, `fleschPt`, `compressionRatio`, `Summary`, `Fact`.
- Produces:
  - `SECTION_HEADINGS: Record<'court_decision'|'normative_act'|'generic', string[]>` e `AMENDMENT_HEADING = 'O que mudou'`, com os textos exatos do spec §6.3;
  - `headingsFor(type: DocumentType, subtype: DocumentSubtype | null): string[]`;
  - `TARGET_WORDS = { short: 150, medium: 350, long: 700 }`;
  - `summarizerAgent` (nome `summarizer`, role `summarization`, versão `1.0.0`, `maxOutputTokens: 4000`), com entrada `{ documentType; subtype; metadata: Classification['metadata']; text: string; facts: { id: string; category: FactCategory; label: string; value: CategoryValue; status: FactStatus }[]; headings: string[]; audience: 'layperson'|'professional'; targetWords: number; uncertainFacts: 'omit'|'hedge'; includeGlossary: boolean }` e saída `Summary`;
  - `summaryPlainText(summary: Summary): string` (overview e parágrafos, separados por `\n\n`);
  - `SummarizationInput { text: TextExtractionOutput; info: InformationExtractionOutput }`;
  - `summarizationStage: Stage<SummarizationInput, SummarizationOutput>`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('amendment headings', () =>
  expect(headingsFor('normative_act', 'amendment')).toEqual(['O que mudou', 'Do que trata', 'Quem precisa cumprir', 'O que deve ser feito', 'Prazos e vigência']));
test('omit mode hides uncertain facts from the prompt', /* o prompt capturado não contém o id do fato incerto */ () => {});
test('unknown factRefs are dropped with a warning', /* mock usa 'F99' → removido, aviso summary_unknown_fact_refs */ () => {});
test('hierarchical when text exceeds maxDirectTokens', /* maxDirectTokens pequeno → mock chamado (chunks + 1) vezes, aviso summarization_auto_hierarchical */ () => {});
test('useExtractedFacts false sends no facts', () => {});
test('includeGlossary false empties glossary', () => {});
test('output has readability and compression', async () => {
  const out = await summarizationStage.run(input, ctx);
  expect(out.readability.summary).toBeTypeOf('number'); expect(out.compressionRatio).toBeGreaterThan(1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test summar`
Expected: FAIL

- [ ] **Step 3: Implementar o agente e o estágio**

- **Prompt** (em inglês):
  - escrever em linguagem simples seguindo a Recomendação CNJ 144/2023: frases curtas, voz ativa e jargão explicado ou levado ao glossário;
  - usar só a fonte; não dar opinião nem orientação;
  - copiar datas, valores e prazos exatamente como nos fatos;
  - citar em `factRefs` os IDs usados em cada parágrafo;
  - com `hedge`, mencionar fatos incertos com a ressalva explícita "o documento não deixa claro...";
  - `professional` mantém os termos técnicos com uma explicação breve.
- **Estratégia `hierarchical`:**
  - `chunkBySections` com `chunkTokens = floor(maxDirectTokens / 4)`;
  - um resumo por chunk, usando o próprio `summarizerAgent`;
  - uma chamada final com `text` = concatenação de `summaryPlainText` dos resumos parciais.
- **`readability`:** `fleschPt(canonicalText)` e `fleschPt(summaryPlainText)`.
- **Compressão:** conta as palavras do original e do resumo.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add plain-language summarizer with direct and hierarchical strategies"
```

---

## Fase 6 — Etapa 4: similaridade

### Task 19: Segmentação para embeddings e métricas

**Files:**
- Create: `packages/pipeline/src/stages/similarity/{chunking,metrics}.ts`, `packages/pipeline/src/testing/fake-embedder.ts`
- Test: `.../similarity/{chunking,metrics}.test.ts`

**Interfaces:**
- Consumes: `chunkBySections`, `countTokens`, `Summary`, `Chunk`, `SummaryChunk`, `SimilarityMetrics`.
- Produces:
  - `chunkSource(text: string, sections: Section[], opts: { method: 'structural'|'fixed'; maxTokens: number; overlapTokens: number }): Chunk[]` (IDs `C001`, `C002`...);
  - `chunkSummary(summary: Summary): SummaryChunk[]` (o overview é `P00` com refs `null`; os parágrafos seguem como `P01`, `P02`...);
  - `normalizeVector(v: number[]): number[]`, `dot(a: number[], b: number[]): number`, `meanVector(vs: number[][]): number[]`;
  - `computeAlignment(source: { vector: number[]; tokens: number }[], summary: number[][]): { metrics: SimilarityMetrics; coverageScores: number[]; supportScores: number[] }` (os vetores de entrada já vêm normalizados);
  - `markBottomPercent(scores: number[], percent: number): boolean[]`;
  - no subpath `testing`: `createFakeEmbedder(dims = 32): Embedder`, determinístico (bag-of-words com hash nas dimensões e normalização L2) e que registra as chamadas.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('identical → 1, orthogonal → 0', () => {
  expect(computeAlignment([{ vector: [1, 0], tokens: 1 }], [[1, 0]]).metrics).toEqual({ centroid: 1, coverage: 1, support: 1, alignmentF1: 1 });
  expect(computeAlignment([{ vector: [1, 0], tokens: 1 }], [[0, 1]]).metrics.alignmentF1).toBe(0);
});
test('coverage weighted by tokens', () =>
  expect(computeAlignment([{ vector: [1, 0], tokens: 3 }, { vector: [0, 1], tokens: 1 }], [[1, 0]]).metrics.coverage).toBeCloseTo(0.75));
test('alignmentF1 is harmonic mean', /* coverage 0.5, support 1 → 0.6667 */ () => {});
test('markBottomPercent', () => {
  expect(markBottomPercent([0.9, 0.1, 0.5, 0.3, 0.7], 40)).toEqual([false, true, false, true, false]);
  expect(markBottomPercent([0.9, 0.1, 0.5, 0.3], 20)).toEqual([false, false, false, false]);
});
test('fixed chunking covers the whole text', /* chunks em ordem: o primeiro começa em 0, o último termina em text.length, sem buracos */ () => {});
test('chunkSummary ids and refs', /* overview → P00 com sectionIndex null; o 2º parágrafo da seção 0 → paragraphIndex 1 */ () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test similarity`
Expected: FAIL

- [ ] **Step 3: Implementar**

- **Chunking `fixed`:** janelas de `maxTokens` tokens com passo `maxTokens − overlapTokens`. As fronteiras de token viram posições de caractere decodificando incrementalmente com `gpt-tokenizer`.
- **`markBottomPercent`:** marca os `floor(n × percent / 100)` menores scores; em empate, vence o menor índice.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test similarity`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add embedding chunking strategies and alignment similarity metrics"
```

### Task 20: Estágio `similarity`

**Files:**
- Create: `.../similarity/stage.ts`
- Test: `.../similarity/stage.test.ts`

**Interfaces:**
- Consumes: Task 19 e `summaryPlainText`.
- Produces:
  - `SimilarityInput { text: TextExtractionOutput; info: InformationExtractionOutput; summarization: SummarizationOutput }`;
  - `similarityStage: Stage<SimilarityInput, SimilarityOutput>`;
  - `HEADLINE_FIELD: Record<SimilarityHeadline, keyof SimilarityMetrics>`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('summary equal to source scores ~1', async () => {
  const out = await similarityStage.run(inputWhereSummaryRepeatsSource, createTestContext({ embedder: createFakeEmbedder() }));
  expect(out.metrics.alignmentF1).toBeGreaterThan(0.95);
});
test('embedder called with configured model and dimensions', /* a chamada registrada tem model text-embedding-3-small e dimensions null */ () => {});
test('headline follows config', /* headline 'centroid' → out.headline.metric === 'centroid' */ () => {});
test('highlight flags follow highlightBottomPercent', () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test similarity/stage`
Expected: FAIL

- [ ] **Step 3: Implementar o estágio**

1. `chunkSource` com as seções da Etapa 2 e `chunkSummary`.
2. Uma chamada `ctx.embedder.embed` para os textos da fonte (`canonicalText.slice(start, end)`) e outra para os textos do resumo.
3. `normalizeVector` em todos os vetores.
4. `computeAlignment`.
5. Monta `coverageByChunk` e `supportByParagraph` com `markBottomPercent(highlightBottomPercent)`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add similarity stage with coverage heatmap and paragraph support"
```

---

## Fase 7 — Etapas 5 e 6: verificação e relatório

### Task 21: Afirmações, pareamento e comparação por código

**Files:**
- Create: `packages/pipeline/src/agents/claim-extractor/{agent,prompt}.ts`, `.../verification/{claims,compare,pairing}.ts`
- Test: `.../verification/{claims,compare,pairing}.test.ts`

**Interfaces:**
- Consumes: `runAgent`, parsers da Task 12, `Claim`, `ClaimDraft`, `Fact`, `Summary`, `Chunk`.
- Produces:
  - `claimExtractorAgent` (nome `claim-extractor`, role `claimExtraction`, versão `1.0.0`, `maxOutputTokens: 4000`), com entrada `{ paragraphs: { index: number; text: string }[] }` e saída `{ claims: ClaimDraft[] }`;
  - `extractClaims(summary: Summary, ctx: StageContext): Promise<Claim[]>` (IDs `A01`, `A02`...; `untyped` vira `category: null`; `paragraphIndexInInput` é convertido em `paragraphRef`, que é `null` para o overview);
  - `retypeClaimValue(claim: Claim): Claim`;
  - `normalizeCitation(citation: string): string`;
  - `compareValues(category: FactCategory, a: CategoryValue, b: CategoryValue): 'equal' | 'different' | 'incomparable'`;
  - `Retrieved { chunkId: string; start: number; end: number; score: number }`;
  - `Pairing { claim: Claim; candidateFacts: Fact[]; chunks: Retrieved[] }`;
  - `pairClaims(claims: Claim[], facts: Fact[], summary: Summary, retrieve: (texts: string[]) => Promise<Retrieved[][]>, topK: number): Promise<Pairing[]>`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('retype fixes LLM-normalized money and dates (Review Focus 2)', () => {
  const c = retypeClaimValue(claim({ text: 'A indenização é de R$ 10 mil.', category: 'monetary_value', value: { amount: 10, currency: 'BRL', role: 'indenização' } }));
  expect(c.value).toMatchObject({ amount: 10_000 });
  expect(compareValues('monetary_value', c.value!, { amount: 10_000, currency: 'BRL', role: 'x' })).toBe('equal');
  const d = retypeClaimValue(claim({ text: 'O julgamento foi em 24 de março de 2025.', category: 'date', value: { iso: '2025-03-25', role: 'judgment' } }));
  expect(compareValues('date', d.value!, { iso: '2025-03-24', role: 'judgment' })).toBe('equal');
});
test('retype leaves value when parser finds zero or several entities', () => {});
test.each([
  ['date', { iso: '2025-03-24', role: 'judgment' }, { iso: '2025-03-24', role: 'publication' }, 'equal'],
  ['deadline', dl(15, 'days', true), dl(15, 'days', null), 'equal'],
  ['deadline', dl(15, 'days', true), dl(15, 'days', false), 'different'],
  ['legal_reference', ref('Lei nº 13.105/2015, art. 942'), ref('Lei 13.105/2015, art. 942'), 'equal'],
  ['legal_reference', ref('art. 942 do Código de Processo Civil'), ref('art. 942 do CPC'), 'equal'],
  ['obligation', obl('a'), obl('b'), 'incomparable'],
])('compareValues %s', (cat, a, b, r) => expect(compareValues(cat as FactCategory, a, b)).toBe(r));
test('pairing order: factRefs first, then same-category compatible, deduped; chunks attached', () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test verification`
Expected: FAIL

- [ ] **Step 3: Implementar**

- **`retypeClaimValue`:** para `date`, `monetary_value` e `deadline`, quando o parser encontra **exatamente uma** entidade no texto da afirmação, o valor dela substitui o valor que veio do LLM. Os campos não numéricos, como `role` e `trigger`, são mantidos.
- **`normalizeCitation`:**
  - minúsculas;
  - troca de sinônimos: "código de processo civil" → "cpc", "constituição federal" → "cf", "lei complementar" → "lc", "código civil" → "cc";
  - remove `nº`, `n.`, `º`, `°`, pontuação e espaços.
- **`pairClaims`:** os candidatos de cada afirmação, em ordem e sem duplicatas, são:
  1. os fatos citados nos `factRefs` do parágrafo de origem;
  2. fatos da mesma categoria com `compareValues` diferente de `'different'`.

  Os chunks vêm de `retrieve(claimTexts)`, com os `topK` primeiros.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test verification`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add claim extraction, deterministic value comparison and pairing"
```

### Task 22: `verifier`, alertas e estágio `verification`

**Files:**
- Create: `packages/pipeline/src/agents/verifier/{agent,prompt}.ts`, `.../verification/{items,severity,alerts,metrics,stage}.ts`
- Test: `.../verification/{severity,metrics,items,stage}.test.ts`

**Interfaces:**
- Consumes: Task 21, `mapWithConcurrency`, `normalizeVector`, `dot`, `summaryPlainText`, `chunkSource` (os chunks vêm da saída da Etapa 4).
- Produces:
  - `VerifierItemInput { itemId: string; direction: Direction; subject: string; summaryText: string|null; sourceExcerpts: string[] }`;
  - `verifierAgent` (nome `verifier`, role `verification`, versão `1.0.0`, `maxOutputTokens: 6000`), com entrada `{ items: VerifierItemInput[] }` e saída `{ verdicts: { itemId: string; verdict: Verdict; explanation: string; usedQuotes: string[] }[] }`;
  - `renderFact(fact: Fact): string` (rótulo e valor em pt-BR, usado como `subject`);
  - `buildItems(args: { facts: Fact[]; claims: Claim[]; pairings: Pairing[]; summary: Summary; text: string; chunks: Chunk[]; deterministicFirst: boolean }): { decided: VerificationItem[]; pending: VerifierItemInput[] }`;
  - `SeverityContext { category: FactCategory|null; hasTypedValue: boolean; isAmendmentDoc: boolean; critical: FactCategory[] }`;
  - `severityFor(item: VerificationItem, ctx: SeverityContext): Severity | null` (`null` significa "sem alerta");
  - `buildAlerts(items: VerificationItem[], facts: Fact[], claims: Claim[], opts: { critical: FactCategory[]; isAmendmentDoc: boolean }): Alert[]`;
  - `computeVerificationMetrics(items: VerificationItem[], facts: Fact[], critical: FactCategory[]): VerificationOutput['metrics']`;
  - `VerificationInput { text: TextExtractionOutput; info: InformationExtractionOutput; summarization: SummarizationOutput; similarity: SimilarityOutput }`;
  - `verificationStage: Stage<VerificationInput, VerificationOutput>`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
const crit = ['decision', 'deadline', 'monetary_value', 'obligation'] as FactCategory[];
test.each([
  ['divergent decision', item('source_to_summary', 'divergent'), sc('decision'), 'high'],
  ['divergent date', item('source_to_summary', 'divergent'), sc('date'), 'medium'],
  ['omitted decision', item('source_to_summary', 'omitted'), sc('decision'), 'high'],
  ['omitted deadline', item('source_to_summary', 'omitted'), sc('deadline'), 'medium'],
  ['omitted legal_reference → no alert', item('source_to_summary', 'omitted'), sc('legal_reference'), null],
  ['omitted amendment in amendment doc', item('source_to_summary', 'omitted'), { ...sc('amendment'), isAmendmentDoc: true }, 'medium'],
  ['unsupported typed', item('summary_to_source', 'unsupported'), { ...sc('deadline'), hasTypedValue: true }, 'high'],
  ['unsupported untyped', item('summary_to_source', 'unsupported'), sc(null), 'medium'],
  ['unverifiable critical fact', item('source_to_summary', 'unverifiable'), sc('deadline'), 'low'],
  ['unverifiable non-critical fact → no alert', item('source_to_summary', 'unverifiable'), sc('date'), null],
  ['unverifiable claim', item('summary_to_source', 'unverifiable'), sc(null), 'low'],
  ['consistent → no alert', item('source_to_summary', 'consistent'), sc('deadline'), null],
])('severity: %s', (_, it, ctx, sev) => expect(severityFor(it, { critical: crit, isAmendmentDoc: false, hasTypedValue: false, ...ctx })).toBe(sev));
test('zero denominators give null, never NaN (Review Focus 3)', () =>
  expect(computeVerificationMetrics([], [], crit)).toEqual({ factualConsistency: null, claimSupport: null, unverifiableCount: 0 }));
test('uncertain fact decided by code as unverifiable', () => {
  const { decided, pending } = buildItems({ ...base, facts: [uncertainDeadline] });
  expect(decided[0]).toMatchObject({ verdict: 'unverifiable', decidedBy: 'code' }); expect(pending).toHaveLength(0);
});
test('equal typed values decided by code', /* afirmação e fato com o mesmo prazo → consistent e supported decididos por código; nada pendente para o verificador */ () => {});
test('invalid verdict for direction becomes unverifiable with warning', /* o mock devolve 'supported' para um item source_to_summary */ () => {});
test('missing verdict becomes unverifiable', () => {});
test('directions config limits items', /* directions: ['summary_to_source'] → nenhum item source_to_summary e factualConsistency null */ () => {});
test('stage: wrong deadline in summary yields high divergence alert', async () => {
  const out = await verificationStage.run(inputWithWrongDeadline, ctxWithMocks({ claimExtractor: deadlineClaim30, verifier: divergentVerdict }));
  expect(out.alerts).toContainEqual(expect.objectContaining({ type: 'divergence', severity: 'high', category: 'deadline' }));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test verification`
Expected: FAIL

- [ ] **Step 3: Implementar**

- **`buildItems`** (IDs `V001`, `V002`...) só gera itens das direções listadas em `config.verification.directions`; o estágio repassa a lista:
  - **`summary_to_source`**, para cada afirmação:
    - se é tipada, `deterministicFirst` está ligado e algum fato candidato dá `compareValues === 'equal'`: `supported` decidido por código, com explicação "O valor no resumo confere com o documento ({label}).";
    - senão: item para o verificador, cujos `sourceExcerpts` são os trechos ancorados das evidências dos fatos candidatos mais os textos dos chunks recuperados.
  - **`source_to_summary`**, para cada fato:
    - fato `uncertain`: `unverifiable` decidido por código, com explicação "A informação não foi identificada com segurança no documento ({motivos em pt-BR}).";
    - fato pareado a alguma afirmação com valor `equal`: `consistent` decidido por código;
    - senão: item para o verificador, com `subject = renderFact(fact)`, `summaryText = summaryPlainText` e as evidências como trechos.
- **Verificador:**
  - lotes de `batchSize`, executados com `mapWithConcurrency`;
  - um veredito fora do conjunto permitido para a direção vira `unverifiable`, com aviso `verifier_invalid_verdict`;
  - um item sem veredito vira `unverifiable`, com a explicação "O verificador não retornou veredito para este item.".
  - O prompt traz as regras de veredito do spec §6.5 e proíbe usar `divergent` quando falta evidência.
- **`retrieve`:** embeda os textos das afirmações, re-embeda os chunks da fonte (o cache da API evita custo) e ordena por produto escalar.
- **Alertas** (IDs `AL01`, `AL02`...):
  - títulos: "Divergência em {label}", "Omissão: {label}", "Afirmação sem respaldo no documento", "Não foi possível verificar: {label}";
  - ordenados por severidade (high, medium, low) e depois por ID;
  - `sourceEvidence` vem dos spans das evidências do fato e `summaryRef` vem de `claim.paragraphRef`.
- **Métricas:** conforme o spec §6.5, restritas às categorias críticas.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add bidirectional verification, severity matrix and alerts"
```

### Task 23: Estágio `report`

**Files:**
- Create: `packages/pipeline/src/stages/report/stage.ts`, `packages/pipeline/src/stages/index.ts` (exporta os seis estágios)
- Test: `.../report/stage.test.ts`

**Interfaces:**
- Produces:
  - `RunTotals { inputTokens: number; outputTokens: number; costUsd: number; durationMs: number }`;
  - `ReportInput { info: InformationExtractionOutput; summarization: SummarizationOutput; similarity: SimilarityOutput; verification: VerificationOutput; totals: RunTotals }`;
  - `reportStage: Stage<ReportInput, RunMetricsShape>`;
  - `STAGES_BY_NAME: Record<StageName, Stage<any, any>>`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('aggregates metrics', async () => {
  const m = await reportStage.run(fixture, createTestContext());
  expect(m).toMatchObject({ alignmentF1: fixture.similarity.metrics.alignmentF1, factsConfirmed: 2, factsUncertain: 1, alertsHigh: 1, costUsd: 0.12 });
});
test('propagates null metrics without NaN (Review Focus 3)', async () => {
  const m = await reportStage.run({ ...fixture, verification: { ...fixture.verification, metrics: { factualConsistency: null, claimSupport: null, unverifiableCount: 0 } } }, createTestContext());
  expect(m.factualConsistency).toBeNull(); expect(Object.values(m).some((v) => Number.isNaN(v))).toBe(false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test report`
Expected: FAIL

- [ ] **Step 3: Implementar a agregação**

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/pipeline test && pnpm --filter @app/pipeline typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): add report stage aggregating run metrics"
```

---

## Fase 8 — API

### Task 24: Esqueleto do Fastify e harness de testes

**Files:**
- Create: `apps/api/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts}`, `apps/api/src/{main,app,env}.ts`, `apps/api/src/plugins/{prisma,error-handler}.ts`, `apps/api/src/http-error.ts`, `apps/api/src/modules/health/routes.ts`
- Create: `apps/api/test/{global-setup.ts,helpers/app.ts,helpers/db.ts,health.test.ts}`, `packages/shared/src/api/errors.ts`

**Interfaces:**
- Produces:
  - `Env` e `loadEnv(source?: NodeJS.ProcessEnv): Env` (variáveis do spec §15 mais `CORPUS_DIR`; padrões: `PORT=3333`, `RUN_CONCURRENCY=2`, `LLM_CONCURRENCY=4`, `UPLOAD_DIR=/data/uploads`, `LOG_LEVEL=info`, `CORPUS_DIR=./corpus`; as chaves de API são opcionais);
  - `buildApp(opts: { env: Env; prisma?: PrismaClient; logger?: boolean }): Promise<FastifyInstance>`, com o decorator `app.prisma` (a Task 25 acrescenta a opção `ai`);
  - `class HttpError extends Error { constructor(status: number, code: string, message: string, details?: unknown) }`;
  - `ApiErrorBody` (schema Zod em `@app/shared`);
  - `PIPELINE_ERROR_STATUS: Record<PipelineErrorCode, number>` (`UNSUPPORTED_FILE` 415, `FILE_TOO_LARGE` 413, `PROVIDER_NOT_CONFIGURED` 400, `RATE_LIMITED` 429, `PROVIDER_ERROR` 502, os demais 500);
  - nos testes: `createTestApp(overrides?)`, `resetDatabase(prisma)` (`TRUNCATE` em todas as tabelas com `CASCADE`), e um `global-setup` que roda `prisma migrate deploy` em `TEST_DATABASE_URL`;
  - na config do Vitest: `fileParallelism: false`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('health ok', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  expect(res.statusCode).toBe(200); expect(res.json()).toEqual({ status: 'ok', database: 'ok' });
});
test('unknown route uses error format', async () => {
  const res = await app.inject({ method: 'GET', url: '/nope' });
  expect(res.statusCode).toBe(404); expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
});
test('HttpError and PipelineError are mapped', /* rotas de teste lançam HttpError(409,'X','m') e PipelineError('UNSUPPORTED_FILE') → 409 X / 415 UNSUPPORTED_FILE com a userMessage */ () => {});
test('zod validation error → 400 VALIDATION_ERROR with issues in details', () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test`
Expected: FAIL

- [ ] **Step 3: Implementar**

- Registrar `validatorCompiler` e `serializerCompiler` do `fastify-type-provider-zod`, e `@fastify/multipart` com `limits.fileSize = 20 MB`.
- Em erros de pipeline, a mensagem da resposta é a `userMessage` (pt-BR). Erros desconhecidos viram 500 `INTERNAL_ERROR` com mensagem genérica.
- `main.ts` escuta em `0.0.0.0:PORT`. A Task 30 acrescenta `markInterruptedRuns` antes do `listen`.
- `tsup` com as entradas `src/main.ts` e `src/cli/*.ts`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): add fastify skeleton, env, error format, health and test harness"
```

### Task 25: Adaptadores de IA e `/providers`

**Files:**
- Create: `apps/api/src/runtime/adapters/{model-resolver,embedder,call-recorder}.ts`, `apps/api/src/modules/providers/routes.ts`, `packages/shared/src/api/providers.ts`
- Modify: `apps/api/src/app.ts` (opção `ai?: AiOverrides` em `buildApp`) e `apps/api/test/helpers/app.ts` (`createTestApp` repassa `ai`)
- Test: `apps/api/test/{embedder,providers}.test.ts`

**Interfaces:**
- Consumes: portas da Task 5 e catálogo da Task 4.
- Produces:
  - `availableProviders(env: Env): ('openai'|'anthropic')[]`;
  - `createModelResolver(env: Env): ModelResolver`, que lança `PipelineError('PROVIDER_NOT_CONFIGURED')` se o provider não tem chave;
  - `EmbedManyFn = (args: { model: string; values: string[]; dimensions: number|null }) => Promise<{ embeddings: number[][]; tokens: number }>` e `defaultEmbedMany(env: Env): EmbedManyFn` (usa o `embedMany` do AI SDK);
  - `AiOverrides { modelResolver?: ModelResolver; embedManyFn?: EmbedManyFn }`, o ponto de injeção de mocks nos testes da API;
  - `createEmbedder(deps: { prisma: PrismaClient; embedMany: EmbedManyFn; onCall: (r: EmbeddingCallRecord) => Promise<void> }): Embedder` (cache por `(model, dimensions ?? 0, sha256(text))`, lotes de 100);
  - `createCallRecorder(deps: { prisma: PrismaClient; runId: string; getStageRunId: () => string; onLlmCall?: (row: { id: string; agent: string; model: string; inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number; status: 'success'|'error' }) => void }): CallRecorder`;
  - `ProvidersDto { providers: { id: 'openai'|'anthropic'; configured: boolean }[]; models: ModelCatalogEntry[] }`;
  - rota `GET /providers`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('embedder caches by model/dimensions/text hash', async () => {
  const calls: string[][] = [];
  const embedMany: EmbedManyFn = async ({ values }) => { calls.push(values); return { embeddings: values.map(() => [1, 0]), tokens: values.length }; };
  const records: EmbeddingCallRecord[] = [];
  const e = createEmbedder({ prisma, embedMany, onCall: async (r) => { records.push(r); } });
  await e.embed(['a', 'b'], { model: MODEL_REFS.embeddingSmall, dimensions: null });
  const second = await e.embed(['b', 'c', 'a'], { model: MODEL_REFS.embeddingSmall, dimensions: null });
  expect(calls).toEqual([['a', 'b'], ['c']]); expect(second).toHaveLength(3); expect(records[1]!.cacheHits).toBe(2);
});
test('resolver throws PROVIDER_NOT_CONFIGURED without key', () =>
  expect(() => createModelResolver(envWithout('ANTHROPIC_API_KEY')).resolve(MODEL_REFS.anthropicMain)).toThrow(expect.objectContaining({ code: 'PROVIDER_NOT_CONFIGURED' })));
test('/providers reflects env', /* só OPENAI_API_KEY → openai configured true, anthropic false; a lista de modelos não está vazia */ () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test embedder providers`
Expected: FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): add AI SDK model resolver, cached embedder, call recorder and providers route"
```

### Task 26: Módulo de documentos

**Files:**
- Create: `apps/api/src/modules/documents/{routes,service,repository}.ts`, `apps/api/src/storage/file-storage.ts`, `packages/shared/src/api/documents.ts`
- Test: `apps/api/test/documents.test.ts`

**Interfaces:**
- Consumes: `detectFormat` (`@app/pipeline`) e `buildStoragePath` (`@app/db`).
- Produces:
  - `DocumentDto { id; filename; mimeType; sizeBytes; sha256; source; corpusKey: string|null; createdAt: string; detectedType: DocumentType|null; pages: number|null; runCount: number; lastRunStatus: RunStatus|null }`, em que `detectedType` e `pages` vêm da run concluída mais recente;
  - `UploadDocumentResponse { document: DocumentDto; deduplicated: boolean }`;
  - `FileStorage { save(buffer: Buffer, sha256: string, ext: string): Promise<string>; read(path: string): Promise<Buffer> }` e `createFileStorage(uploadDir: string): FileStorage`;
  - `MIME_BY_FORMAT: Record<SourceFormat, string>`;
  - `contentDisposition(filename: string): string` (RFC 6266/5987);
  - rotas `POST /documents`, `GET /documents`, `GET /documents/:id`, `GET /documents/:id/file`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('upload then dedupe (Review Focus 5)', async () => {
  const first = await upload(app, 'a.txt', 'Art. 1º Fica instituído.');
  expect(first.statusCode).toBe(201); expect(first.json().deduplicated).toBe(false);
  const again = await upload(app, 'b.txt', 'Art. 1º Fica instituído.');
  expect(again.statusCode).toBe(200); expect(again.json()).toMatchObject({ deduplicated: true, document: { id: first.json().document.id } });
  expect(await prisma.document.count()).toBe(1);
});
test('rejects png with 415', async () => expect((await upload(app, 'x.png', PNG_HEADER)).json()).toMatchObject({ error: { code: 'UNSUPPORTED_FILE' } }));
test('list includes runCount 0', () => {});
test('file download returns same bytes and RFC 5987 filename', async () => {
  const { document } = (await upload(app, 'decisão.txt', 'abc')).json();
  const res = await app.inject({ method: 'GET', url: `/documents/${document.id}/file` });
  expect(res.body).toBe('abc'); expect(res.headers['content-disposition']).toContain("filename*=UTF-8''decis%C3%A3o.txt");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test documents`
Expected: FAIL

- [ ] **Step 3: Implementar**

Arquivo maior que o limite do multipart dá 413 `FILE_TOO_LARGE`. Documento inexistente dá 404 `NOT_FOUND`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/api test documents`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): add documents module with sha256 dedupe and file storage"
```

### Task 27: Presets e seed

**Files:**
- Create: `apps/api/src/modules/presets/{routes,service}.ts`, `packages/shared/src/api/presets.ts`, `packages/db/src/seed.ts`, `apps/api/src/cli/seed.ts`
- Test: `apps/api/test/presets.test.ts`, `apps/api/test/seed.test.ts`
- Modify: `package.json` na raiz (script `db:seed` → `pnpm --filter @app/api exec tsx src/cli/seed.ts`)

**Interfaces:**
- Consumes: `BUILTIN_PRESETS`, `parsePipelineConfig`, `parseCorpusManifest`, `buildStoragePath`, `detectFormat`.
- Produces:
  - `PresetDto { id; slug; name; description; config: PipelineConfig; isBuiltin: boolean; createdAt: string; updatedAt: string }`;
  - `CreatePresetBody { slug: string /* /^[a-z0-9]+(-[a-z0-9]+)*$/ */; name; description; config: PipelineConfigInput }` e `UpdatePresetBody` (todos os campos de `CreatePresetBody` menos `slug`, opcionais);
  - rotas do spec §8: um preset `isBuiltin` responde 409 `PRESET_READ_ONLY`; duplicar gera o slug `<slug>-copy` (`-copy-2`, `-copy-3`... se já existir), o nome `<name> (cópia)` e `isBuiltin: false`;
  - `seed(prisma: PrismaClient, opts: { uploadDir: string; corpusDir: string; log?: (m: string) => void }): Promise<{ presets: number; documents: number }>`, idempotente:
    - faz upsert dos presets pelo `slug`, atualizando a config dos built-in;
    - faz upsert dos documentos pelo `sha256`, com `source: 'corpus'` e `corpusKey`, copiando os arquivos para o `uploadDir`;
    - se o `corpusDir` não existir, pula os documentos e registra no log.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('invalid config → 400 with issue path', async () => {
  const res = await app.inject({ method: 'POST', url: '/presets', payload: { slug: 'x', name: 'X', description: '', config: { models: { extraction: { model: MODEL_REFS.embeddingSmall } } } } });
  expect(res.statusCode).toBe(400); expect(JSON.stringify(res.json().error.details)).toContain('extraction');
});
test('builtin is read-only', async () => {
  const id = await presetId('openai-default');
  expect((await app.inject({ method: 'PUT', url: `/presets/${id}`, payload: { name: 'y' } })).json()).toMatchObject({ error: { code: 'PRESET_READ_ONLY' } });
  expect((await app.inject({ method: 'DELETE', url: `/presets/${id}` })).statusCode).toBe(409);
});
test('duplicate builtin', async () => {
  const res = await app.inject({ method: 'POST', url: `/presets/${await presetId('openai-default')}/duplicate` });
  expect(res.json()).toMatchObject({ slug: 'openai-default-copy', isBuiltin: false });
});
test('seed is idempotent', async () => {
  const a = await seed(prisma, { uploadDir: tmp, corpusDir: fixtureCorpus });
  const b = await seed(prisma, { uploadDir: tmp, corpusDir: fixtureCorpus });
  expect(a).toEqual(b); expect(await prisma.preset.count()).toBe(4); expect(await prisma.document.count()).toBe(a.documents);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test presets seed`
Expected: FAIL

- [ ] **Step 3: Implementar**

O teste usa como `fixtureCorpus` um manifest mínimo com 2 arquivos TXT em `apps/api/test/fixtures/corpus/`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): add presets module and idempotent seed for presets and corpus"
```

### Task 28: Barramento de eventos, gravação e SSE

**Files:**
- Create: `apps/api/src/runtime/{event-bus,event-recorder}.ts`, `apps/api/src/modules/runs/events-route.ts`
- Test: `apps/api/test/events.test.ts`

**Interfaces:**
- Consumes: `RunEvent`, `RunEventInput`, `TERMINAL_RUN_STATUSES`.
- Produces:
  - `EventBus { publish(e: RunEvent): void; subscribe(runId: string, listener: (e: RunEvent) => void): () => void }` e `createEventBus(): EventBus`;
  - `RunEventRecorder { emit(e: RunEventInput): Promise<RunEvent> }`;
  - `createEventRecorder(prisma: PrismaClient, bus: EventBus, runId: string): Promise<RunEventRecorder>`, que começa o `seq` em `max(seq)` da run e serializa as gravações numa cadeia de promises para manter a ordem;
  - rota `GET /runs/:id/events`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('recorder assigns sequential seq and resumes from db max', async () => {
  const r1 = await createEventRecorder(prisma, bus, runId);
  expect((await Promise.all([r1.emit(log('a')), r1.emit(log('b'))])).map((e) => e.seq)).toEqual([1, 2]);
  expect((await (await createEventRecorder(prisma, bus, runId)).emit(log('c'))).seq).toBe(3);
});
test('completed run: replays everything then closes', async () => {
  await seedEvents(runId, ['run.status:running', 'stage.started', 'run.status:completed']); await markRun(runId, 'completed');
  const res = await app.inject({ method: 'GET', url: `/runs/${runId}/events` });
  expect(parseSse(res.body).map((e) => e.id)).toEqual(['1', '2', '3']);
});
test('Last-Event-ID resumes after seq', /* cabeçalho last-event-id: 2 → só o id 3 */ () => {});
test('live events arrive exactly once', async () => {
  // app.listen({ port: 0 }); fetch com reader; durante o stream emitir 2 eventos e depois run.status completed
  // espera ids [1,2,3] sem duplicatas e o stream fechado
});
test('404 for unknown run', () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test events`
Expected: FAIL

- [ ] **Step 3: Implementar a rota SSE**

O algoritmo é este; a ordem importa para não perder eventos:

```
1. carrega a run (404 se não existir); lastSent = Number(header last-event-id ?? query lastEventId ?? 0)
2. assina o bus ANTES de ler o banco; guarda os eventos ao vivo num buffer
3. lê do banco os eventos com seq > lastSent, em ordem; escreve cada um e atualiza lastSent
4. esvazia o buffer pulando seq <= lastSent; a partir daí, escreve direto (sempre pulando seq <= lastSent)
5. heartbeat ": ping\n\n" a cada 15 s
6. encerra quando escreve um run.status terminal, ou logo depois do replay se a run já estiver terminal;
   cancela a assinatura e o timer quando o cliente fecha a conexão
```

Cabeçalhos: `content-type: text/event-stream`, `cache-control: no-cache`, `connection: keep-alive`, `x-accel-buffering: no`. Formato de cada mensagem: `id: <seq>\nevent: <type>\ndata: <json>\n\n`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/api test events`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): add event bus, sequenced event recorder and SSE route with replay"
```

### Task 29: Materialização das saídas das etapas

**Files:**
- Create: `apps/api/src/runtime/persistence/{materialize,load-outputs}.ts`
- Test: `apps/api/test/materialize.test.ts`

**Interfaces:**
- Consumes: schemas de saída dos estágios (`@app/shared`).
- Produces:
  - `StageOutputs = { text_extraction: TextExtractionOutput; information_extraction: InformationExtractionOutput; summarization: SummarizationOutput; similarity: SimilarityOutput; verification: VerificationOutput; report: RunMetricsShape }`;
  - `materializeStageOutput(tx: Prisma.TransactionClient, args: { runId: string; stageRunId: string; stage: StageName; output: unknown }): Promise<void>`:
    - `information_extraction` → `ExtractedFact` e `FactEvidence`;
    - `summarization` → `Summary`;
    - `verification` → `Claim`, depois `VerificationItem` (com `factId`/`claimId` resolvidos de chave para id da linha), depois `Alert` (com `verificationItemId`);
    - `report` → `RunMetrics` (upsert por `runId`);
    - as demais etapas não materializam nada;
  - `effectiveStageRunId(sr: { id: string; reusedFromStageRunId: string | null }): string`;
  - `loadStageOutputs(prisma: PrismaClient, runId: string): Promise<Partial<StageOutputs>>`, que lê o `output` do `StageRun` efetivo e valida com o schema de cada etapa.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('information_extraction → facts and evidence rows', async () => {
  await prisma.$transaction((tx) => materializeStageOutput(tx, { runId, stageRunId, stage: 'information_extraction', output: infoFixture }));
  expect(await prisma.extractedFact.findMany({ where: { stageRunId }, orderBy: { key: 'asc' } })).toHaveLength(infoFixture.facts.length);
  expect(await prisma.factEvidence.count()).toBe(infoFixture.facts.flatMap((f) => f.evidence).length);
});
test('verification → alert → item → claim links', () => {});
test('reused stage run loads origin output', /* StageRun B reused, apontando para A → loadStageOutputs(runB).information_extraction igual à saída de A */ () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test materialize`
Expected: FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/api test materialize`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): materialize stage outputs into domain tables and load effective outputs"
```

### Task 30: Runner, fila e rotas de runs

**Files:**
- Create: `apps/api/src/runtime/{run-queue,pipeline-runner,stage-inputs,canonical-json}.ts`, `apps/api/src/modules/runs/{routes,service}.ts`, `packages/shared/src/api/runs.ts`
- Modify: `apps/api/src/app.ts` (decorators `runQueue` e `eventBus`), `apps/api/src/main.ts` (`markInterruptedRuns` antes do `listen`)
- Test: `apps/api/test/runs.test.ts`

**Interfaces:**
- Consumes: Tasks 23, 25, 28 e 29.
- Produces:
  - `canonicalJson(v: unknown): string` (chaves ordenadas) e `configHash(config: PipelineConfig): string` (`sha256(canonicalJson(config))`);
  - `buildStageInput(stage: StageName, outputs: Partial<StageOutputs>, extra: { buffer: Uint8Array; filename: string; totals: RunTotals }): unknown`;
  - `RunQueue { enqueue(runId: string): void; cancel(runId: string): boolean; onIdle(): Promise<void> }` e `createRunQueue(deps: { concurrency: number; execute: (runId: string, signal: AbortSignal) => Promise<void> }): RunQueue`;
  - `createPipelineRunner(deps: { prisma; env; bus: EventBus; storage: FileStorage; ai?: AiOverrides }): { execute(runId: string, signal: AbortSignal): Promise<void> }`;
  - `markInterruptedRuns(prisma: PrismaClient): Promise<number>`;
  - `CreateRunBody { documentId: string; presetId: string; configOverrides?: DeepPartial<PipelineConfig>; label?: string }`;
  - `StageRunDto { id; stage; status; reusedFromStageRunId: string|null; durationMs: number|null; metrics: unknown; warnings: { code: string; message: string }[]; error: { code: string; message: string; userMessage: string }|null }`;
  - `RunDto { id; documentId; presetId: string|null; parentRunId: string|null; startFromStage: StageName|null; label: string|null; status; config: PipelineConfig; configHash; injectedFaults: InjectedFault[]|null; error: StageRunDto['error']; createdAt; startedAt: string|null; finishedAt: string|null; stages: StageRunDto[]; totals: { inputTokens: number; outputTokens: number; costUsd: number } }`;
  - rotas `POST /runs` (202), `GET /runs?documentId=&label=`, `GET /runs/:id` e `POST /runs/:id/cancel` (409 `RUN_NOT_ACTIVE` se a run já terminou).

- [ ] **Step 1: Escrever os testes que falham**

Os testes injetam mocks com `buildApp({ ai: { modelResolver: mockResolver, embedManyFn: fakeEmbedMany } })`. Os mocks devolvem saídas válidas por agente: classificador, extrator, resumidor, extrator de afirmações e verificador.

```ts
test('provider without key → 400 before queueing (Review Focus 4)', async () => {
  const app = await createTestApp({ env: { ANTHROPIC_API_KEY: undefined } });
  const res = await app.inject({ method: 'POST', url: '/runs', payload: { documentId, presetId: await presetId('anthropic-default') } });
  expect(res.json()).toMatchObject({ error: { code: 'PROVIDER_NOT_CONFIGURED' } }); expect(await prisma.run.count()).toBe(0);
});
test('full run with mocks completes', async () => {
  const run = (await createRun(app, txtDocId, 'openai-default')).json();
  await app.runQueue.onIdle();
  const done = (await app.inject({ method: 'GET', url: `/runs/${run.id}` })).json();
  expect(done.status).toBe('completed'); expect(done.stages.every((s: StageRunDto) => s.status === 'completed')).toBe(true);
  expect(await prisma.runMetrics.count({ where: { runId: run.id } })).toBe(1);
  const types = (await prisma.runEvent.findMany({ where: { runId: run.id }, orderBy: { seq: 'asc' } })).map((e) => e.type);
  expect(types[0]).toBe('run.status'); expect(types.at(-1)).toBe('run.status');
});
test('stage failure marks run failed with code', /* o mock do resumidor lança 429 → run failed; summarization failed com RATE_LIMITED; similarity pending */ () => {});
test('cancel during run → cancelled', () => {});
test('markInterruptedRuns', /* runs queued e running → interrupted; StageRun running → failed com INTERRUPTED */ () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test runs`
Expected: FAIL

- [ ] **Step 3: Implementar**

- **`createRun`:**
  1. Carrega o documento e o preset (404 se faltar algum).
  2. `config = mergeConfig(parsePipelineConfig(preset.config), overrides)`.
  3. Se `requiredProviders(config)` não estiver contido em `availableProviders(env)`, responde 400 `PROVIDER_NOT_CONFIGURED`.
  4. Numa transação, cria a `Run` (`queued`, com `configHash`) e os 6 `StageRun` em `pending`.
  5. `enqueue` e responde 202 com o `RunDto`.
- **`execute(runId, signal)`:**
  1. Marca a run como `running` com `startedAt` e emite `run.status`.
  2. Cria um `createEventRecorder` para a run.
  3. Carrega `loadStageOutputs` e o buffer do documento.
  4. Para cada etapa em `STAGE_ORDER`:
     - status `reused` → emite `stage.reused` e passa para a próxima;
     - status `overridden` → passa para a próxima;
     - status `completed` → passa para a próxima;
     - senão, executa a etapa:
       1. marca `running` e emite `stage.started`;
       2. monta o `StageContext`:
          - `models`: resolver do env ou o override de teste;
          - `embedder`: com `onCall` gravando o `EmbeddingCall` do stage run;
          - `recorder`: `onLlmCall` emite `llm.call`;
          - `events`: `progress` e `log` emitem eventos, e `warn` acumula em `warnings` e também emite `log` de nível warn;
          - `signal` e `llmConcurrency`;
       3. `output = stage.output.parse(await stage.run(buildStageInput(...), ctx))`;
       4. numa transação, grava o `StageRun` como `completed` (output, metrics, warnings, durationMs) e chama `materializeStageOutput`;
       5. emite `stage.completed` com métricas resumidas por etapa (palavras e páginas; contagem de fatos; legibilidade; `alignmentF1`; contagem de alertas; custo);
       6. guarda o output para as etapas seguintes.
  5. `totals` = soma de `LlmCall` e `EmbeddingCall` da run, mais `durationMs` desde `startedAt`.
  6. Em erro: `PipelineError`, ou `INTERNAL_ERROR` para erros desconhecidos, ou `CANCELLED` se o `signal` foi abortado. Grava o erro no `StageRun` e na `Run`, emite `stage.failed`, e a run termina `failed` ou `cancelled`.
  7. Grava `finishedAt` e emite o `run.status` terminal.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): add in-process run queue, pipeline runner and runs routes"
```

### Task 31: Reprocessamento e rotas de resultado

**Files:**
- Create: `apps/api/src/modules/runs/{rerun,result-routes}.ts`
- Modify: `packages/shared/src/api/runs.ts`
- Test: `apps/api/test/{rerun,results}.test.ts`

**Interfaces:**
- Consumes: Tasks 29 e 30, `earliestStageAffected`, `fleschPt`, `compressionRatio`, `summaryPlainText`.
- Produces:
  - `RerunBody { fromStage: StageName; configOverrides?: DeepPartial<PipelineConfig>; summaryOverride?: Summary; label?: string; injectedFaults?: InjectedFault[] }`;
  - `RunResultDto { classification: Classification|null; sections: Section[]; facts: Fact[]; notFound: FactCategory[]; ambiguities: { description: string; quote: string }[]; summary: SummarizationOutput|null; similarity: { metrics: SimilarityMetrics; headline: SimilarityOutput['headline'] }|null; claims: Claim[]; items: VerificationItem[]; alerts: Alert[]; metrics: RunMetricsShape|null }`;
  - `RunTextDto { canonicalText: string; pageMap: PageRange[]; sections: Section[]; cleaningReport: CleaningReport; coverageByChunk: { chunkId: string; start: number; end: number; score: number; highlighted: boolean }[]|null; supportByParagraph: SimilarityOutput['supportByParagraph']|null }`;
  - `LlmCallSummaryDto { id; agent; agentVersion; model; attempt; status; inputTokens; outputTokens; costUsd; latencyMs; createdAt }` e `LlmCallDto` (o resumo mais `params`, `messages`, `rawResponse`, `parsedOutput` e `error`);
  - rotas `POST /runs/:id/rerun` (202 com `RunDto`), `GET /runs/:id/result`, `GET /runs/:id/text`, `GET /runs/:id/llm-calls` e `GET /runs/:id/llm-calls/:callId`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('rerun from summarization reuses earlier checkpoints', async () => {
  const child = (await rerun(app, parentId, { fromStage: 'summarization', configOverrides: { summarization: { targetLength: 'short' } } })).json();
  await app.runQueue.onIdle();
  const stages = (await getRun(app, child.id)).stages;
  expect(stages.find((s) => s.stage === 'information_extraction')!.status).toBe('reused');
  expect(stages.find((s) => s.stage === 'summarization')!.status).toBe('completed');
  expect(mockCalls('extractor.court-decision')).toBe(callsBefore);
});
test('override before fromStage → 400 OVERRIDE_BEFORE_FROM_STAGE', /* fromStage summarization com overrides em extraction */ () => {});
test('summaryOverride requires fromStage similarity', () => {});
test('summaryOverride marks summarization overridden and stores the given summary', () => {});
test('parent still running → 409 RUN_NOT_COMPLETED', () => {});
test('retry after failure completes', /* run falhou em summarization → rerun fromStage summarization → completed */ () => {});
test('result of reused run equals parent facts', () => {});
test('text route returns canonical text and coverage', () => {});
test('llm-calls list and detail', () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test rerun results`
Expected: FAIL

- [ ] **Step 3: Implementar o rerun**

1. A run de origem precisa estar terminal; se não estiver, 409 `RUN_NOT_COMPLETED`.
2. `earliestStageAffected(overrides)` com `stageIndex` menor que o de `fromStage` dá 400 `OVERRIDE_BEFORE_FROM_STAGE`.
3. `summaryOverride` com `fromStage` diferente de `similarity` dá 400 `VALIDATION_ERROR`.
4. Toda etapa anterior a `fromStage` precisa estar `completed`, `reused` ou `overridden` na origem; senão, 400 `MISSING_CHECKPOINT`.
5. `config = mergeConfig(parent.config, overrides)`, mais a checagem de providers.
6. Cria a run nova (`parentRunId`, `startFromStage`, `label`, `injectedFaults`):
   - etapas anteriores a `fromStage` ficam `reused`, com `reusedFromStageRunId = effectiveStageRunId(parentStageRun)`;
   - com `summaryOverride`, o `StageRun` de `summarization` fica `overridden`, com `output = { summary, readability: { source: fleschPt(canonical), summary: fleschPt(summaryPlainText(summary)) }, compressionRatio }` materializado;
   - as demais etapas ficam `pending`.
7. `enqueue`.

As rotas de resultado montam os DTOs a partir de `loadStageOutputs`. Campos de etapas ainda não concluídas vêm como `null` ou `[]`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): add rerun from stage with overrides and result, text and llm-call routes"
```

### Task 32: Exportação JSON e CSV

**Files:**
- Create: `packages/shared/src/export.ts`, `apps/api/src/modules/runs/export/{build-export,csv,zip,route}.ts`
- Test: `apps/api/test/export.test.ts`, `apps/api/src/modules/runs/export/csv.test.ts`

**Interfaces:**
- Produces:
  - `RunExportV1` (Zod): `schemaVersion: 1`, `generatedAt`, `document { id, filename, sha256, source, corpusKey }`, `run { id, status, presetSlug, parentRunId, label, configHash, config }`, `classification`, `facts`, `summary`, `metrics`, `claims`, `verificationItems`, `alerts`, `costs { inputTokens, outputTokens, costUsd }`;
  - `buildRunExport(prisma: PrismaClient, runId: string): Promise<RunExportV1>`;
  - `toCsv(rows: Record<string, string | number | boolean | null>[], columns: string[]): string` (BOM `﻿`, separador `,`, quebra `\r\n`, aspas RFC 4180);
  - `buildCsvZip(exp: RunExportV1, llmCalls: LlmCallSummaryDto[]): Uint8Array` (`zipSync` do `fflate`);
  - colunas de cada CSV:
    - `facts.csv`: `fact_key, category, label, value_json, confidence, status, uncertainty_reasons, evidence_quotes, pages`, com listas unidas por `;` e citações unidas por ` | `;
    - `claims.csv`: `claim_key, text, category, value_json, section_index, paragraph_index`;
    - `alerts.csv`: `alert_key, type, severity, category, title, explanation, fact_key, claim_key`;
    - `metrics.csv`: `metric, value`, com uma linha por campo de `RunMetricsShape`;
    - `llm_calls.csv`: `agent, agent_version, model, attempt, status, input_tokens, output_tokens, cost_usd, latency_ms, created_at`;
  - rota `GET /runs/:id/export?format=json|csv`: 409 `RUN_NOT_COMPLETED` se a run não está `completed`; arquivos `run-<id>.json` (`application/json`) e `run-<id>.zip` (`application/zip`).

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('toCsv quotes commas, quotes and newlines', () =>
  expect(toCsv([{ a: 'x,"y"\nz', b: 1 }], ['a', 'b'])).toBe('﻿a,b\r\n"x,""y""\nz",1\r\n'));
test('json export validates against RunExportV1', async () =>
  expect(RunExportV1.safeParse((await exportRun(app, runId, 'json')).json()).success).toBe(true));
test('csv export zip has 5 files with BOM', async () => {
  const files = unzipSync(new Uint8Array((await exportRun(app, runId, 'csv')).rawPayload));
  expect(Object.keys(files).sort()).toEqual(['alerts.csv', 'claims.csv', 'facts.csv', 'llm_calls.csv', 'metrics.csv']);
  expect(strFromU8(files['facts.csv']!).startsWith('﻿')).toBe(true);
});
test('409 when run not completed', () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test export csv`
Expected: FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): add versioned json export and zipped csv export"
```

### Task 33: Similaridade cruzada

**Files:**
- Create: `apps/api/src/modules/analysis/{routes,service}.ts`, `packages/shared/src/api/analysis.ts`
- Test: `apps/api/test/analysis.test.ts`

**Interfaces:**
- Consumes: `computeAlignment`, `normalizeVector`, `createEmbedder`, `loadStageOutputs`.
- Produces:
  - `CrossSimilarityBody { runIds: string[] }` (de 2 a 50 runs);
  - `CrossSimilarityDto { runIds: string[]; documentIds: string[]; matrix: number[][] }`, em que `matrix[i][j]` = `alignmentF1` do resumo da run i contra o documento da run j;
  - rota `POST /analysis/cross-similarity`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('2x2 matrix with dominant diagonal under fake embeddings', async () => {
  const m = (await app.inject({ method: 'POST', url: '/analysis/cross-similarity', payload: { runIds: [runA, runB] } })).json().matrix;
  expect(m[0][0]).toBeGreaterThan(m[0][1]); expect(m[1][1]).toBeGreaterThan(m[1][0]);
});
test('mixed embedding models → 400 MIXED_EMBEDDING_MODELS', () => {});
test('run without similarity output → 409 RUN_NOT_COMPLETED', () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test analysis`
Expected: FAIL

- [ ] **Step 3: Implementar**

Os vetores vêm do embedder com cache. Textos que ainda não estão no cache são embedados normalmente, e essas chamadas de embedding não são associadas a nenhuma run.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @app/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): add cross-similarity analysis route"
```

---

## Fase 9 — Interface web

Nas tasks da web, a lógica pura (reducers, formatação, diff, segmentos de destaque) é escrita com TDD. Os componentes são conferidos no navegador, com a API rodando (`pnpm dev`) e mocks ou chaves reais. Os textos da UI ficam em pt-BR. Antes da primeira tela, carregar a skill `shadcn` para ter a referência dos componentes.

### Task 34: Scaffold da web

**Files:**
- Create: `apps/web/{package.json,vite.config.ts,tsconfig.json,tsconfig.app.json,index.html,components.json,vitest.config.ts}`
- Create: `apps/web/src/{main.tsx,styles.css,router.tsx}`, `apps/web/src/routes/{__root,index}.tsx`
- Create: `apps/web/src/lib/{api-client,query-client,format,labels}.ts`, `apps/web/src/components/{app-shell,theme-toggle}.tsx`, `apps/web/src/components/ui/*` (gerados pelo shadcn)
- Test: `apps/web/src/lib/{format,labels}.test.ts`

**Interfaces:**
- Consumes: `@app/shared`.
- Produces:
  - `ApiError extends Error { status: number; code: string; details?: unknown }`;
  - `api = { get<T>(path: string, schema: z.ZodType<T>): Promise<T>; post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>; put<T>(...): Promise<T>; del(path: string): Promise<void>; upload(file: File): Promise<UploadDocumentResponse> }`, com base `/api`, respostas validadas por Zod e erros convertidos a partir de `ApiErrorBody`;
  - `queryClient` com `staleTime` de 5 s;
  - formatação: `formatCurrencyBRL(n: number): string`, `formatDate(iso: string): string` (`dd/MM/yyyy`), `formatDuration(ms: number|null): string` (`1 min 05 s`, `850 ms`, `—`), `formatPercent(n: number|null): string`, `formatScore(n: number|null): string` (3 casas ou `—`), `formatUsd(n: number): string` (`US$ 0,0123`);
  - rótulos em pt-BR, cobrindo todos os valores dos enums: `STAGE_LABELS`, `RUN_STATUS_LABELS`, `STAGE_RUN_STATUS_LABELS`, `DOCUMENT_TYPE_LABELS`, `CATEGORY_LABELS`, `CONFIDENCE_LABELS`, `FACT_STATUS_LABELS`, `UNCERTAINTY_REASON_LABELS`, `VERDICT_LABELS`, `ALERT_TYPE_LABELS`, `SEVERITY_LABELS`. Para as etapas: `Extração e limpeza`, `Extração de informações`, `Resumo`, `Similaridade`, `Verificação`, `Relatório`;
  - `AppShell`: sidebar com Documentos (`/`), Presets (`/presets`) e Comparar (`/compare`), mais um header com `ThemeToggle`. O tema usa a classe `dark` no `<html>` e é lembrado no `localStorage` (leitura e escrita dentro de `try/catch`).

- [ ] **Step 1: Criar o app e as dependências**

- Template `react-ts` do Vite.
- Tailwind v4 via `@tailwindcss/vite`, com `@import "tailwindcss";` no `styles.css`.
- `shadcn init` (consultar a documentação de Vite + Tailwind v4), com cor base neutral.
- Componentes: `button card badge tabs table sheet dialog accordion tooltip progress skeleton sonner select input label textarea dropdown-menu separator scroll-area chart alert switch form`.
- `@tanstack/react-router` com o plugin de rotas por arquivo, e `@tanstack/react-query`.
- Proxy do Vite: `/api` → `http://localhost:3333`, com `rewrite` removendo o prefixo `/api`.

- [ ] **Step 2: Escrever os testes que falham**

```ts
test('formatters', () => {
  expect(formatCurrencyBRL(1234.56)).toBe('R$ 1.234,56'); expect(formatPercent(null)).toBe('—');
  expect(formatScore(0.87654)).toBe('0,877'); expect(formatDuration(65_000)).toBe('1 min 05 s');
});
test('labels cover every enum value', () => {
  expect(Object.keys(STAGE_LABELS).sort()).toEqual([...StageName.options].sort());
  expect(Object.keys(CATEGORY_LABELS).sort()).toEqual([...FactCategory.options].sort());
  expect(Object.keys(VERDICT_LABELS).sort()).toEqual([...Verdict.options].sort());
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @app/web test`
Expected: FAIL

- [ ] **Step 4: Implementar `lib/` e o shell**

- [ ] **Step 5: Rodar os testes e conferir no navegador**

Run: `pnpm --filter @app/web test && pnpm --filter @app/web typecheck`
Expected: PASS

Run: `pnpm --filter @app/web dev` e abrir `http://localhost:5173`.
Expected: o shell com a sidebar aparece, e o botão de tema alterna entre claro e escuro sem recarregar.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): scaffold vite react app with tailwind, shadcn, tanstack router and query"
```

### Task 35: Página de documentos

**Files:**
- Create: `apps/web/src/features/documents/{queries,documents-page,upload-dropzone,documents-table,process-dialog}.tsx`
- Modify: `apps/web/src/routes/index.tsx`
- Test: `apps/web/src/features/documents/process-dialog.test.tsx`

**Interfaces:**
- Produces:
  - queries `useDocuments()`, `useUploadDocument()`, `usePresets()`, `useProviders()` e `useCreateRun()` (este último navega para `/runs/$runId` quando dá certo);
  - `presetAvailability(preset: PresetDto, providers: ProvidersDto): { available: boolean; missing: ('openai'|'anthropic')[] }`, baseada em `requiredProviders`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
test('preset needing anthropic is disabled when anthropic is not configured', async () => {
  render(<ProcessDialog document={doc} presets={[openaiDefault, anthropicDefault]} providers={onlyOpenai} open onOpenChange={() => {}} />);
  await userEvent.click(screen.getByRole('combobox'));
  expect(screen.getByRole('option', { name: /anthropic-default/i })).toHaveAttribute('aria-disabled', 'true');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/web test process-dialog`
Expected: FAIL

- [ ] **Step 3: Implementar a página**

- **Dropzone:** aceita `.pdf`, `.docx`, `.html`, `.htm` e `.txt`; mostra o progresso do envio.
- **Toasts:** "Documento enviado" e "Este documento já existia; usando o registro existente" (este quando vem `deduplicated: true`).
- **Tabela:** colunas Nome, Origem (badge `Upload` ou `Corpus`), Tipo, Páginas, Execuções e Última execução (badge de status), mais as ações "Processar" e "Ver última execução".
- **Diálogo de processamento:** um `Select` de preset; os indisponíveis aparecem desabilitados, com tooltip "Configure a chave {PROVIDER}_API_KEY no .env". O botão confirma e cria a run.
- **Estado vazio:** "Envie um documento ou rode o seed para carregar o corpus."

- [ ] **Step 4: Rodar os testes e conferir no navegador**

Run: `pnpm --filter @app/web test`
Expected: PASS

Com a API e a web rodando, conferir no navegador:
- enviar um TXT e reenviar o mesmo arquivo: aparece o toast de duplicata;
- "Processar" leva à página da execução.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): add documents page with upload, dedupe feedback and process dialog"
```

### Task 36: Página da execução: cabeçalho, stepper e eventos ao vivo

**Files:**
- Create: `apps/web/src/routes/runs/$runId.tsx`, `apps/web/src/features/runs/{queries,events-reducer,use-run-events,run-page,run-header,stage-stepper}.tsx`
- Test: `apps/web/src/features/runs/events-reducer.test.ts`

**Interfaces:**
- Consumes: `RunDto`, `RunEvent`, `TERMINAL_RUN_STATUSES`.
- Produces:
  - `RunLiveState { status: RunStatus; stages: Record<StageName, { status: StageRunStatus; lastMessage: string|null; current: number|null; total: number|null; durationMs: number|null; metrics: unknown }>; logs: { level: string; message: string; createdAt: string }[]; llmCalls: Extract<RunEvent, { type: 'llm.call' }>[]; lastSeq: number }`;
  - `initialLiveState(run: RunDto): RunLiveState` e `applyRunEvent(state: RunLiveState, event: RunEvent): RunLiveState` (ignora eventos com `seq ≤ lastSeq`);
  - `useRun(runId)`, `useRunResult(runId)` (habilitado quando a run está `completed`) e `useRunText(runId)`;
  - `useRunEvents(runId: string): RunLiveState`: abre um `EventSource` em `/api/runs/${runId}/events`, aplica cada evento no cache `['run', runId, 'live']` e, no `run.status` terminal, invalida `['run', runId]` e `['run', runId, 'result']` e fecha a conexão.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('stage lifecycle', () => {
  let s = initialLiveState(queuedRun);
  s = applyRunEvent(s, ev(1, { type: 'stage.started', stage: 'text_extraction' }));
  s = applyRunEvent(s, ev(2, { type: 'stage.progress', stage: 'text_extraction', message: 'Removendo cabeçalhos', current: 2, total: 6 }));
  expect(s.stages.text_extraction).toMatchObject({ status: 'running', lastMessage: 'Removendo cabeçalhos', current: 2, total: 6 });
  s = applyRunEvent(s, ev(3, { type: 'stage.completed', stage: 'text_extraction', durationMs: 1200, metrics: {} }));
  expect(s.stages.text_extraction.status).toBe('completed');
});
test('duplicate seq ignored', () => {});
test('run.status updates status; llm.call appended; stage.reused sets reused', () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/web test events-reducer`
Expected: FAIL

- [ ] **Step 3: Implementar a página**

- **Cabeçalho:** nome do documento, preset, badge de status, custo e duração acumulados, e um espaço reservado para as ações da Task 39.
- **Stepper vertical com as 6 etapas.** Ícones lucide por status:

| Status | Ícone e texto |
|---|---|
| `pending` | `Circle` |
| `running` | `Loader2` girando |
| `completed` | `CheckCircle2` |
| `reused` | `Recycle`, com o texto "reaproveitada" |
| `overridden` | `PencilLine` |
| `failed` | `XCircle` |

- Embaixo de cada etapa, a última mensagem de progresso e um `Progress` quando há `total`, além de duração, tokens e custo da etapa.
- Enquanto a run não termina, a área principal mostra skeletons. Quando termina, mostra as abas (Tasks 37 e 38).

- [ ] **Step 4: Rodar os testes e conferir no navegador**

Run: `pnpm --filter @app/web test`
Expected: PASS

Processar um TXT curto com uma chave real e conferir que o stepper avança ao vivo. Recarregar a página no meio da execução: o estado precisa voltar sem lacunas.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): add run page with live stage stepper driven by SSE"
```

### Task 37: Abas Resumo e Dados extraídos, e painel de trecho

**Files:**
- Create: `apps/web/src/features/runs/{source-sheet,use-source-sheet,fact-value}.tsx`, `apps/web/src/features/runs/tabs/{summary-tab,facts-tab}.tsx`
- Test: `apps/web/src/features/runs/fact-value.test.tsx`

**Interfaces:**
- Produces:
  - `FactValue({ fact }: { fact: Fact })`, que renderiza o valor em pt-BR conforme a categoria:
    - `date` → `24/03/2025 (julgamento)`;
    - `deadline` → `15 dias úteis, a partir de intimação`;
    - `monetary_value` → `R$ 10.000,00`;
    - `obligation` → `{bearer} deve {action}`, `não deve` ou `pode`;
    - `decision` → rótulo do resultado e "unânime" ou "por maioria";
    - `legal_reference` → a `citation`;
    - `amendment` → `{alterou | acrescentou | revogou} {targetProvision} de {targetAct}`;
  - `SourceSheetProvider` e `useSourceSheet(): { open(span: { start: number; end: number; page: number | null }): void }`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
test.each(factsOfEveryCategory)('FactValue renders $category', (fact, expected) => {
  render(<FactValue fact={fact} />); expect(screen.getByText(expected)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/web test fact-value`
Expected: FAIL

- [ ] **Step 3: Implementar**

- **`SourceSheet`:** `Sheet` à direita, largo, com o texto canônico vindo de `useRunText`. O intervalo pedido aparece num `<mark>`, a rolagem vai até ele (`scrollIntoView({ block: 'center' })`) e um badge mostra a página.
- **Aba Resumo:**
  - título, o overview num destaque ("Em resumo") e as seções;
  - em cada parágrafo, chips com o ID dos fatos citados (tooltip com rótulo e valor);
  - parágrafo com alerta ganha sublinhado na cor da severidade; parágrafo com `highlighted` em `supportByParagraph` ganha sublinhado pontilhado com tooltip "Pouco respaldo semântico no documento";
  - glossário;
  - linha de métricas: legibilidade "original → resumo" e compressão "x vezes menor".
- **Aba Dados extraídos:**
  - filtros por categoria (`Select`) e status (todos, confirmados, incertos);
  - fatos agrupados por categoria;
  - tabela com Rótulo, Valor, Confiança, Status (badge, com os motivos num tooltip), Seção e "Ver trecho" (desabilitado se nenhuma evidência foi ancorada);
  - um card "Não encontrado no documento" com `notFound` e um card de ambiguidades.

- [ ] **Step 4: Rodar os testes e conferir no navegador**

Run: `pnpm --filter @app/web test`
Expected: PASS

Numa run concluída, "Ver trecho" precisa abrir o painel no trecho certo.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): add summary and extracted data tabs with source excerpt sheet"
```

### Task 38: Abas Verificação, Documento e Logs

**Files:**
- Create: `apps/web/src/features/runs/{text-segments,metric-card,alert-item,llm-call-sheet}.tsx`, `apps/web/src/features/runs/tabs/{verification-tab,document-tab,logs-tab}.tsx`
- Test: `apps/web/src/features/runs/text-segments.test.ts`

**Interfaces:**
- Produces:
  - `buildTextSegments(textLength: number, ranges: { start: number; end: number; className: string }[]): { start: number; end: number; classNames: string[] }[]`, que cobre `[0, textLength)` sem buracos e une as classes dos intervalos sobrepostos;
  - `coverageClass(score: number, highlighted: boolean): string`, com 5 faixas de opacidade e um tom vermelho quando `highlighted`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('segments split on overlaps', () =>
  expect(buildTextSegments(10, [{ start: 2, end: 6, className: 'a' }, { start: 4, end: 8, className: 'b' }])).toEqual([
    { start: 0, end: 2, classNames: [] }, { start: 2, end: 4, classNames: ['a'] }, { start: 4, end: 6, classNames: ['a', 'b'] },
    { start: 6, end: 8, classNames: ['b'] }, { start: 8, end: 10, classNames: [] },
  ]));
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/web test text-segments`
Expected: FAIL

- [ ] **Step 3: Implementar**

- **Aba Verificação:**
  - quatro `MetricCard`:
    - o índice de similaridade escolhido em `headline`, com o tooltip "Similaridade mede proximidade de assunto, não exatidão dos fatos. Confira os alertas abaixo.";
    - `factualConsistency`;
    - `claimSupport`;
    - `unverifiableCount`.
  - alertas agrupados por severidade. Cada `AlertItem` tem título, explicação, "O documento diz" (trechos com "Ver trecho") e "O resumo diz" (o parágrafo).
  - uma seção recolhível "Não incluídos no resumo" com os itens `omitted` e `unverifiable` que não geraram alerta.
- **Aba Documento:**
  - índice de seções à esquerda (clique rola até a seção);
  - texto com destaque das evidências ancoradas e um `Switch` "Mapa de cobertura" que aplica `coverageClass` por chunk;
  - sub-aba "Removido na limpeza" com uma tabela por regra (contagem), `charsBefore` → `charsAfter` e as linhas removidas agrupadas por regra.
- **Aba Logs:**
  - linha do tempo com os eventos do estado ao vivo;
  - tabela de `LlmCallSummaryDto` (agente, modelo, tentativa, status, tokens, custo, latência). Clicar numa linha abre o `LlmCallSheet`, que mostra parâmetros, mensagens, resposta bruta e saída validada em JSON formatado, com quebra de linha.

- [ ] **Step 4: Rodar os testes e conferir no navegador**

Run: `pnpm --filter @app/web test`
Expected: PASS

Conferir as três abas numa run concluída, nos temas claro e escuro.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): add verification, document heatmap and logs tabs"
```

### Task 39: Formulário de config e ações da execução

**Files:**
- Create: `apps/web/src/features/runs/config-form/{pipeline-config-form,model-slot-field,config-diff}.tsx`
- Create: `apps/web/src/features/runs/{rerun-dialog,export-menu,run-error-card,cancel-button,resume-card}.tsx`
- Test: `apps/web/src/features/runs/config-form/config-diff.test.ts`

**Interfaces:**
- Consumes: `PipelineConfig`, `STAGE_ORDER`, `earliestStageAffected`, `ProvidersDto`.
- Produces:
  - `diffConfig(a: PipelineConfig, b: PipelineConfig): { path: string; before: unknown; after: unknown }[]` (caminhos com ponto, como `summarization.targetLength`; arrays comparados inteiros);
  - `buildOverrides(base: PipelineConfig, edited: PipelineConfig): DeepPartial<PipelineConfig>`;
  - `CONFIG_BLOCK_STAGE: Record<string, StageName>` (os mesmos blocos de `earliestStageAffected`);
  - `PipelineConfigForm({ form, providers, editableStages, readOnly }: { form: UseFormReturn<PipelineConfig>; providers: ProvidersDto; editableStages: StageName[]; readOnly?: boolean })`:
    - um `Accordion` com os blocos Modelos, Extração e limpeza, Classificação e extração, Resumo, Similaridade e Verificação;
    - cada slot de modelo tem um `Select` (só modelos `language` de providers configurados), `temperature` (desabilitado se `!supportsTemperature`) e `reasoningEffort` (desabilitado se `!supportsReasoningEffort`);
    - campos com rótulo e texto de ajuda em pt-BR;
    - blocos fora de `editableStages` ficam desabilitados;
    - botão "Ver JSON".

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('diff and overrides', () => {
  const base = parsePipelineConfig({});
  const edited = mergeConfig(base, { summarization: { targetLength: 'short' } });
  expect(diffConfig(base, edited)).toEqual([{ path: 'summarization.targetLength', before: 'medium', after: 'short' }]);
  expect(buildOverrides(base, edited)).toEqual({ summarization: { targetLength: 'short' } });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/web test config-diff`
Expected: FAIL

- [ ] **Step 3: Implementar o formulário e as ações**

- **`RerunDialog`:**
  - um `Select` com `fromStage`, listando só as etapas cujas anteriores estão concluídas;
  - o formulário vem com `editableStages` = etapas a partir de `fromStage`;
  - ao enviar, faz `POST /runs/:id/rerun` com `buildOverrides` e navega para a run nova.
- **`ExportMenu`:** dropdown com "JSON" e "CSV (ZIP)", que apontam para `/api/runs/:id/export?format=...`. Fica desabilitado se a run não está `completed`.
- **`RunErrorCard`:** mostra a etapa, a `userMessage` e o código, e o botão "Tentar de novo a partir desta etapa", que faz um rerun sem overrides a partir da etapa que falhou.
- **`CancelButton`:** aparece em `queued` e `running`.
- **`ResumeCard`:** para runs `interrupted`, oferece "Retomar", que faz um rerun a partir da primeira etapa não concluída.

- [ ] **Step 4: Rodar os testes e conferir no navegador**

Run: `pnpm --filter @app/web test`
Expected: PASS

Conferir no navegador:
- reprocessar a partir de "Resumo" com `targetLength: short`: as etapas 1 e 2 aparecem como reaproveitadas;
- exportar o JSON e o ZIP;
- provocar uma falha (preset com chave inválida) e usar "Tentar de novo".

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): add pipeline config form, rerun dialog, export, cancel and error recovery"
```

### Task 40: Página de presets

**Files:**
- Create: `apps/web/src/routes/presets.tsx`, `apps/web/src/features/presets/{queries,presets-page,preset-editor}.tsx`
- Test: `apps/web/src/features/presets/preset-editor.test.tsx`

**Interfaces:**
- Consumes: `PipelineConfigForm` e `PresetDto`.
- Produces: `applyApiIssues(form: UseFormReturn<PipelineConfig>, error: ApiError): void`, que transforma os `path` das issues do Zod em `form.setError` (o prefixo `config.` é removido).

- [ ] **Step 1: Escrever o teste que falha**

```tsx
test('API validation issue appears under the field', async () => {
  // mutação rejeita com ApiError 400 VALIDATION_ERROR, details.issues[0].path = ['config','models','extraction','model']
  // espera a mensagem de erro dentro do campo "Modelo de extração"
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/web test preset-editor`
Expected: FAIL

- [ ] **Step 3: Implementar a página**

- **Cards:** nome, slug, descrição, badge "Padrão" para os built-in e badges com os providers necessários.
- **Ações:** "Novo preset" (começa com os padrões), editar (todas as etapas editáveis; os built-in ficam só leitura e mostram um botão "Duplicar") e excluir com diálogo de confirmação (só presets personalizados).
- **Erros da API:** `applyApiIssues` exibe cada erro no campo correspondente.

- [ ] **Step 4: Rodar os testes e conferir no navegador**

Run: `pnpm --filter @app/web test`
Expected: PASS

Conferir no navegador: duplicar `openai-default`, editar o `targetLength`, salvar e processar um documento com o preset novo.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): add presets page with editor, duplication and validation feedback"
```

### Task 41: Página de comparação

**Files:**
- Create: `apps/web/src/routes/compare.tsx`, `apps/web/src/features/compare/{compare-page,run-picker,metrics-chart,parse-runs-param}.tsx`
- Test: `apps/web/src/features/compare/parse-runs-param.test.ts`

**Interfaces:**
- Produces: `parseRunsParam(value: unknown): [string, string] | null` (aceita `"a,b"` com dois UUIDs distintos).

- [ ] **Step 1: Escrever o teste que falha**

```ts
test('parseRunsParam', () => {
  expect(parseRunsParam(`${A},${B}`)).toEqual([A, B]);
  expect(parseRunsParam(`${A}`)).toBeNull(); expect(parseRunsParam(`${A},${A}`)).toBeNull(); expect(parseRunsParam(undefined)).toBeNull();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/web test parse-runs-param`
Expected: FAIL

- [ ] **Step 3: Implementar a página**

- **Sem parâmetro válido:** mostra o `RunPicker` (escolhe o documento, depois duas runs concluídas).
- **Com parâmetro válido:**
  - cabeçalho de cada run (preset, data, status);
  - tabela de `diffConfig` entre os dois snapshots;
  - gráfico de barras com `alignmentF1`, `factualConsistency`, `claimSupport`, legibilidade do resumo e custo;
  - os dois resumos lado a lado;
  - alertas por severidade, custo e latência.
- O botão "Comparar" no cabeçalho da execução (Task 36) abre o picker já com a run atual selecionada.

- [ ] **Step 4: Rodar os testes e conferir no navegador**

Run: `pnpm --filter @app/web test`
Expected: PASS

Comparar uma run de `openai-default` com uma de `budget` do mesmo documento.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): add run comparison page with config diff and metrics chart"
```

---

## Fase 10 — Avaliação e entrega

### Task 42: `eval:corpus`

**Files:**
- Create: `apps/api/src/cli/{eval-corpus,http-client}.ts`, `apps/api/src/cli/report/{aggregate,write}.ts`
- Modify: `package.json` na raiz (script `eval:corpus`)
- Test: `apps/api/src/cli/report/aggregate.test.ts`

**Interfaces:**
- Consumes: rotas da API, `parseCorpusManifest`.
- Produces:
  - `createApiClient(baseUrl: string)`, um cliente tipado com os DTOs de `@app/shared`;
  - `EvalRow` com os campos do spec §13.2, mais `key`, `preset`, `runId` e `status`;
  - `pearson(xs: number[], ys: number[]): number | null` (devolve `null` com menos de 3 pares ou variância zero);
  - `crossMatrixStats(matrix: number[][]): { diagonalMean: number; offDiagonalMean: number; diagonalIsRowMaxRate: number }`;
  - `aggregate(rows: EvalRow[], manifest: CorpusManifestEntry[]): EvalSummary`, com médias por preset, acurácia de classificação contra `expectedType` e correlação `alignmentF1` × `factualConsistency` por preset;
  - `writeReport(dir: string, data: { rows: EvalRow[]; summary: EvalSummary; cross: Record<string, CrossSimilarityDto> }): Promise<void>`, que grava `results.json`, `results.csv` e `summary.md` (tabelas em pt-BR).

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('pearson', () => { expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1); expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull(); expect(pearson([1, 2], [1, 2])).toBeNull(); });
test('crossMatrixStats', () => expect(crossMatrixStats([[0.9, 0.5], [0.4, 0.8]])).toEqual({ diagonalMean: 0.85, offDiagonalMean: 0.45, diagonalIsRowMaxRate: 1 }));
test('classification accuracy uses manifest expectedType', () => {});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/api test src/cli/report`
Expected: FAIL

- [ ] **Step 3: Implementar a CLI**

- **Argumentos:** `--preset <slug>` (repetível, obrigatório), `--only <key>` (repetível), `--api <url>` (padrão `http://localhost:3333`), `--concurrency <n>` (padrão 2), `--yes` (pula a confirmação).
- **Fluxo:**
  1. Lista os documentos com `source: corpus` e aplica o filtro.
  2. Mostra quantas runs serão criadas e pede confirmação no terminal, a menos que `--yes` tenha sido passado.
  3. Cria as runs com `label: 'eval-corpus'`.
  4. Acompanha cada run com `GET /runs/:id` a cada 3 s até um status terminal. Polling é aceitável aqui, porque é uma CLI.
  5. Coleta `result` e `run`, chama `/analysis/cross-similarity` por preset e grava tudo em `reports/<ISO com ':' trocado por '-'>/`.

- [ ] **Step 4: Rodar os testes**

Run: `pnpm --filter @app/api test src/cli`
Expected: PASS

- [ ] **Step 5: Execução real (com o usuário)**

Antes de rodar, perguntar ao usuário se pode gastar com as chamadas de API. Com a aprovação:

Run: `pnpm eval:corpus --preset budget --only stj-resp-1969219-sp --only cnj-rec-144-2023`
Expected: `reports/<ts>/summary.md` com 2 linhas por preset e a matriz cruzada 2×2.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(eval): add corpus batch evaluation with cross-similarity and correlation report"
```

### Task 43: Injeção de falhas e `eval:faults`

**Files:**
- Create: `packages/pipeline/src/eval/faults/{index,date-shift,value-change,deadline-change,outcome-flip,omission,fabrication}.ts`, `apps/api/src/cli/eval-faults.ts`
- Modify: `package.json` na raiz (script `eval:faults`)
- Test: `packages/pipeline/src/eval/faults/faults.test.ts`

**Interfaces:**
- Consumes: parsers da Task 12, `Summary`, `Fact`, `InjectedFault`, `FaultType`.
- Produces:
  - `FAULT_TYPES: FaultType[]`;
  - `applyFault(type: FaultType, summary: Summary, facts: Fact[]): { summary: Summary; fault: InjectedFault } | null`, que devolve `null` quando a falha não se aplica;
  - `OUTCOME_FLIPS: [string, string][]` = `[['negou provimento','deu provimento'], ['negaram provimento','deram provimento'], ['não conheceu','conheceu'], ['improcedente','procedente'], ['denegou a ordem','concedeu a ordem'], ['indeferiu','deferiu']]` (vale nos dois sentidos, sem diferenciar maiúsculas, e preserva a capitalização original);
  - `FABRICATED_SENTENCE = 'O prazo para cumprimento é de 90 (noventa) dias.'`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
test('date_shift keeps format and shifts one year', () => {
  const r = applyFault('date_shift', summaryWith('Julgado em 24/03/2025.'), [dateFact('2025-03-24')])!;
  expect(text(r.summary)).toContain('24/03/2026'); expect(r.fault.expected).toEqual({ alertType: 'divergence', category: 'date' });
});
test('value_change multiplies by 10', /* 'R$ 1.000,00' → 'R$ 10.000,00' */ () => {});
test('deadline_change removes "úteis" or doubles amount', () => {});
test('outcome_flip preserves capitalization', /* 'Negou provimento' → 'Deu provimento' */ () => {});
test('omission removes paragraph citing a decision fact and empty section', () => {});
test('fabrication appends sentence and expects unsupported_claim', () => {});
test('not applicable returns null', () => expect(applyFault('value_change', summaryWith('Sem valores.'), [])).toBeNull());
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @app/pipeline test faults`
Expected: FAIL

- [ ] **Step 3: Implementar os mutadores e a CLI**

- **Regras dos mutadores:**
  - **`date_shift`:** troca a primeira data do resumo cujo `iso` coincide com algum fato, somando um ano e mantendo o formato original.
  - **`value_change`:** troca o primeiro valor monetário pelo valor × 10, no formato `R$ 1.234,56`.
  - **`deadline_change`:** no primeiro prazo, se `businessDays` for `true`, remove " úteis"; senão, dobra a quantidade, reescrevendo o número e removendo o extenso entre parênteses.
  - **`omission`:** remove o primeiro parágrafo cujos `factRefs` incluem um fato `decision`; se não houver, tenta `deadline`, depois `monetary_value`, depois `obligation`. Se a seção ficar vazia, ela também sai.
  - **`fabrication`:** acrescenta `FABRICATED_SENTENCE` ao último parágrafo da primeira seção. Não se aplica se já existir um fato de prazo de 90 dias.
  - Cada mutador preenche `fault.description` em pt-BR.
- **CLI `eval:faults`:**
  1. Argumentos: `--from-label eval-corpus`, `--preset <slug>` (opcional), `--yes`.
  2. Para cada run concluída com aquele label, aplica cada tipo de falha.
  3. Cria um rerun com `fromStage: 'similarity'`, `summaryOverride`, `label: 'eval-faults'` e `injectedFaults: [fault]`, e acompanha até terminar.
  4. A falha conta como detectada se a run nova tem um alerta com o `alertType` e a `category` esperados que não existe na run de origem. A comparação usa tipo, categoria e `sourceFactId` (ou o texto da afirmação).
  5. O relatório traz a taxa de detecção por tipo de falha e os alertas espúrios, gravados em `reports/<ts>-faults/`.

- [ ] **Step 4: Rodar os testes**

Run: `pnpm --filter @app/pipeline test faults`
Expected: PASS

- [ ] **Step 5: Execução real (com o usuário)**

Depois de uma rodada de `eval:corpus` e da aprovação do custo:

Run: `pnpm eval:faults --from-label eval-corpus`
Expected: `reports/<ts>-faults/summary.md` com a taxa de detecção por tipo de falha.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(eval): add deterministic fault injection and verifier detection report"
```

### Task 44: Imagens Docker e compose completo

**Files:**
- Create: `apps/api/Dockerfile`, `apps/api/docker-entrypoint.sh`, `apps/web/Dockerfile`, `apps/web/nginx.conf`, `.dockerignore`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces:
  - a web em `http://localhost:8080`;
  - a API em `http://localhost:3333` (também acessível por `http://localhost:8080/api`);
  - o Postgres em `localhost:5432`.

- [ ] **Step 1: Escrever os Dockerfiles e a config do nginx**

- **`apps/api/Dockerfile`** (base `node:24-alpine` com corepack):
  - `pruner`: `pnpm dlx turbo prune @app/api --docker`;
  - `installer`: copia `out/json`, roda `pnpm install --frozen-lockfile`, copia `out/full`, roda o `prisma generate` em `@app/db` e `pnpm turbo build --filter=@app/api`;
  - `runner`: copia o `dist` da API, os `node_modules` de produção, `packages/db/prisma` (schema e migrations) e `corpus/` para `/app/corpus`. Define `ENV CORPUS_DIR=/app/corpus UPLOAD_DIR=/data/uploads` e usa `docker-entrypoint.sh` como `ENTRYPOINT`.
- **`docker-entrypoint.sh`:** `set -e`, depois `prisma migrate deploy`, depois `node apps/api/dist/cli/seed.js`, depois `exec node apps/api/dist/main.js`.
- **`apps/web/Dockerfile`:** um estágio de build (prune `@app/web`, install, `pnpm turbo build --filter=@app/web`) e um estágio `nginx:alpine` com o `dist` em `/usr/share/nginx/html` e o `nginx.conf`.
- **`nginx.conf`:**
  - `location / { try_files $uri /index.html; }`;
  - `location /api/ { proxy_pass http://api:3333/; proxy_http_version 1.1; proxy_set_header Connection ''; proxy_buffering off; proxy_cache off; proxy_read_timeout 3600s; client_max_body_size 25m; }`.
- **Compose:**
  - `api`: `depends_on` com `postgres` em `service_healthy`; `env_file: .env`; `DATABASE_URL=postgresql://app:app@postgres:5432/app`; volume `uploads:/data/uploads`; porta `3333:3333`; healthcheck com `wget -qO- localhost:3333/health`;
  - `web`: `depends_on` com `api`; porta `8080:80`.

- [ ] **Step 2: Subir do zero e conferir**

Run: `docker compose down -v && docker compose up --build -d && sleep 20 && curl -s localhost:8080/api/health`
Expected: `{"status":"ok","database":"ok"}`

Abrir `http://localhost:8080`. Expected: a página de documentos lista os 20 documentos do corpus e a página de presets mostra os 4 presets.

- [ ] **Step 3: Conferir que o seed não duplica**

Run: `docker compose restart api && sleep 10 && curl -s localhost:8080/api/documents | jq length`
Expected: `20` (sem duplicatas)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(infra): add api and web docker images, nginx proxy and full compose stack"
```

### Task 45: README e verificação final

**Files:**
- Create: `README.md`
- Modify: `corpus/README.md`, se precisar

**Interfaces:**
- Produces: a documentação de entrada do projeto, em pt-BR.

- [ ] **Step 1: Escrever o README**

Seções, nesta ordem:
1. Visão geral.
2. Arquitetura, com um diagrama Mermaid `flowchart` (navegador → nginx → API → fila e runner → estágios → Postgres; providers OpenAI e Anthropic).
3. As 6 etapas, um parágrafo cada, com links para os ADRs.
4. Pré-requisitos: Docker; `OPENAI_API_KEY` obrigatória; `ANTHROPIC_API_KEY` para `anthropic-default` e `cross-verifier` (os embeddings sempre usam OpenAI).
5. Como rodar: `cp .env.example .env`, `docker compose up --build`, `http://localhost:8080`.
6. Desenvolvimento: `pnpm i`, `docker compose up -d postgres`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`.
7. Testes: `pnpm test`; os testes de integração precisam do Postgres.
8. Avaliação: `eval:corpus` e `eval:faults`, aviso de custo, onde ficam os relatórios.
9. Limitações:
   - sem OCR;
   - tabelas de anexos linearizadas;
   - Flesch heurístico;
   - similaridade não é fidelidade;
   - sem gabarito anotado.
10. Estrutura do repositório.
11. Link para `docs/adr/`.

- [ ] **Step 2: Verificação completa**

Usar a skill superpowers:verification-before-completion.

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: tudo PASS

- [ ] **Step 3: Verificação ponta a ponta (com o usuário, por causa do custo)**

Com `docker compose up --build`:
1. Processar 1 acórdão do STJ e 1 ato do CNJ com `openai-default`.
2. Conferir o stepper ao vivo, as cinco abas, "Ver trecho", a exportação em JSON e CSV, o reprocessamento a partir do resumo e a comparação.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: add project README with setup, architecture and evaluation guide"
```
