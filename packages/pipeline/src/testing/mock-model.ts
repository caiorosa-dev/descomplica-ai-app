import { MockLanguageModelV4 } from 'ai/test';
import type { AgentDefinition } from '../core/agent';
import type { StageContext } from '../core/context';
import { createTestContext, type TestContext } from './context';

export interface MockCall {
  agent: string;
  system: string;
  prompt: string;
}

// biome-ignore lint/suspicious/noExplicitAny: handlers accept agents of any input/output schema.
type AnyAgent = AgentDefinition<any, any>;
export type MockResponder = (call: MockCall & { index: number }) => unknown | Promise<unknown>;

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content))
    return content.map((p) => (p && typeof p === 'object' && 'text' in p ? p.text : '')).join('');
  return '';
}

/**
 * A mock language model that answers each call with the responder registered for the agent whose system prompt
 * the call carries. A responder that throws makes the model call fail with that error.
 */
export function createAgentMockModel(handlers: [AnyAgent, MockResponder][], calls: MockCall[] = []) {
  const counts = new Map<string, number>();
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      const system = textOf(options.prompt.find((m) => m.role === 'system')?.content);
      const prompt = options.prompt
        .filter((m) => m.role === 'user')
        .map((m) => textOf(m.content))
        .join('\n');
      const handler = handlers.find(([agent]) => system.startsWith(agent.system));
      if (!handler) throw new Error(`No mock responder for system prompt: ${system.slice(0, 80)}`);
      const [agent, respond] = handler;
      const index = counts.get(agent.name) ?? 0;
      counts.set(agent.name, index + 1);
      const call = { agent: agent.name, system, prompt };
      calls.push(call);
      const answer = await respond({ ...call, index });
      return {
        content: [{ type: 'text' as const, text: typeof answer === 'string' ? answer : JSON.stringify(answer) }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage,
        warnings: [],
      };
    },
  });
  return { model, calls };
}

export interface MockContext extends TestContext {
  calls: MockCall[];
}

/** A TestContext whose every model slot resolves to an agent-routed mock model. */
export function createMockContext(
  handlers: [AnyAgent, MockResponder][],
  overrides: Partial<StageContext> = {},
): MockContext {
  const { model, calls } = createAgentMockModel(handlers);
  const ctx = createTestContext({ models: { resolve: () => model }, ...overrides });
  return Object.assign(ctx, { calls });
}
