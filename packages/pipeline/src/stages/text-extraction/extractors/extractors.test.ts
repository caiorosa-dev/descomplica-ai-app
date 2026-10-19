import { makeDocx, makePdf } from '../../../testing/fixtures';
import { extractLines } from './index';

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
