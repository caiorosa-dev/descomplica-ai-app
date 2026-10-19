import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { type ModelResolver, PipelineError } from '@app/pipeline';
import { type Provider, providerOf } from '@app/shared';
import { createProviderRegistry } from 'ai';
import type { Env } from '../../env';

export function availableProviders(env: Env): Provider[] {
  const out: Provider[] = [];
  if (env.OPENAI_API_KEY) out.push('openai');
  if (env.ANTHROPIC_API_KEY) out.push('anthropic');
  return out;
}

/** AI SDK registry with the providers that have keys; `openai:<id>` / `anthropic:<id>` refs. */
export function createModelResolver(env: Env): ModelResolver {
  const registry = createProviderRegistry({
    ...(env.OPENAI_API_KEY ? { openai: createOpenAI({ apiKey: env.OPENAI_API_KEY }) } : {}),
    ...(env.ANTHROPIC_API_KEY ? { anthropic: createAnthropic({ apiKey: env.ANTHROPIC_API_KEY }) } : {}),
  });
  const configured = new Set(availableProviders(env));
  return {
    resolve(ref) {
      const provider = providerOf(ref);
      if (!configured.has(provider))
        throw new PipelineError('PROVIDER_NOT_CONFIGURED', `No API key configured for provider ${provider}`, {
          provider,
        });
      return registry.languageModel(ref as `${'openai' | 'anthropic'}:${string}`);
    },
  };
}
