import type { Section } from '@app/shared';
import { countTokens } from '../../../core/tokens';
import { segmentDocument } from '../segment';
import { chunkBySections } from './chunk-sections';

const paragraph = (i: number) =>
  `Parágrafo ${i}: ${Array.from({ length: 60 }, (_, k) => `palavra${(i * 31 + k) % 997}`).join(' ')}.`;
const longText = Array.from({ length: 30 }, (_, i) => paragraph(i)).join('\n\n');
const sectionsOf = (text: string): Section[] => segmentDocument(text, 'generic').sections;

test('chunkBySections packs sections and overlaps', () => {
  const chunks = chunkBySections(longText, sectionsOf(longText), 1000, 100);
  expect(chunks.length).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.start).toBeLessThan(chunks[i - 1]!.end);
  expect(chunks[0]!.start).toBe(0);
  expect(chunks.at(-1)!.end).toBe(longText.length);
  for (const c of chunks) expect(c.text).toBe(longText.slice(c.start, c.end));
  for (const c of chunks) expect(countTokens(c.text)).toBeLessThanOrEqual(1000 + 100 + 10);
});

test('a section larger than the chunk is split by paragraph and then by tokens', () => {
  const huge = Array.from({ length: 400 }, (_, k) => `termo${k}`).join(' ');
  const text = `${paragraph(1)}\n\n${huge}`;
  const section: Section = { id: 'S01', kind: 'paragraph', label: 'x', parentLabel: null, start: 0, end: text.length };
  const chunks = chunkBySections(text, [section], 200, 0);
  expect(chunks.length).toBeGreaterThanOrEqual(3);
  expect(chunks.at(-1)!.end).toBe(text.length);
  for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.start).toBe(chunks[i - 1]!.end);
});

test('small text is a single chunk', () => {
  const text = 'Art. 1º Fica instituído.';
  expect(chunkBySections(text, sectionsOf(text), 1000, 100)).toEqual([{ start: 0, end: text.length, text }]);
});
