import { estimateCostUsd, MODEL_REFS } from '@app/shared';
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import { createTestContext } from '../testing/context';
import { defineAgent, PT_BR_OUTPUT_INSTRUCTION, runAgent } from './agent';

const echoAgent = defineAgent({
  name: 'echo',
  version: '1.0.0',
  role: 'summarization',
  input: z.object({ text: z.string() }),
  output: z.object({ answer: z.string() }),
  system: 'Answer the user.',
  prompt: (input) => `Say: ${input.text}`,
  maxOutputTokens: 1000,
});

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 15, reasoning: 5 },
};

function textResult(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: undefined },
    usage,
    warnings: [],
  };
}

function mockReturning(...answers: unknown[]) {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const answer = answers[Math.min(call++, answers.length - 1)];
      return textResult(typeof answer === 'string' ? answer : JSON.stringify(answer));
    },
  });
}

function mockThrowing(error: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw error;
    },
  });
}

const ctxWith = (model: MockLanguageModelV4) => createTestContext({ models: { resolve: () => model } });

test('returns parsed output and records one call', async () => {
  const ctx = ctxWith(mockReturning({ answer: 'olá' }));
  const out = await runAgent(echoAgent, { text: 'oi' }, ctx);
  expect(out).toEqual({ answer: 'olá' });
  expect(ctx.recorded.llm).toHaveLength(1);
  expect(ctx.recorded.llm[0]).toMatchObject({
    agent: 'echo',
    agentVersion: '1.0.0',
    attempt: 1,
    status: 'success',
    provider: 'openai',
    model: 'gpt-5.6-sol',
    inputTokens: 10,
    outputTokens: 20,
    reasoningTokens: 5,
    parsedOutput: { answer: 'olá' },
    error: null,
  });
  expect(ctx.recorded.llm[0]!.costUsd).toBeCloseTo(estimateCostUsd(MODEL_REFS.openaiMain, 10, 20));
  expect(ctx.recorded.llm[0]!.latencyMs).toBeGreaterThanOrEqual(0);
});

test('retries once on schema mismatch', async () => {
  const ctx = ctxWith(mockReturning({ wrong: 1 }, { answer: 'ok' }));
  expect(await runAgent(echoAgent, { text: 'oi' }, ctx)).toEqual({ answer: 'ok' });
  expect(ctx.recorded.llm.map((r) => r.attempt)).toEqual([1, 2]);
  expect(ctx.recorded.llm.map((r) => r.status)).toEqual(['error', 'success']);
  expect(JSON.stringify(ctx.recorded.llm[1]!.messages)).toContain('did not match the required schema');
});

test('throws SCHEMA_VALIDATION_FAILED after second mismatch', async () => {
  const ctx = ctxWith(mockReturning({ wrong: 1 }, 'not json'));
  await expect(runAgent(echoAgent, { text: 'oi' }, ctx)).rejects.toMatchObject({ code: 'SCHEMA_VALIDATION_FAILED' });
  expect(ctx.recorded.llm.map((r) => r.status)).toEqual(['error', 'error']);
});

test('maps HTTP 429 to RATE_LIMITED', async () => {
  const error = new APICallError({
    message: 'Too many requests',
    url: 'https://api.example.com',
    requestBodyValues: {},
    statusCode: 429,
    isRetryable: false,
  });
  const ctx = ctxWith(mockThrowing(error));
  await expect(runAgent(echoAgent, { text: 'oi' }, ctx)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  expect(ctx.recorded.llm).toHaveLength(1);
  expect(ctx.recorded.llm[0]).toMatchObject({ status: 'error', attempt: 1 });
});

test('maps other API errors to PROVIDER_ERROR', async () => {
  const error = new APICallError({
    message: 'down',
    url: 'x',
    requestBodyValues: {},
    statusCode: 503,
    isRetryable: false,
  });
  await expect(runAgent(echoAgent, { text: 'oi' }, ctxWith(mockThrowing(error)))).rejects.toMatchObject({
    code: 'PROVIDER_ERROR',
  });
});

test('throws CANCELLED when signal already aborted', async () => {
  const model = mockReturning({ answer: 'x' });
  const ac = new AbortController();
  ac.abort();
  const ctx = createTestContext({ models: { resolve: () => model }, signal: ac.signal });
  await expect(runAgent(echoAgent, { text: 'oi' }, ctx)).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(model.doGenerateCalls).toHaveLength(0);
});

test('invalid input is a programming error', async () => {
  await expect(
    runAgent(echoAgent, { text: 1 } as unknown as { text: string }, ctxWith(mockReturning({ answer: 'x' }))),
  ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
});

test('system prompt ends with PT_BR_OUTPUT_INSTRUCTION', async () => {
  const model = mockReturning({ answer: 'x' });
  await runAgent(echoAgent, { text: 'oi' }, ctxWith(model));
  const system = model.doGenerateCalls[0]!.prompt[0]!;
  expect(system.role).toBe('system');
  expect(system.content).toBe(`Answer the user.\n\n${PT_BR_OUTPUT_INSTRUCTION}`);
});

test('sends settings allowed by the catalog for the slot model', async () => {
  const model = mockReturning({ answer: 'x' });
  await runAgent(echoAgent, { text: 'oi' }, ctxWith(model));
  const call = model.doGenerateCalls[0]!;
  expect(call.temperature).toBeUndefined();
  expect(call.topP).toBeUndefined();
  expect(call.providerOptions?.openai?.reasoningEffort).toBe('medium');
});

test('response schema sent to the provider uses anyOf/enum instead of oneOf/const', async () => {
  const unionAgent = defineAgent({
    ...echoAgent,
    output: z.object({
      items: z.array(
        z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('a'), a: z.string() }),
          z.object({ kind: z.literal('b'), b: z.number() }),
        ]),
      ),
    }),
  });
  const model = mockReturning({ items: [{ kind: 'b', b: 2 }] });
  expect(await runAgent(unionAgent, { text: 'oi' }, ctxWith(model))).toEqual({ items: [{ kind: 'b', b: 2 }] });
  const format = model.doGenerateCalls[0]!.responseFormat;
  const schema = JSON.stringify(format?.type === 'json' ? format.schema : null);
  expect(schema).toContain('"anyOf"');
  expect(schema).not.toContain('"oneOf"');
  expect(schema).not.toContain('"const"');
});
