import {
  LlmCallDto,
  LlmCallSummaryDto,
  RerunBody,
  RunDto,
  type RunResultDto,
  RunResultDto as RunResultSchema,
  RunTextDto,
} from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { HttpError, notFound } from '../../http-error';
import { loadStageOutputs } from '../../runtime/persistence/load-outputs';
import { IdParams } from '../documents/routes';
import { createRerunService } from './rerun';

const CallParams = z.object({ id: z.string().uuid(), callId: z.string().uuid() });

export async function runResultRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const reruns = createRerunService({ prisma: app.prisma, env: app.env, queue: app.runQueue });
  const ensureRun = async (id: string) => {
    if (!(await app.prisma.run.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Execução');
  };

  r.post(
    '/runs/:id/rerun',
    { schema: { params: IdParams, body: RerunBody, response: { 202: RunDto } } },
    async (request, reply) => reply.status(202).send(await reruns.rerun(request.params.id, request.body)),
  );

  r.get(
    '/runs/:id/result',
    { schema: { params: IdParams, response: { 200: RunResultSchema } } },
    async (request): Promise<RunResultDto> => {
      await ensureRun(request.params.id);
      const o = await loadStageOutputs(app.prisma, request.params.id);
      return {
        classification: o.information_extraction?.classification ?? null,
        sections: o.information_extraction?.sections ?? [],
        facts: o.information_extraction?.facts ?? [],
        notFound: o.information_extraction?.notFound ?? [],
        ambiguities: o.information_extraction?.ambiguities ?? [],
        summary: o.summarization ?? null,
        similarity: o.similarity ? { metrics: o.similarity.metrics, headline: o.similarity.headline } : null,
        claims: o.verification?.claims ?? [],
        items: o.verification?.items ?? [],
        alerts: o.verification?.alerts ?? [],
        metrics: o.report ?? null,
      };
    },
  );

  r.get('/runs/:id/text', { schema: { params: IdParams, response: { 200: RunTextDto } } }, async (request) => {
    await ensureRun(request.params.id);
    const o = await loadStageOutputs(app.prisma, request.params.id);
    if (!o.text_extraction)
      throw new HttpError(409, 'RUN_NOT_COMPLETED', 'O texto ainda não foi extraído nesta execução.');
    const chunks = new Map((o.similarity?.sourceChunks ?? []).map((c) => [c.id, c]));
    return {
      canonicalText: o.text_extraction.canonicalText,
      pageMap: o.text_extraction.pageMap,
      sections: o.information_extraction?.sections ?? [],
      cleaningReport: o.text_extraction.cleaningReport,
      coverageByChunk: o.similarity
        ? o.similarity.coverageByChunk.map((c) => ({
            ...c,
            start: chunks.get(c.chunkId)?.start ?? 0,
            end: chunks.get(c.chunkId)?.end ?? 0,
          }))
        : null,
      supportByParagraph: o.similarity?.supportByParagraph ?? null,
    };
  });

  const summaryOf = (c: {
    id: string;
    agent: string;
    agentVersion: string;
    model: string;
    attempt: number;
    status: 'success' | 'error';
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
    createdAt: Date;
  }) => ({
    id: c.id,
    agent: c.agent,
    agentVersion: c.agentVersion,
    model: c.model,
    attempt: c.attempt,
    status: c.status,
    inputTokens: c.inputTokens,
    outputTokens: c.outputTokens,
    costUsd: c.costUsd,
    latencyMs: c.latencyMs,
    createdAt: c.createdAt.toISOString(),
  });

  r.get(
    '/runs/:id/llm-calls',
    { schema: { params: IdParams, response: { 200: z.array(LlmCallSummaryDto) } } },
    async (request) => {
      await ensureRun(request.params.id);
      const calls = await app.prisma.llmCall.findMany({
        where: { runId: request.params.id },
        orderBy: { createdAt: 'asc' },
      });
      return calls.map(summaryOf);
    },
  );

  r.get(
    '/runs/:id/llm-calls/:callId',
    { schema: { params: CallParams, response: { 200: LlmCallDto } } },
    async (request) => {
      const call = await app.prisma.llmCall.findFirst({
        where: { id: request.params.callId, runId: request.params.id },
      });
      if (!call) throw notFound('Chamada');
      return {
        ...summaryOf(call),
        params: call.params,
        messages: call.messages,
        rawResponse: call.rawResponse,
        parsedOutput: call.parsedOutput,
        error: call.error,
      };
    },
  );
}
