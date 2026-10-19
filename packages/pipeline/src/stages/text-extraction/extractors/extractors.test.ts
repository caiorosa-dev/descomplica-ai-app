import { makeDocx, makePdf, makePdfLayout } from '../../../testing/fixtures';
import { extractLines } from './index';
import { buildLines } from './pdf';

const enc = (s: string) => new TextEncoder().encode(s);
const opts = { dropStrikethrough: true };

test('pdf lines per page, top to bottom', async () => {
  const doc = await extractLines(await makePdf([['Linha A', 'Linha B'], ['Linha C']]), 'pdf', opts);
  expect(doc.format).toBe('pdf');
  expect(doc.pages.map((p) => p.lines.map((l) => l.text))).toEqual([['Linha A', 'Linha B'], ['Linha C']]);
  expect(doc.pages[0]!.lines[0]!.y).toBeLessThan(doc.pages[0]!.lines[1]!.y);
  expect(doc.pages[0]!.lines[0]!.y).toBeCloseTo(50, 0);
  expect(doc.pages[0]!.height).toBeCloseTo(841.89, 1);
  expect(doc.pages.map((p) => p.number)).toEqual([1, 2]);
});

test('line ids are sequential across the document', async () => {
  const doc = await extractLines(await makePdf([['A', 'B'], ['C']]), 'pdf', opts);
  expect(doc.pages.flatMap((p) => p.lines.map((l) => [l.id, l.page]))).toEqual([
    [0, 1],
    [1, 1],
    [2, 2],
  ]);
});

test('html drops strikethrough when asked', async () => {
  const html = enc('<p>Texto <s>revogado</s> vigente</p>');
  expect((await extractLines(html, 'html', { dropStrikethrough: true })).pages[0]!.lines[0]!.text).toBe(
    'Texto vigente',
  );
  expect((await extractLines(html, 'html', { dropStrikethrough: false })).pages[0]!.lines[0]!.text).toBe(
    'Texto revogado vigente',
  );
});

test('html blocks, br and chrome', async () => {
  const html = enc(
    '<html><head><style>p{}</style><script>x()</script></head><body><nav>Menu</nav><header>Topo</header>' +
      '<h1>RESOLUÇÃO Nº 1</h1><div>Art. 1º Fica   instituído.<br>Parágrafo único.</div>' +
      '<table><tr><td>A</td><td><p>B</p></td></tr></table><ul><li>item</li></ul><footer>Rodapé</footer></body></html>',
  );
  const lines = (await extractLines(html, 'html', opts)).pages[0]!.lines;
  expect(lines.map((l) => l.text)).toEqual([
    'RESOLUÇÃO Nº 1',
    'Art. 1º Fica instituído.',
    'Parágrafo único.',
    'A',
    'B',
    'item',
  ]);
  expect(lines.map((l) => l.y)).toEqual([0, 1, 2, 3, 4, 5]);
});

test('docx paragraphs become lines', async () =>
  expect((await extractLines(await makeDocx(['Um', 'Dois']), 'docx', opts)).pages[0]!.lines.map((l) => l.text)).toEqual(
    ['Um', 'Dois'],
  ));

test('txt keeps line positions and skips blank lines', async () => {
  const doc = await extractLines(enc('﻿Primeira\r\n\r\nSegunda\nTerceira'), 'txt', opts);
  expect(doc.pages[0]!.lines.map((l) => [l.text, l.y])).toEqual([
    ['Primeira', 0],
    ['Segunda', 2],
    ['Terceira', 3],
  ]);
});

test('whitespace items emitted by pdf.js become spaces (CNJ PDFs)', () => {
  const items = [
    { str: 'CONSIDERANDO', x: 184.4, y: 100, width: 98.6, height: 12 },
    { str: ' ', x: 283, y: 100, width: 3.1, height: 0 },
    { str: 'as diretrizes', x: 286.1, y: 100, width: 70, height: 12 },
  ];
  expect(buildLines(items, 1, 0).map((l) => l.text)).toEqual(['CONSIDERANDO as diretrizes']);
});

test('pdf items that touch stay glued', () => {
  const items = [
    { str: 'provi', x: 50, y: 100, width: 25, height: 11 },
    { str: 'mento', x: 75, y: 100, width: 30, height: 11 },
  ];
  expect(buildLines(items, 1, 0)[0]!.text).toBe('provimento');
});

test('a superscript stays on its line', async () => {
  const pdf = await makePdfLayout([
    [
      { text: 'Art. 1', y: 100 },
      { text: 'o', y: 96.5, size: 7, gapBefore: 0 },
      { text: 'Esta Resolução', y: 100, gapBefore: 3 },
      { text: 'Art. 2', y: 114 },
    ],
  ]);
  const lines = (await extractLines(pdf, 'pdf', opts)).pages[0]!.lines;
  expect(lines.map((l) => l.text)).toEqual(['Art. 1o Esta Resolução', 'Art. 2']);
  expect(lines[0]!.y).toBeCloseTo(100, 0);
});
