const NUMBER = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)`;
const SCALE = String.raw`(?:\s*(milh[õo]es|milh[ãa]o|bilh[õo]es|bilh[ãa]o|mil)(?!\p{L}))?`;
const WITH_SYMBOL = new RegExp(String.raw`R\$\s*${NUMBER}${SCALE}`, 'giu');
const WITH_WORD = new RegExp(String.raw`(?<![\d.,R$])${NUMBER}${SCALE}\s+reais\b`, 'giu');

const MULTIPLIER: Record<string, number> = { mil: 1e3, milhão: 1e6, milhao: 1e6, milhões: 1e6, milhoes: 1e6 };

export interface FoundMoney {
  amount: number;
  start: number;
  end: number;
}

function multiplierOf(scale: string | undefined): number {
  if (!scale) return 1;
  const s = scale.toLowerCase();
  if (s.startsWith('bilh')) return 1e9;
  return MULTIPLIER[s] ?? 1;
}

/** Amounts in reais ("R$ 1.234,56", "R$ 10 mil", "R$ 2,5 milhões", "10.000,00 reais"), rounded to cents. */
export function findMoney(text: string): FoundMoney[] {
  const found: FoundMoney[] = [];
  for (const re of [WITH_SYMBOL, WITH_WORD])
    for (const m of text.matchAll(re)) {
      const number = Number((m[1] ?? '').replace(/\./g, '').replace(',', '.'));
      const amount = Math.round(number * multiplierOf(m[2]) * 100) / 100;
      if (Number.isFinite(amount)) found.push({ amount, start: m.index, end: m.index + m[0].length });
    }
  return found
    .sort((a, b) => a.start - b.start)
    .filter((m, i, all) => i === 0 || m.start >= (all[i - 1] as FoundMoney).end);
}
