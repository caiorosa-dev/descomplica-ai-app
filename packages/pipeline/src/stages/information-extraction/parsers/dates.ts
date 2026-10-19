const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const WRITTEN = new RegExp(`\\b(\\d{1,2})(?:º|°|o)?\\s+de\\s+(${MONTHS.join('|')}|marco)\\s+de\\s+(\\d{4})\\b`, 'giu');
const NUMERIC = /(?<![\d.,/])(\d{1,2})([/.])(\d{1,2})\2(\d{4}|\d{2})(?![\d]|[.,/]\d)/g;

export interface FoundDate {
  iso: string;
  start: number;
  end: number;
}

function toIso(day: number, month: number, year: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Dates such as "24 de março de 2025", "1º de janeiro de 2025", "24/03/2025", "24.3.2025" and "05/06/25" (= 2025). */
export function findDates(text: string): FoundDate[] {
  const found: FoundDate[] = [];
  for (const m of text.matchAll(WRITTEN)) {
    const month = m[2]?.toLowerCase() === 'marco' ? 3 : MONTHS.indexOf((m[2] ?? '').toLowerCase()) + 1;
    const iso = toIso(Number(m[1]), month, Number(m[3]));
    if (iso) found.push({ iso, start: m.index, end: m.index + m[0].length });
  }
  for (const m of text.matchAll(NUMERIC)) {
    const rawYear = m[4] ?? '';
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    const iso = toIso(Number(m[1]), Number(m[3]), year);
    if (iso) found.push({ iso, start: m.index, end: m.index + m[0].length });
  }
  return found.sort((a, b) => a.start - b.start);
}
