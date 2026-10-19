import { parsePipelineConfig } from '@app/shared';
import type { EmbeddingCallRecord, LlmCallRecord, LogLevel, StageContext } from '../core/context';

export interface TestContext extends StageContext {
  recorded: { llm: LlmCallRecord[]; embeddings: EmbeddingCallRecord[] };
  emitted: {
    progress: string[];
    logs: { level: LogLevel; message: string }[];
    warnings: { code: string; message: string }[];
  };
}

/** A StageContext that keeps every recorded call and emitted event in memory. */
export function createTestContext(overrides: Partial<StageContext> = {}): TestContext {
  const recorded: TestContext['recorded'] = { llm: [], embeddings: [] };
  const emitted: TestContext['emitted'] = { progress: [], logs: [], warnings: [] };
  return {
    runId: 'test-run',
    config: parsePipelineConfig({}),
    models: {
      resolve(ref) {
        throw new Error(`No model configured for ${ref} in this test context`);
      },
    },
    embedder: {
      async embed() {
        throw new Error('No embedder configured in this test context');
      },
    },
    recorder: {
      async recordLlmCall(r) {
        recorded.llm.push(r);
      },
      async recordEmbeddingCall(r) {
        recorded.embeddings.push(r);
      },
    },
    events: {
      progress: (message) => emitted.progress.push(message),
      log: (level, message) => emitted.logs.push({ level, message }),
      warn: (code, message) => emitted.warnings.push({ code, message }),
    },
    signal: new AbortController().signal,
    llmConcurrency: 4,
    ...overrides,
    recorded,
    emitted,
  };
}
