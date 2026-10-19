import { z } from 'zod';

const RunId = z.string().uuid();

/** `?runs=a,b` with exactly two distinct run ids; anything else is null. */
export function parseRunsParam(value: unknown): [string, string] | null {
  if (typeof value !== 'string') return null;
  const parts = value.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const [a, b] = parts as [string, string];
  if (a === b || !RunId.safeParse(a).success || !RunId.safeParse(b).success) return null;
  return [a, b];
}
