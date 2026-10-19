import { z } from 'zod';

/*
 * Model catalog. Prices are estimates in USD per million tokens, used to compare scenarios, not for billing.
 * Consulted on 2026-10-18:
 *   - https://developers.openai.com/api/docs/pricing
 *   - https://developers.openai.com/api/docs/models/gpt-5.6-sol
 *   - https://developers.openai.com/api/docs/models/gpt-5.6-luna
 *   - https://platform.claude.com/docs/en/models/overview
 *   - https://platform.claude.com/docs/en/models/sonnet-5-5/overview
 *   - https://platform.claude.com/docs/en/models/haiku-5-5/overview
 * Notes:
 *   - GPT-5.6 models are reasoning models: they take `reasoningEffort`, not `temperature`.
 *   - Claude Sonnet 5.5 and Haiku 5.5 run adaptive thinking steered by `effort`; a non-default `temperature`
 *     returns HTTP 400, so they are flagged like reasoning models.
 *   - Neither the OpenAI Responses API nor the Claude API exposes a `seed`.
 *   - Claude Haiku 5.5 doubles its price above 100k input tokens; the catalog keeps the base tier.
 */

export const Provider = z.enum(['openai', 'anthropic']);
export type Provider = z.infer<typeof Provider>;

export const ModelCatalogEntry = z.object({
  ref: z.string(),
  provider: Provider,
  kind: z.enum(['language', 'embedding']),
  label: z.string(),
  contextWindow: z.number().int(),
  supportsTemperature: z.boolean(),
  supportsReasoningEffort: z.boolean(),
  supportsStructuredOutput: z.boolean(),
  supportsSeed: z.boolean(),
  embeddingDimensions: z.number().int().nullable(),
  pricePerMTokens: z.object({ input: z.number(), output: z.number() }),
});
export type ModelCatalogEntry = z.infer<typeof ModelCatalogEntry>;

export const MODEL_REFS = {
  openaiMain: 'openai:gpt-5.6-sol',
  openaiSmall: 'openai:gpt-5.6-luna',
  anthropicMain: 'anthropic:claude-sonnet-5-5',
  anthropicSmall: 'anthropic:claude-haiku-5-5',
  embeddingSmall: 'openai:text-embedding-3-small',
  embeddingLarge: 'openai:text-embedding-3-large',
} as const;

const reasoningModel = {
  kind: 'language',
  supportsTemperature: false,
  supportsReasoningEffort: true,
  supportsStructuredOutput: true,
  supportsSeed: false,
  embeddingDimensions: null,
} as const;

const embeddingModel = {
  provider: 'openai',
  kind: 'embedding',
  contextWindow: 8191,
  supportsTemperature: false,
  supportsReasoningEffort: false,
  supportsStructuredOutput: false,
  supportsSeed: false,
} as const;

export const MODEL_CATALOG: readonly ModelCatalogEntry[] = [
  {
    ...reasoningModel,
    ref: MODEL_REFS.openaiMain,
    provider: 'openai',
    label: 'GPT-5.6 Sol',
    contextWindow: 1_050_000,
    pricePerMTokens: { input: 4, output: 20 },
  },
  {
    ...reasoningModel,
    ref: MODEL_REFS.openaiSmall,
    provider: 'openai',
    label: 'GPT-5.6 Luna',
    contextWindow: 1_050_000,
    pricePerMTokens: { input: 0.2, output: 1.2 },
  },
  {
    ...reasoningModel,
    ref: MODEL_REFS.anthropicMain,
    provider: 'anthropic',
    label: 'Claude Sonnet 5.5',
    contextWindow: 1_000_000,
    pricePerMTokens: { input: 2, output: 10 },
  },
  {
    ...reasoningModel,
    ref: MODEL_REFS.anthropicSmall,
    provider: 'anthropic',
    label: 'Claude Haiku 5.5',
    contextWindow: 1_000_000,
    pricePerMTokens: { input: 0.1, output: 0.5 },
  },
  {
    ...embeddingModel,
    ref: MODEL_REFS.embeddingSmall,
    label: 'text-embedding-3-small',
    embeddingDimensions: 1536,
    pricePerMTokens: { input: 0.02, output: 0 },
  },
  {
    ...embeddingModel,
    ref: MODEL_REFS.embeddingLarge,
    label: 'text-embedding-3-large',
    embeddingDimensions: 3072,
    pricePerMTokens: { input: 0.13, output: 0 },
  },
];

export function findModel(ref: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((m) => m.ref === ref);
}

export function providerOf(ref: string): Provider {
  const provider = Provider.safeParse(ref.split(':')[0]);
  if (!provider.success) throw new Error(`Unknown provider in model ref "${ref}"`);
  return provider.data;
}

/** Estimated cost in USD; unknown models cost 0. */
export function estimateCostUsd(ref: string, inputTokens: number, outputTokens = 0): number {
  const entry = findModel(ref);
  if (!entry) return 0;
  return (inputTokens * entry.pricePerMTokens.input + outputTokens * entry.pricePerMTokens.output) / 1_000_000;
}
