import { createHash } from 'node:crypto';
import type { PipelineConfig } from '@app/shared';

/** JSON with object keys sorted recursively, so equal values always serialize the same way. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

/** SHA-256 of the canonical JSON; groups equivalent runs in reports (spec §5.2). */
export function configHash(config: PipelineConfig): string {
  return createHash('sha256').update(canonicalJson(config)).digest('hex');
}
