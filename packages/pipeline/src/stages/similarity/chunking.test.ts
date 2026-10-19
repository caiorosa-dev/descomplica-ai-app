import type { Summary } from '@app/shared';
import { createFakeEmbedder } from '../../testing/fake-embedder';
import { segmentDocument } from '../information-extraction/segment';
import { chunkSource, chunkSummary } from './chunking';

const text = Array.from(
  { length: 20 },
  (_, i) => `Parágrafo ${i}: ${Array.from({ length: 40 }, (_, k) => `termo${k + i}`).join(' ')}.`,
).join('\n\n');

test('fixed chunking covers the whole text', () => {
  const chunks = chunkSource(text, [], { method: 'fixed', maxTokens: 100, overlapTokens: 20 });
  expect(chunks[0]!.start).toBe(0);
  expect(chunks.at(-1)!.end).toBe(text.length);
  for (let i = 1; i < chunks.length; i++) {
    expect(chunks[i]!.start).toBeLessThanOrEqual(chunks[i - 1]!.end);
    expect(chunks[i]!.start).toBeGreaterThan(chunks[i - 1]!.start);
  }
  expect(chunks.map((c) => c.id).slice(0, 2)).toEqual(['C001', 'C002']);
  for (const c of chunks) expect(c.tokens).toBeLessThanOrEqual(100);
});

test('structural chunking follows sections without overlap', () => {
  const sections = segmentDocument(text, 'generic').sections;
  const chunks = chunkSource(text, sections, { method: 'structural', maxTokens: 300, overlapTokens: 64 });
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks[0]!.start).toBe(0);
  expect(chunks.at(-1)!.end).toBe(text.length);
  for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.start).toBe(chunks[i - 1]!.end);
});

test('chunkSummary ids and refs', () => {
  const summary: Summary = {
    title: 't',
    overview: 'Em resumo.',
    sections: [
      {
        heading: 'A',
        paragraphs: [
          { text: 'Um.', factRefs: [] },
          { text: 'Dois.', factRefs: ['F01'] },
        ],
      },
      { heading: 'B', paragraphs: [{ text: 'Três.', factRefs: [] }] },
    ],
    glossary: [],
  };
  const chunks = chunkSummary(summary);
  expect(chunks.map((c) => [c.id, c.sectionIndex, c.paragraphIndex, c.text])).toEqual([
    ['P00', null, null, 'Em resumo.'],
    ['P01', 0, 0, 'Um.'],
    ['P02', 0, 1, 'Dois.'],
    ['P03', 1, 0, 'Três.'],
  ]);
  expect(chunks[1]!.tokens).toBeGreaterThan(0);
});

test('fake embedder is deterministic, normalized and records calls', async () => {
  const e = createFakeEmbedder(16);
  const [a, b, c] = await e.embed(['o prazo de quinze dias', 'o prazo de quinze dias', 'valor da multa'], {
    model: 'openai:text-embedding-3-small',
    dimensions: null,
  });
  expect(a).toEqual(b);
  expect(a).toHaveLength(16);
  expect(Math.hypot(...a!)).toBeCloseTo(1);
  expect(a).not.toEqual(c);
  expect(e.calls).toEqual([{ texts: expect.any(Array), model: 'openai:text-embedding-3-small', dimensions: null }]);
});
