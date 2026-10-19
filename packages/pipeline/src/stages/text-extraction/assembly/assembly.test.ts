import type { Line, LineDocument } from '../types';
import { allLines } from '../types';
import { buildCanonicalText } from './canonical';
import { dehyphenate } from './dehyphenate';
import { paragraphBreaks } from './paragraphs';

const ls = (texts: string[]): Line[] => texts.map((text, i) => ({ id: i, text, y: 100 + i * 14, height: 11, page: 1 }));
const texts = (lines: Line[]) => lines.map((l) => l.text);
const docFromLines = (lines: string[], format: LineDocument['format'] = 'pdf'): LineDocument => ({
  format,
  pages: [{ number: 1, height: 800, lines: ls(lines) }],
});

test('dehyphenate joins word, keeps clitic hyphen, ignores uppercase', () => {
  expect(texts(dehyphenate(ls(['a obriga-', 'ção de pagar'])))).toEqual(['a obrigação', 'de pagar']);
  expect(texts(dehyphenate(ls(['cumpre dar-', 'lhe ciência'])))).toEqual(['cumpre dar-lhe', 'ciência']);
  expect(texts(dehyphenate(ls(['Superior-', 'Tribunal'])))).toEqual(['Superior-', 'Tribunal']);
});

test('dehyphenate drops a line fully consumed and works across pages', () => {
  const lines: Line[] = [
    { id: 0, text: 'aplica-', y: 700, height: 11, page: 1 },
    { id: 1, text: 'se', y: 100, height: 11, page: 2 },
    { id: 2, text: 'a regra', y: 114, height: 11, page: 2 },
  ];
  expect(texts(dehyphenate(lines))).toEqual(['aplica-se', 'a regra']);
});

test('paragraphs break on terminal punctuation and structural markers', () => {
  const d = docFromLines(['O recurso foi', 'provido.', 'Art. 1º Fica', 'instituído']);
  expect(buildCanonicalText(allLines(d), paragraphBreaks(d)).canonicalText).toBe(
    'O recurso foi provido.\n\nArt. 1º Fica instituído',
  );
});

test('paragraphs break on a vertical jump larger than 1.5x the median spacing', () => {
  const d: LineDocument = {
    format: 'pdf',
    pages: [
      {
        number: 1,
        height: 800,
        lines: [
          { id: 0, text: 'primeira linha', y: 100, height: 11, page: 1 },
          { id: 1, text: 'continua aqui', y: 114, height: 11, page: 1 },
          { id: 2, text: 'e mais', y: 128, height: 11, page: 1 },
          { id: 3, text: 'novo bloco', y: 170, height: 11, page: 1 },
        ],
      },
    ],
  };
  expect(paragraphBreaks(d)).toEqual([true, false, false, true]);
});

test('html and docx lines are already paragraphs', () =>
  expect(paragraphBreaks(docFromLines(['RESOLUÇÃO Nº 1', 'Dispõe sobre algo'], 'html'))).toEqual([true, true]));

test('pageMap slices map back to pages', () => {
  const lines: Line[] = [
    { id: 0, text: 'Texto da página um.', y: 100, height: 11, page: 1 },
    { id: 1, text: 'Texto da página dois', y: 100, height: 11, page: 2 },
    { id: 2, text: 'continua.', y: 114, height: 11, page: 2 },
  ];
  const { canonicalText, pageMap, lineSpans } = buildCanonicalText(lines, [true, true, false]);
  expect(canonicalText).toBe('Texto da página um.\n\nTexto da página dois continua.');
  expect(pageMap.map((p) => p.page)).toEqual([1, 2]);
  expect(canonicalText.slice(pageMap[0]!.start, pageMap[0]!.end)).toBe('Texto da página um.');
  expect(canonicalText.slice(pageMap[1]!.start, pageMap[1]!.end)).toBe('Texto da página dois continua.');
  expect(lineSpans.map((s) => canonicalText.slice(s.start, s.end))).toEqual([
    'Texto da página um.',
    'Texto da página dois',
    'continua.',
  ]);
});
