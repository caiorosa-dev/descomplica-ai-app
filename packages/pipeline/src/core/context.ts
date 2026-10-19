import type { PipelineConfig } from '@app/shared';
import type { LanguageModel } from 'ai';

/** Fields of the `LlmCall` table (spec §10), without ids, `runId` and `stageRunId`. */
export interface LlmCallRecord {
  agent: string;
  agentVersion: string;
  provider: string;
  model: string;
  params: unknown;
  messages: unknown;
  rawResponse: unknown;
  parsedOutput: unknown;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number | null;
  costUsd: number;
  latencyMs: number;
  attempt: number;
  status: 'success' | 'error';
  error: unknown;
}

/** Fields of the `EmbeddingCall` table (spec §10), without ids, `runId` and `stageRunId`. */
export interface EmbeddingCallRecord {
  model: string;
  inputCount: number;
  tokens: number;
  cacheHits: number;
  costUsd: number;
  latencyMs: number;
}

export interface ModelResolver {
  resolve(ref: string): LanguageModel;
}

export interface Embedder {
  embed(texts: string[], options: { model: string; dimensions: number | null }): Promise<number[][]>;
}

export interface CallRecorder {
  recordLlmCall(record: LlmCallRecord): Promise<void>;
  recordEmbeddingCall(record: EmbeddingCallRecord): Promise<void>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StageEventSink {
  progress(message: string, current?: number, total?: number): void;
  log(level: LogLevel, message: string, data?: unknown): void;
  /** A degradation that does not fail the stage (spec §12); ends up in `StageRun.warnings`. */
  warn(code: string, message: string): void;
}

export interface StageContext {
  runId: string;
  /** Frozen snapshot of the run's config. */
  config: PipelineConfig;
  models: ModelResolver;
  embedder: Embedder;
  recorder: CallRecorder;
  events: StageEventSink;
  signal: AbortSignal;
  /** Max parallel LLM calls inside one run (`LLM_CONCURRENCY`). */
  llmConcurrency: number;
}
