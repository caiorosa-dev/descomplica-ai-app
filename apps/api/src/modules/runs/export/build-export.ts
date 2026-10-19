import type { PrismaClient } from '@app/db';
import { parsePipelineConfig, type RunExportV1 } from '@app/shared';
import { notFound } from '../../../http-error';
import { loadStageOutputs } from '../../../runtime/persistence/load-outputs';
import { runUsage } from '../../../runtime/pipeline-runner';

export async function buildRunExport(prisma: PrismaClient, runId: string): Promise<RunExportV1> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { document: true, preset: { select: { slug: true } } },
  });
  if (!run) throw notFound('Execução');
  const outputs = await loadStageOutputs(prisma, runId);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    document: {
      id: run.document.id,
      filename: run.document.filename,
      sha256: run.document.sha256,
      source: run.document.source,
      corpusKey: run.document.corpusKey,
    },
    run: {
      id: run.id,
      status: run.status,
      presetSlug: run.preset?.slug ?? null,
      parentRunId: run.parentRunId,
      label: run.label,
      configHash: run.configHash,
      config: parsePipelineConfig(run.config),
    },
    classification: outputs.information_extraction?.classification ?? null,
    facts: outputs.information_extraction?.facts ?? [],
    summary: outputs.summarization ?? null,
    metrics: outputs.report ?? null,
    claims: outputs.verification?.claims ?? [],
    verificationItems: outputs.verification?.items ?? [],
    alerts: outputs.verification?.alerts ?? [],
    costs: await runUsage(prisma, runId),
  };
}
