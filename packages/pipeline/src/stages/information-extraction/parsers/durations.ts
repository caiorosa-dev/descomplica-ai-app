import { NUMBER_WORDS, parsePtNumberWords } from './numbers';

export interface FoundDuration {
  amount: number;
  unit: 'days' | 'months' | 'years';
  businessDays: boolean | null;
  start: number;
  end: number;
}

const UNIT = /\b(dias?|m[eê]s|meses|anos?)\b(\s+(?:úteis|uteis|corridos))?/giu;
const MAX_NUMBER_WORDS = 7;

function unitOf(word: string): FoundDuration['unit'] {
  const w = word.toLowerCase();
  if (w.startsWith('dia')) return 'days';
  if (w.startsWith('ano')) return 'years';
  return 'months';
}

/** Finds the number right before `end`: digits, number words, or digits followed by "(words)". */
function numberBefore(text: string, end: number): { amount: number; start: number } | null {
  const before = text.slice(0, end).replace(/\s+$/, '');
  const digitsWithWords = /(\d+)\s*\([^)]*\)$/u.exec(before);
  if (digitsWithWords) return { amount: Number(digitsWithWords[1]), start: digitsWithWords.index };
  const digits = /(\d+)$/.exec(before);
  if (digits) return { amount: Number(digits[1]), start: digits.index };
  const words = [...before.matchAll(/\p{L}+/gu)].slice(-MAX_NUMBER_WORDS);
  for (let i = 0; i < words.length; i++) {
    const tail = words.slice(i);
    if (!tail.every((w) => NUMBER_WORDS.has(w[0].toLowerCase()))) continue;
    const first = tail[0] as RegExpMatchArray;
    const span = before.slice(first.index);
    if (!/^[\p{L}\s]+$/u.test(span)) continue;
    const amount = parsePtNumberWords(span);
    if (amount !== null) return { amount, start: first.index as number };
  }
  return null;
}

/** Durations such as "15 (quinze) dias úteis", "trinta dias", "10 dias corridos" and "6 meses". */
export function findDurations(text: string): FoundDuration[] {
  const found: FoundDuration[] = [];
  for (const m of text.matchAll(UNIT)) {
    const number = numberBefore(text, m.index);
    if (!number) continue;
    const qualifier = m[2]?.trim().toLowerCase();
    found.push({
      amount: number.amount,
      unit: unitOf(m[1] ?? ''),
      businessDays: qualifier ? qualifier !== 'corridos' : null,
      start: number.start,
      end: m.index + m[0].length,
    });
  }
  return found;
}
