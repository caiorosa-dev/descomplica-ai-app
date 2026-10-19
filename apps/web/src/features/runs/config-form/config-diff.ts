import type { DeepPartial, PipelineConfig, StageName } from '@app/shared';

/** Same blocks as `earliestStageAffected` in @app/shared. */
export const CONFIG_BLOCK_STAGE: Record<string, StageName> = {
  'models.cleaning': 'text_extraction',
  textExtraction: 'text_extraction',
  'models.classification': 'information_extraction',
  'models.extraction': 'information_extraction',
  classification: 'information_extraction',
  extraction: 'information_extraction',
  'models.summarization': 'summarization',
  summarization: 'summarization',
  similarity: 'similarity',
  'models.claimExtraction': 'verification',
  'models.verification': 'verification',
  verification: 'verification',
};

export function stageOfPath(path: string): StageName | null {
  const parts = path.split('.');
  return CONFIG_BLOCK_STAGE[parts.slice(0, 2).join('.')] ?? CONFIG_BLOCK_STAGE[parts[0] ?? ''] ?? null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Changed leaves between two configs, with dotted paths; arrays are compared as a whole. */
export function diffConfig(a: PipelineConfig, b: PipelineConfig): { path: string; before: unknown; after: unknown }[] {
  const out: { path: string; before: unknown; after: unknown }[] = [];
  const walk = (x: unknown, y: unknown, path: string) => {
    if (isObject(x) && isObject(y)) {
      for (const key of new Set([...Object.keys(x), ...Object.keys(y)]))
        walk(x[key], y[key], path ? `${path}.${key}` : key);
    } else if (!same(x, y)) out.push({ path, before: x, after: y });
  };
  walk(a, b, '');
  return out;
}

/** The minimal override object that turns `base` into `edited`. */
export function buildOverrides(base: PipelineConfig, edited: PipelineConfig): DeepPartial<PipelineConfig> {
  const overrides: Record<string, unknown> = {};
  for (const { path, after } of diffConfig(base, edited)) {
    const keys = path.split('.');
    let node = overrides;
    for (const key of keys.slice(0, -1)) {
      node[key] = isObject(node[key]) ? node[key] : {};
      node = node[key] as Record<string, unknown>;
    }
    node[keys.at(-1) as string] = after;
  }
  return overrides as DeepPartial<PipelineConfig>;
}
