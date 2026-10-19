import { Prisma, type PrismaClient } from '@app/db';
import type { CallRecorder } from '@app/pipeline';

export interface LlmCallRow {
  id: string;
  agent: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: 'success' | 'error';
}

const json = (value: unknown) =>
  value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

/** Persists every LLM and embedding call of a stage run (spec §4.1 step 5, §10). */
export function createCallRecorder(deps: {
  prisma: PrismaClient;
  runId: string;
  getStageRunId: () => string;
  onLlmCall?: (row: LlmCallRow) => void;
}): CallRecorder {
  return {
    async recordLlmCall(r) {
      const row = await deps.prisma.llmCall.create({
        data: {
          runId: deps.runId,
          stageRunId: deps.getStageRunId(),
          agent: r.agent,
          agentVersion: r.agentVersion,
          provider: r.provider,
          model: r.model,
          params: json(r.params),
          messages: json(r.messages),
          rawResponse: json(r.rawResponse),
          parsedOutput: json(r.parsedOutput),
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          reasoningTokens: r.reasoningTokens,
          costUsd: r.costUsd,
          latencyMs: r.latencyMs,
          attempt: r.attempt,
          status: r.status,
          error: json(r.error),
        },
      });
      deps.onLlmCall?.({
        id: row.id,
        agent: r.agent,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: r.costUsd,
        latencyMs: r.latencyMs,
        status: r.status,
      });
    },
    async recordEmbeddingCall(r) {
      await deps.prisma.embeddingCall.create({ data: { runId: deps.runId, stageRunId: deps.getStageRunId(), ...r } });
    },
  };
}
