import {
  CLAIM_VERDICTS,
  type InformationExtractionOutput,
  type SimilarityOutput,
  SOURCE_VERDICTS,
  type SummarizationOutput,
  type TextExtractionOutput,
  type VerificationItem,
  VerificationOutput,
} from '@app/shared';
import { verifierAgent } from '../../agents/verifier/agent';
import { runAgent } from '../../core/agent';
import { mapWithConcurrency } from '../../core/concurrency';
import type { StageContext } from '../../core/context';
import type { Stage } from '../../core/stage';
import { dot, normalizeVector } from '../similarity/metrics';
import { buildAlerts } from './alerts';
import { extractClaims } from './claims';
import { buildItems, type PendingItem } from './items';
import { computeVerificationMetrics } from './metrics';
import { pairClaims, type Retrieved } from './pairing';

export interface VerificationInput {
  text: TextExtractionOutput;
  info: InformationExtractionOutput;
  summarization: SummarizationOutput;
  similarity: SimilarityOutput;
}

function retriever(input: VerificationInput, ctx: StageContext) {
  const { canonicalText } = input.text;
  const chunks = input.similarity.sourceChunks;
  const options = { model: ctx.config.similarity.embeddingModel, dimensions: ctx.config.similarity.dimensions };
  return async (texts: string[]): Promise<Retrieved[][]> => {
    if (ctx.config.verification.retrievalTopK === 0 || chunks.length === 0) return texts.map(() => []);
    // The source chunks were embedded by the similarity stage; the embedder's cache makes this re-embedding free.
    const chunkVectors = (
      await ctx.embedder.embed(
        chunks.map((c) => canonicalText.slice(c.start, c.end)),
        options,
      )
    ).map(normalizeVector);
    const claimVectors = (await ctx.embedder.embed(texts, options)).map(normalizeVector);
    return claimVectors.map((v) =>
      chunks
        .map((c, i) => ({ chunkId: c.id, start: c.start, end: c.end, score: dot(v, chunkVectors[i] as number[]) }))
        .sort((a, b) => b.score - a.score),
    );
  };
}

async function runVerifier(pending: PendingItem[], ctx: StageContext): Promise<VerificationItem[]> {
  const { batchSize } = ctx.config.verification;
  const batches: PendingItem[][] = [];
  for (let i = 0; i < pending.length; i += batchSize) batches.push(pending.slice(i, i + batchSize));
  let done = 0;
  const results = await mapWithConcurrency(
    batches,
    ctx.llmConcurrency,
    async (batch) => {
      const { verdicts } = await runAgent(verifierAgent, { items: batch }, ctx);
      ctx.events.progress(`Verificando itens: lote ${++done}/${batches.length}`, done, batches.length);
      return batch.map((item): VerificationItem => {
        const base = {
          id: item.itemId,
          direction: item.direction,
          factId: item.factId,
          claimId: item.claimId,
          decidedBy: 'llm' as const,
        };
        const answer = verdicts.find((v) => v.itemId === item.itemId);
        if (!answer)
          return {
            ...base,
            verdict: 'unverifiable',
            explanation: 'O verificador não retornou veredito para este item.',
            usedQuotes: [],
          };
        const allowed = item.direction === 'source_to_summary' ? SOURCE_VERDICTS : CLAIM_VERDICTS;
        if (!allowed.includes(answer.verdict)) {
          ctx.events.warn(
            'verifier_invalid_verdict',
            `O verificador usou o veredito "${answer.verdict}", inválido para ${item.direction}, no item ${item.itemId}.`,
          );
          return { ...base, verdict: 'unverifiable', explanation: answer.explanation, usedQuotes: answer.usedQuotes };
        }
        return { ...base, verdict: answer.verdict, explanation: answer.explanation, usedQuotes: answer.usedQuotes };
      });
    },
    ctx.signal,
  );
  return results.flat();
}

export const verificationStage: Stage<VerificationInput, VerificationOutput> = {
  name: 'verification',
  output: VerificationOutput,
  async run(input, ctx) {
    const config = ctx.config.verification;
    const { summary } = input.summarization;
    const { facts, classification } = input.info;
    const isAmendmentDoc = classification.subtype === 'amendment';
    const critical = isAmendmentDoc ? [...config.criticalCategories, 'amendment' as const] : config.criticalCategories;

    const claims = await extractClaims(summary, ctx);
    ctx.events.progress('Pareando afirmações e fatos');
    const pairings = await pairClaims(claims, facts, summary, retriever(input, ctx), config.retrievalTopK);
    const { decided, pending } = buildItems({
      facts,
      claims,
      pairings,
      summary,
      text: input.text.canonicalText,
      chunks: input.similarity.sourceChunks,
      deterministicFirst: config.deterministicFirst,
      directions: config.directions,
    });
    const judged = pending.length > 0 ? await runVerifier(pending, ctx) : [];
    const items = [...decided, ...judged].sort((a, b) => a.id.localeCompare(b.id));
    return {
      claims,
      items,
      alerts: buildAlerts(items, facts, claims, { critical: config.criticalCategories, isAmendmentDoc }),
      metrics: computeVerificationMetrics(items, facts, critical),
    };
  },
};
