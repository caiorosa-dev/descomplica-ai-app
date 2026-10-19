import type { ModelCatalogEntry, ModelSettings, ReasoningEffort } from '@app/shared';

export interface CallSettings {
  temperature?: number;
  seed?: number;
  maxOutputTokens: number;
  providerOptions?: Record<string, Record<string, string>>;
}

export const FIXED_SEED = 42;

/**
 * Thinking tokens count against the output limit of reasoning models; without headroom a subagent's small
 * output budget is spent on reasoning and the answer comes back truncated.
 */
const REASONING_HEADROOM: Record<ReasoningEffort, number> = { low: 2_000, medium: 6_000, high: 12_000 };

/** Generation parameters for one call, sending only what the catalog says the model accepts (spec §4.3). */
export function buildCallSettings(
  settings: ModelSettings,
  entry: ModelCatalogEntry,
  agentMaxOutputTokens: number,
): CallSettings {
  const out: CallSettings = { maxOutputTokens: settings.maxOutputTokens ?? agentMaxOutputTokens };
  if (entry.supportsTemperature && settings.temperature !== null) out.temperature = settings.temperature;
  if (entry.supportsReasoningEffort && settings.reasoningEffort !== null) {
    const effortKey = entry.provider === 'openai' ? 'reasoningEffort' : 'effort';
    out.providerOptions = { [entry.provider]: { [effortKey]: settings.reasoningEffort } };
    if (settings.maxOutputTokens === null) out.maxOutputTokens += REASONING_HEADROOM[settings.reasoningEffort];
  }
  if (entry.supportsSeed) out.seed = FIXED_SEED;
  return out;
}
