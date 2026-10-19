import { type StageName, stageIndex } from '../domain/enums';
import { type PipelineConfig, parsePipelineConfig } from './pipeline-config';

/** Recursive partial; arrays are replaced whole, never merged element by element. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) out[key] = deepMerge(base[key], value);
  return out;
}

/** Deep-merges overrides into a config (arrays replaced) and validates the result again. */
export function mergeConfig(base: PipelineConfig, overrides: DeepPartial<PipelineConfig>): PipelineConfig {
  return parsePipelineConfig(deepMerge(base, overrides));
}

function hasDefinedLeaf(value: unknown): boolean {
  if (value === undefined) return false;
  if (!isPlainObject(value)) return true;
  return Object.values(value).some(hasDefinedLeaf);
}

const MODEL_SLOT_STAGE: Record<keyof PipelineConfig['models'], StageName> = {
  cleaning: 'text_extraction',
  classification: 'information_extraction',
  extraction: 'information_extraction',
  summarization: 'summarization',
  claimExtraction: 'verification',
  verification: 'verification',
};

const BLOCK_STAGE: Record<Exclude<keyof PipelineConfig, 'models'>, StageName> = {
  textExtraction: 'text_extraction',
  classification: 'information_extraction',
  extraction: 'information_extraction',
  summarization: 'summarization',
  similarity: 'similarity',
  verification: 'verification',
};

/** The earliest pipeline stage whose output an override would change, or null when nothing is overridden. */
export function earliestStageAffected(overrides: DeepPartial<PipelineConfig>): StageName | null {
  const stages: StageName[] = [];
  for (const [slot, stage] of Object.entries(MODEL_SLOT_STAGE))
    if (hasDefinedLeaf(overrides.models?.[slot as keyof PipelineConfig['models']])) stages.push(stage);
  for (const [block, stage] of Object.entries(BLOCK_STAGE))
    if (hasDefinedLeaf(overrides[block as keyof typeof BLOCK_STAGE])) stages.push(stage);
  if (stages.length === 0) return null;
  return stages.reduce((a, b) => (stageIndex(a) <= stageIndex(b) ? a : b));
}
