import { createHash } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai';
import type { PrismaClient } from '@app/db';
import { type Embedder, type EmbeddingCallRecord, isQuotaExceeded, PipelineError } from '@app/pipeline';
import { estimateCostUsd } from '@app/shared';
import { APICallError, embedMany, RetryError } from 'ai';
import type { Env } from '../../env';

export type EmbedManyFn = (args: {
  model: string;
  values: string[];
  dimensions: number | null;
}) => Promise<{ embeddings: number[][]; tokens: number }>;

const BATCH_SIZE = 100;

/** Embeddings always go through OpenAI (Anthropic has no embeddings API; spec §4.2). */
export function defaultEmbedMany(env: Env): EmbedManyFn {
  return async ({ model, values, dimensions }) => {
    if (!env.OPENAI_API_KEY)
      throw new PipelineError('PROVIDER_NOT_CONFIGURED', 'Embeddings need OPENAI_API_KEY', { provider: 'openai' });
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    try {
      const result = await embedMany({
        model: openai.embeddingModel(model.slice(model.indexOf(':') + 1)),
        values,
        maxRetries: 2,
        ...(dimensions ? { dimensions } : {}),
      });
      return { embeddings: result.embeddings, tokens: result.usage.tokens };
    } catch (error) {
      const apiError = APICallError.isInstance(error)
        ? error
        : RetryError.isInstance(error) && APICallError.isInstance(error.lastError)
          ? error.lastError
          : null;
      if (apiError && isQuotaExceeded(apiError))
        throw new PipelineError('PROVIDER_QUOTA_EXCEEDED', apiError.message, { statusCode: apiError.statusCode });
      throw error;
    }
  };
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** Embedder port with a database cache keyed by (model, dimensions ?? 0, sha256(text)); misses go out in batches of 100. */
export function createEmbedder(deps: {
  prisma: PrismaClient;
  embedMany: EmbedManyFn;
  onCall: (record: EmbeddingCallRecord) => Promise<void>;
}): Embedder {
  return {
    async embed(texts, options) {
      const started = Date.now();
      const dimensions = options.dimensions ?? 0;
      const hashes = texts.map(sha256);
      const unique = [...new Set(hashes)];
      const cached = await deps.prisma.embeddingCache.findMany({
        where: { model: options.model, dimensions, textHash: { in: unique } },
      });
      const vectors = new Map(cached.map((row) => [row.textHash, row.vector]));
      const missing = unique.filter((h) => !vectors.has(h));
      const textOf = new Map(hashes.map((h, i) => [h, texts[i] as string]));
      let tokens = 0;
      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        const result = await deps.embedMany({
          model: options.model,
          values: batch.map((h) => textOf.get(h) as string),
          dimensions: options.dimensions,
        });
        tokens += result.tokens;
        await deps.prisma.embeddingCache.createMany({
          data: batch.map((textHash, k) => ({
            model: options.model,
            dimensions,
            textHash,
            vector: result.embeddings[k] as number[],
          })),
          skipDuplicates: true,
        });
        for (const [k, h] of batch.entries()) vectors.set(h, result.embeddings[k] as number[]);
      }
      await deps.onCall({
        model: options.model,
        inputCount: texts.length,
        tokens,
        cacheHits: texts.length - hashes.filter((h) => missing.includes(h)).length,
        costUsd: estimateCostUsd(options.model, tokens),
        latencyMs: Date.now() - started,
      });
      return hashes.map((h) => vectors.get(h) as number[]);
    },
  };
}
