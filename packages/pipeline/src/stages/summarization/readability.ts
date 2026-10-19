/**
 * Syllable count by a heuristic: the number of groups of consecutive vowels (ditongos and some hiatos count as
 * one), with a minimum of 1. It is an approximation; the index is meant for relative comparison only.
 */
export function countSyllablesPt(word: string): number {
  const groups = word.toLowerCase().match(/[aeiouáéíóúâêôãõàü]+/g);
  return Math.max(1, groups?.length ?? 0);
}

const ABBREVIATIONS = new Set(['art', 'arts', 'nº', 'inc', 'p', 'fls', 'min', 'rel', 'dr', 'sr', 'sra', 'n', 'ltda']);

/** Splits after [.!?]+ followed by a space or the end, except after common legal abbreviations. */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const m of text.matchAll(/[.!?]+(?=\s|$)/g)) {
    const before = text.slice(start, m.index);
    const lastWord = /([\p{L}º]+)$/u.exec(before)?.[1]?.toLowerCase();
    if (m[0] === '.' && lastWord && ABBREVIATIONS.has(lastWord)) continue;
    const end = m.index + m[0].length;
    const sentence = text.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

/** Flesch reading ease adapted to Portuguese (Martins et al., 1996). */
export function fleschPt(text: string): number {
  const words = text.match(/\p{L}+/gu) ?? [];
  if (words.length === 0) return 0;
  const sentences = Math.max(1, splitSentences(text).length);
  const syllables = words.reduce((sum, w) => sum + countSyllablesPt(w), 0);
  return 248.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
}

/** Source words per summary word; 0 when the summary is empty. */
export function compressionRatio(sourceWords: number, summaryWords: number): number {
  return summaryWords === 0 ? 0 : sourceWords / summaryWords;
}
