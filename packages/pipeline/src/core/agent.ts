import { type AgentRole, estimateCostUsd, findModel, providerOf } from '@app/shared';
import {
  APICallError,
  generateText,
  jsonSchema,
  type ModelMessage,
  NoObjectGeneratedError,
  Output,
  RetryError,
} from 'ai';
import { z } from 'zod';
import { buildCallSettings } from './call-settings';
import type { StageContext } from './context';
import { isPipelineError, PipelineError } from './errors';

export const PT_BR_OUTPUT_INSTRUCTION =
  'Write every free-text field in Brazilian Portuguese (pt-BR). Copy quotes verbatim from the source, without translating or correcting them.';

export interface AgentDefinition<I extends z.ZodType, O extends z.ZodType> {
  name: string;
  version: string;
  role: AgentRole;
  input: I;
  output: O;
  system: string;
  prompt: (input: z.output<I>) => string;
  maxOutputTokens: number;
}

export function defineAgent<I extends z.ZodType, O extends z.ZodType>(
  def: AgentDefinition<I, O>,
): AgentDefinition<I, O> {
  return def;
}

type JsonNode = Record<string, unknown>;

/** OpenAI strict structured outputs accept anyOf/enum; Zod emits oneOf (discriminated unions) and const (literals). */
function toStrictCompatible(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toStrictCompatible);
  if (typeof node !== 'object' || node === null) return node;
  const out: JsonNode = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'oneOf') out.anyOf = toStrictCompatible(value);
    else if (key === 'const') out.enum = [value];
    else if (key !== '$schema') out[key] = toStrictCompatible(value);
  }
  return out;
}

function providerSchema<O extends z.ZodType>(schema: O) {
  const json = toStrictCompatible(z.toJSONSchema(schema, { target: 'draft-7', io: 'output', reused: 'inline' }));
  return jsonSchema<z.output<O>>(json as Parameters<typeof jsonSchema>[0], {
    validate: (value) => {
      const result = schema.safeParse(value);
      return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
    },
  });
}

const SCHEMA_REPAIR_MESSAGE = (issues: string) =>
  `Your previous answer did not match the required schema. Validation errors: ${issues}. Answer again following the schema exactly.`;

function describeIssues(error: NoObjectGeneratedError): string {
  const cause = error.cause as { cause?: unknown; message?: string } | undefined;
  const zodError = cause?.cause instanceof z.ZodError ? cause.cause : cause instanceof z.ZodError ? cause : null;
  if (zodError) return zodError.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  return cause?.message ?? error.message;
}

function errorInfo(error: unknown): Record<string, unknown> {
  if (APICallError.isInstance(error))
    return { name: error.name, message: error.message, statusCode: error.statusCode ?? null };
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { message: String(error) };
}

function apiCallErrorOf(error: unknown): APICallError | null {
  if (APICallError.isInstance(error)) return error;
  if (RetryError.isInstance(error) && APICallError.isInstance(error.lastError)) return error.lastError;
  return null;
}

function toPipelineError(error: unknown, signal: AbortSignal): PipelineError {
  if (isPipelineError(error)) return error;
  if (
    signal.aborted ||
    (error instanceof Error && error.name === 'AbortError') ||
    (RetryError.isInstance(error) && error.reason === 'abort')
  )
    return new PipelineError('CANCELLED', 'LLM call aborted');
  const apiError = apiCallErrorOf(error);
  if (apiError?.statusCode === 429) return new PipelineError('RATE_LIMITED', apiError.message, errorInfo(apiError));
  if (apiError || RetryError.isInstance(error))
    return new PipelineError('PROVIDER_ERROR', (apiError ?? (error as Error)).message, errorInfo(apiError ?? error));
  return new PipelineError('PROVIDER_ERROR', error instanceof Error ? error.message : String(error), errorInfo(error));
}

/**
 * Runs one subagent call with structured output: resolves the slot's model, sends only supported parameters,
 * repairs one schema mismatch, maps provider errors to PipelineError and records every attempt.
 */
export async function runAgent<I extends z.ZodType, O extends z.ZodType>(
  agent: AgentDefinition<I, O>,
  input: z.input<I>,
  ctx: StageContext,
): Promise<z.output<O>> {
  const parsedInput = agent.input.safeParse(input);
  if (!parsedInput.success)
    throw new PipelineError('INTERNAL_ERROR', `Invalid input for agent ${agent.name}`, parsedInput.error.issues);
  if (ctx.signal.aborted) throw new PipelineError('CANCELLED', 'Run cancelled before the LLM call');

  const settings = ctx.config.models[agent.role];
  const entry = findModel(settings.model);
  if (!entry) throw new PipelineError('INTERNAL_ERROR', `Model ${settings.model} is not in the catalog`);
  const model = ctx.models.resolve(settings.model);
  const callSettings = buildCallSettings(settings, entry, agent.maxOutputTokens);
  const system = `${agent.system}\n\n${PT_BR_OUTPUT_INSTRUCTION}`;
  const schema = providerSchema(agent.output);
  const messages: ModelMessage[] = [{ role: 'user', content: agent.prompt(parsedInput.data) }];
  const base = {
    agent: agent.name,
    agentVersion: agent.version,
    provider: providerOf(settings.model),
    model: settings.model.slice(settings.model.indexOf(':') + 1),
    params: callSettings,
  };

  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    const recordedMessages = [{ role: 'system', content: system }, ...messages];
    try {
      const result = await generateText({
        model,
        system,
        messages,
        output: Output.object({ schema }),
        maxRetries: 2,
        abortSignal: ctx.signal,
        ...callSettings,
      });
      const output = result.output as z.output<O>;
      const inputTokens = result.usage.inputTokens ?? 0;
      const outputTokens = result.usage.outputTokens ?? 0;
      await ctx.recorder.recordLlmCall({
        ...base,
        messages: recordedMessages,
        rawResponse: result.response.body ?? result.text,
        parsedOutput: output,
        inputTokens,
        outputTokens,
        reasoningTokens: result.usage.outputTokenDetails?.reasoningTokens ?? null,
        costUsd: estimateCostUsd(settings.model, inputTokens, outputTokens),
        latencyMs: Date.now() - started,
        attempt,
        status: 'success',
        error: null,
      });
      return output;
    } catch (error) {
      const schemaFailure = NoObjectGeneratedError.isInstance(error);
      const inputTokens = schemaFailure ? (error.usage?.inputTokens ?? 0) : 0;
      const outputTokens = schemaFailure ? (error.usage?.outputTokens ?? 0) : 0;
      await ctx.recorder.recordLlmCall({
        ...base,
        messages: recordedMessages,
        rawResponse: schemaFailure ? (error.text ?? null) : null,
        parsedOutput: null,
        inputTokens,
        outputTokens,
        reasoningTokens: schemaFailure ? (error.usage?.outputTokenDetails?.reasoningTokens ?? null) : null,
        costUsd: estimateCostUsd(settings.model, inputTokens, outputTokens),
        latencyMs: Date.now() - started,
        attempt,
        status: 'error',
        error: errorInfo(error),
      });
      if (!schemaFailure || ctx.signal.aborted) throw toPipelineError(error, ctx.signal);
      if (attempt >= 2)
        throw new PipelineError('SCHEMA_VALIDATION_FAILED', `Agent ${agent.name} output did not match its schema`, {
          issues: describeIssues(error),
        });
      messages.push(
        { role: 'assistant', content: error.text ?? '' },
        { role: 'user', content: SCHEMA_REPAIR_MESSAGE(describeIssues(error)) },
      );
    }
  }
}
