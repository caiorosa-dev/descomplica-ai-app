import type { InjectedFault, Summary } from '@app/shared';
import { rewriteFirst } from './text-slots';

export const OUTCOME_FLIPS: [string, string][] = [
  ['negou provimento', 'deu provimento'],
  ['negaram provimento', 'deram provimento'],
  ['não conheceu', 'conheceu'],
  ['improcedente', 'procedente'],
  ['denegou a ordem', 'concedeu a ordem'],
  ['indeferiu', 'deferiu'],
];

const COUNTERPART = new Map(OUTCOME_FLIPS.flatMap(([a, b]) => [[a, b] as const, [b, a] as const]));
// Longest phrases first so "não conheceu" wins over "conheceu" and "indeferiu" over "deferiu".
const PHRASES = [...COUNTERPART.keys()].sort((a, b) => b.length - a.length);
const PATTERN = new RegExp(`(?<!\\p{L})(${PHRASES.join('|')})(?!\\p{L})`, 'giu');

function keepCase(original: string, replacement: string): string {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) return replacement[0]?.toUpperCase() + replacement.slice(1);
  return replacement;
}

const findOutcomes = (text: string) =>
  [...text.matchAll(PATTERN)].map((m) => ({ start: m.index, end: m.index + m[0].length }));

/** Swaps the first decision phrase for its opposite, in either direction, keeping the original capitalization. */
export function outcomeFlip(summary: Summary): { summary: Summary; fault: InjectedFault } | null {
  const result = rewriteFirst(summary, findOutcomes, (_match, raw) => {
    const counterpart = COUNTERPART.get(raw.toLowerCase());
    return counterpart ? keepCase(raw, counterpart) : null;
  });
  if (!result) return null;
  return {
    summary: result.summary,
    fault: {
      type: 'outcome_flip',
      description: `Resultado invertido de "${result.before}" para "${result.after}".`,
      expected: { alertType: 'divergence', category: 'decision' },
    },
  };
}
