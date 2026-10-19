import { z } from 'zod';
import { Confidence, Direction, DocumentType, FactCategory } from '../domain/enums';
import { SimilarityHeadline } from '../domain/similarity';
import { findModel, MODEL_REFS } from './catalog';

export const ReasoningEffort = z.enum(['low', 'medium', 'high']);
export type ReasoningEffort = z.infer<typeof ReasoningEffort>;

export const AgentRole = z.enum([
  'cleaning',
  'classification',
  'extraction',
  'summarization',
  'claimExtraction',
  'verification',
]);
export type AgentRole = z.infer<typeof AgentRole>;

export const ModelSettings = z.object({
  model: z.string(),
  temperature: z.number().min(0).max(2).nullable(),
  reasoningEffort: ReasoningEffort.nullable(),
  maxOutputTokens: z.number().int().positive().nullable(),
});
export type ModelSettings = z.infer<typeof ModelSettings>;

export const BoilerplatePatternSet = z.enum(['stj-e-signature', 'dje-header']);
export type BoilerplatePatternSet = z.infer<typeof BoilerplatePatternSet>;

/** Slot schema whose missing fields fall back to the slot's defaults (spec §4.3). */
function modelSlot(model: string, temperature: number, reasoningEffort: ReasoningEffort) {
  return z
    .object({
      model: ModelSettings.shape.model.default(model),
      temperature: ModelSettings.shape.temperature.default(temperature),
      reasoningEffort: ModelSettings.shape.reasoningEffort.default(reasoningEffort),
      maxOutputTokens: ModelSettings.shape.maxOutputTokens.default(null),
    })
    .prefault({});
}

const main = MODEL_REFS.openaiMain;
const small = MODEL_REFS.openaiSmall;

const ModelsConfig = z
  .object({
    cleaning: modelSlot(small, 0, 'low'),
    classification: modelSlot(small, 0, 'low'),
    extraction: modelSlot(main, 0, 'medium'),
    summarization: modelSlot(main, 0.3, 'medium'),
    claimExtraction: modelSlot(small, 0, 'low'),
    verification: modelSlot(main, 0, 'medium'),
  })
  .prefault({});

const TextExtractionConfig = z
  .object({
    maxFileSizeMb: z.number().positive().default(20),
    minCharsPerPage: z.number().int().min(0).default(200),
    pdf: z
      .object({
        edgeBandRatio: z.number().min(0).max(0.5).default(0.1),
        repeatThreshold: z.number().gt(0).max(1).default(0.5),
      })
      .prefault({}),
    html: z.object({ dropStrikethrough: z.boolean().default(true) }).prefault({}),
    cleaning: z
      .object({
        normalizeUnicode: z.boolean().default(true),
        removeRepeatedHeadersFooters: z.boolean().default(true),
        removePageNumbers: z.boolean().default(true),
        boilerplatePatternSets: z.array(BoilerplatePatternSet).default(['stj-e-signature', 'dje-header']),
        dehyphenate: z.boolean().default(true),
        rebuildParagraphs: z.boolean().default(true),
        llmCleanup: z.enum(['off', 'edges', 'full']).default('off'),
      })
      .prefault({}),
  })
  .prefault({});

const ClassificationConfig = z
  .object({ mode: z.union([z.literal('auto'), DocumentType]).default('auto') })
  .prefault({});

const ExtractionConfig = z
  .object({
    strategy: z.enum(['single_pass', 'chunked']).default('single_pass'),
    maxSinglePassTokens: z.number().int().positive().default(60_000),
    chunkTokens: z.number().int().positive().default(6_000),
    overlapTokens: z.number().int().min(0).default(400),
    agentSplit: z.enum(['unified', 'per_category']).default('unified'),
    categories: z
      .array(FactCategory)
      .min(1)
      .default(['date', 'deadline', 'monetary_value', 'obligation', 'decision', 'legal_reference']),
    grounding: z.object({ fuzzyThreshold: z.number().min(0).max(1).default(0.9) }).prefault({}),
    minConfidence: Confidence.default('medium'),
  })
  .prefault({});

const SummarizationConfig = z
  .object({
    audience: z.enum(['layperson', 'professional']).default('layperson'),
    targetLength: z.enum(['short', 'medium', 'long']).default('medium'),
    strategy: z.enum(['direct', 'hierarchical']).default('direct'),
    maxDirectTokens: z.number().int().positive().default(60_000),
    useExtractedFacts: z.boolean().default(true),
    uncertainFacts: z.enum(['omit', 'hedge']).default('hedge'),
    includeGlossary: z.boolean().default(true),
  })
  .prefault({});

const SimilarityConfig = z
  .object({
    embeddingModel: z.string().default(MODEL_REFS.embeddingSmall),
    dimensions: z.number().int().positive().nullable().default(null),
    chunking: z
      .object({
        method: z.enum(['structural', 'fixed']).default('structural'),
        maxTokens: z.number().int().positive().default(512),
        overlapTokens: z.number().int().min(0).default(64),
      })
      .prefault({}),
    headline: SimilarityHeadline.default('alignment_f1'),
    highlightBottomPercent: z.number().min(0).max(100).default(20),
  })
  .prefault({});

const VerificationConfig = z
  .object({
    directions: z.array(Direction).min(1).default(['source_to_summary', 'summary_to_source']),
    deterministicFirst: z.boolean().default(true),
    retrievalTopK: z.number().int().min(0).default(3),
    batchSize: z.number().int().positive().default(10),
    criticalCategories: z.array(FactCategory).default(['decision', 'deadline', 'monetary_value', 'obligation']),
  })
  .prefault({});

export const PipelineConfig = z
  .object({
    models: ModelsConfig,
    textExtraction: TextExtractionConfig,
    classification: ClassificationConfig,
    extraction: ExtractionConfig,
    summarization: SummarizationConfig,
    similarity: SimilarityConfig,
    verification: VerificationConfig,
  })
  .superRefine((config, ctx) => {
    for (const role of AgentRole.options) {
      const ref = config.models[role].model;
      const entry = findModel(ref);
      const path = ['models', role, 'model'];
      if (!entry) ctx.addIssue({ code: 'custom', path, message: `Modelo desconhecido: ${ref}` });
      else if (entry.kind !== 'language')
        ctx.addIssue({ code: 'custom', path, message: `${ref} não é um modelo de geração de texto` });
      else if (!entry.supportsStructuredOutput)
        ctx.addIssue({ code: 'custom', path, message: `${ref} não suporta saída estruturada` });
    }
    const embedding = findModel(config.similarity.embeddingModel);
    if (embedding?.kind !== 'embedding')
      ctx.addIssue({
        code: 'custom',
        path: ['similarity', 'embeddingModel'],
        message: `${config.similarity.embeddingModel} não é um modelo de embedding`,
      });
    if (config.extraction.overlapTokens >= config.extraction.chunkTokens)
      ctx.addIssue({
        code: 'custom',
        path: ['extraction', 'overlapTokens'],
        message: 'A sobreposição precisa ser menor que o tamanho do chunk',
      });
    if (config.similarity.chunking.overlapTokens >= config.similarity.chunking.maxTokens)
      ctx.addIssue({
        code: 'custom',
        path: ['similarity', 'chunking', 'overlapTokens'],
        message: 'A sobreposição precisa ser menor que o tamanho do chunk',
      });
  });

export type PipelineConfig = z.output<typeof PipelineConfig>;
export type PipelineConfigInput = z.input<typeof PipelineConfig>;

export function parsePipelineConfig(input: unknown): PipelineConfig {
  return PipelineConfig.parse(input ?? {});
}
