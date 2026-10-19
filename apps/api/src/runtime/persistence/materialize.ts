import type { Prisma } from '@app/db';
import {
  InformationExtractionOutput,
  RunMetricsShape,
  type StageName,
  SummarizationOutput,
  VerificationOutput,
} from '@app/shared';
import { effectiveStageRunId } from './load-outputs';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const nullableJson = (value: unknown) =>
  value == null ? (null as unknown as Prisma.NullableJsonNullValueInput) : json(value);

async function factIdsByKey(tx: Prisma.TransactionClient, runId: string): Promise<Map<string, string>> {
  const info = await tx.stageRun.findUnique({ where: { runId_stage: { runId, stage: 'information_extraction' } } });
  if (!info) return new Map();
  const facts = await tx.extractedFact.findMany({
    where: { stageRunId: effectiveStageRunId(info) },
    select: { id: true, key: true },
  });
  return new Map(facts.map((f) => [f.key, f.id]));
}

/**
 * Writes the domain rows of a stage's output (spec §10), inside the caller's transaction. Rows belong to the
 * stage run, so materializing the same stage run again replaces them.
 */
export async function materializeStageOutput(
  tx: Prisma.TransactionClient,
  args: { runId: string; stageRunId: string; stage: StageName; output: unknown },
): Promise<void> {
  const { runId, stageRunId } = args;
  switch (args.stage) {
    case 'information_extraction': {
      const output = InformationExtractionOutput.parse(args.output);
      await tx.extractedFact.deleteMany({ where: { stageRunId } });
      for (const fact of output.facts)
        await tx.extractedFact.create({
          data: {
            stageRunId,
            key: fact.id,
            category: fact.category,
            label: fact.label,
            value: json(fact.value),
            confidence: fact.confidence,
            status: fact.status,
            uncertaintyReasons: fact.uncertaintyReasons,
            evidence: { create: fact.evidence.map((e, position) => ({ position, ...e })) },
          },
        });
      return;
    }
    case 'summarization': {
      const output = SummarizationOutput.parse(args.output);
      const data = {
        content: json(output.summary),
        readabilitySource: output.readability.source,
        readabilitySummary: output.readability.summary,
        compressionRatio: output.compressionRatio,
      };
      await tx.summary.upsert({ where: { stageRunId }, create: { stageRunId, ...data }, update: data });
      return;
    }
    case 'verification': {
      const output = VerificationOutput.parse(args.output);
      await tx.alert.deleteMany({ where: { stageRunId } });
      await tx.verificationItem.deleteMany({ where: { stageRunId } });
      await tx.claim.deleteMany({ where: { stageRunId } });
      const factIds = await factIdsByKey(tx, runId);
      const claimIds = new Map<string, string>();
      for (const claim of output.claims) {
        const row = await tx.claim.create({
          data: {
            stageRunId,
            key: claim.id,
            text: claim.text,
            paragraphRef: nullableJson(claim.paragraphRef),
            category: claim.category,
            value: nullableJson(claim.value),
          },
        });
        claimIds.set(claim.id, row.id);
      }
      const itemIds = new Map<string, string>();
      for (const item of output.items) {
        const row = await tx.verificationItem.create({
          data: {
            stageRunId,
            key: item.id,
            direction: item.direction,
            verdict: item.verdict,
            explanation: item.explanation,
            factId: item.factId ? (factIds.get(item.factId) ?? null) : null,
            claimId: item.claimId ? (claimIds.get(item.claimId) ?? null) : null,
            decidedBy: item.decidedBy,
            usedQuotes: json(item.usedQuotes),
          },
        });
        itemIds.set(item.id, row.id);
      }
      for (const alert of output.alerts) {
        const verificationItemId = itemIds.get(alert.verificationItemId);
        if (!verificationItemId)
          throw new Error(`Alert ${alert.id} points to unknown item ${alert.verificationItemId}`);
        await tx.alert.create({
          data: {
            stageRunId,
            verificationItemId,
            key: alert.id,
            type: alert.type,
            severity: alert.severity,
            category: alert.category,
            title: alert.title,
            explanation: alert.explanation,
            sourceEvidence: json(alert.sourceEvidence),
            summaryRef: nullableJson(alert.summaryRef),
          },
        });
      }
      return;
    }
    case 'report': {
      const metrics = RunMetricsShape.parse(args.output);
      await tx.runMetrics.upsert({ where: { runId }, create: { runId, ...metrics }, update: metrics });
      return;
    }
    default:
      return;
  }
}
