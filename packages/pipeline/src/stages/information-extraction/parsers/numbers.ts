const UNITS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  três: 3,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
};
const TEENS: Record<string, number> = {
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezasseis: 16,
  dezessete: 17,
  dezassete: 17,
  dezoito: 18,
  dezenove: 19,
  dezanove: 19,
};
const TENS: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  cinqüenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
};
const HUNDREDS: Record<string, number> = {
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900,
};

/** Every word that can appear in a number from 1 to 999 written out, plus the connector "e". */
export const NUMBER_WORDS = new Set(['cem', 'e', ...Object.keys({ ...UNITS, ...TEENS, ...TENS, ...HUNDREDS })]);

/** Parses numbers from 1 to 999 written out in Portuguese ("cento e vinte"); null when the text is not one. */
export function parsePtNumberWords(text: string): number | null {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1 && words[0] === 'cem') return 100;
  // Expected shape: [hundreds] (e [tens|teen]) (e [unit]), with "e" between every pair of number words.
  let total = 0;
  let level = 4; // 3 = hundreds, 2 = tens, 1 = units/teens
  for (let i = 0; i < words.length; i++) {
    const word = words[i] as string;
    if (i % 2 === 1) {
      if (word !== 'e') return null;
      continue;
    }
    let value: number | undefined;
    let wordLevel: number;
    if (word in HUNDREDS) [value, wordLevel] = [HUNDREDS[word], 3];
    else if (word in TENS) [value, wordLevel] = [TENS[word], 2];
    else if (word in TEENS) [value, wordLevel] = [TEENS[word], 1.5];
    else if (word in UNITS) [value, wordLevel] = [UNITS[word], 1];
    else return null;
    if (wordLevel >= level || (level === 1.5 && wordLevel === 1)) return null;
    total += value as number;
    level = wordLevel;
  }
  return words.length % 2 === 1 ? total : null;
}
