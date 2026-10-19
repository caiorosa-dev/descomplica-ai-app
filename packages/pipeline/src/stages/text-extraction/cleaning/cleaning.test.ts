import type { Line, LineDocument, Page } from '../types';
import { removeBoilerplate } from './boilerplate';
import { normalizeUnicode } from './normalize-unicode';
import { removePageNumbers } from './page-numbers';
import { removeRepeatedEdges } from './repeated-edges';
import type { CleaningResult } from './types';

let nextId = 0;
const line = (text: string, y: number, page: number): Line => ({ id: nextId++, text, y, height: 11, page });
const doc = (pages: Page[]): LineDocument => ({ format: 'pdf', pages });
const page = (n: number, body: string[]): Page => ({
  number: n,
  height: 800,
  lines: [
    line('SUPERIOR TRIBUNAL DE JUSTIÇA', 20, n),
    ...body.map((t, i) => line(t, 200 + i * 14, n)),
    line(`Página ${n} de 4`, 780, n),
  ],
});
const texts = (d: LineDocument) => d.pages.flatMap((p) => p.lines.map((l) => l.text));
const single = (text: string) => doc([{ number: 1, height: 800, lines: [line(text, 400, 1)] }]);
const isRemoved = (fn: (d: LineDocument) => CleaningResult, text: string) => fn(single(text)).removed.length === 1;
const opts = { edgeBandRatio: 0.1, repeatThreshold: 0.5 };
const stj = (d: LineDocument) => removeBoilerplate(d, ['stj-e-signature']);
const dje = (d: LineDocument) => removeBoilerplate(d, ['dje-header']);
const norm = (text: string) => texts(normalizeUnicode(single(text)))[0];

test('removes header/footer repeated across >= 3 pages', () => {
  const r = removeRepeatedEdges(doc([page(1, ['a']), page(2, ['b']), page(3, ['c']), page(4, ['d'])]), opts);
  expect(r.removed).toHaveLength(8);
  expect(r.removed[0]).toEqual({ rule: 'repeated_edge', page: 1, text: 'SUPERIOR TRIBUNAL DE JUSTIÇA' });
  expect(texts(r.doc)).toEqual(['a', 'b', 'c', 'd']);
});

test('skips documents with fewer than 3 pages', () =>
  expect(removeRepeatedEdges(doc([page(1, ['a']), page(2, ['b'])]), opts).removed).toEqual([]));

test('keeps repeated text outside the edge band', () => {
  const pages = [1, 2, 3].map((n) => ({ number: n, height: 800, lines: [line('Texto repetido no meio', 400, n)] }));
  expect(removeRepeatedEdges(doc(pages), opts).removed).toEqual([]);
});

test('edge text below the repeat threshold stays', () => {
  const heads = ['EMENTA', 'EMENTA', 'VOTO', 'RELATÓRIO'];
  const pages = heads.map((t, i) => ({ number: i + 1, height: 800, lines: [line(t, 20, i + 1)] }));
  expect(removeRepeatedEdges(doc(pages), { edgeBandRatio: 0.1, repeatThreshold: 0.75 }).removed).toEqual([]);
});

test('page numbers', () => {
  for (const t of ['- 3 -', '3/20', 'Pág. 3', 'Página 3 de 20', '12', 'PÁGINA 7'])
    expect(isRemoved(removePageNumbers, t)).toBe(true);
  expect(isRemoved(removePageNumbers, 'Art. 3')).toBe(false);
  expect(isRemoved(removePageNumbers, '3 dias')).toBe(false);
  expect(removePageNumbers(single('- 3 -')).removed[0]!.rule).toBe('page_number');
});

test('stj signature stamp removed, body citation kept', () => {
  expect(
    isRemoved(
      stj,
      'Documento eletrônico VDA123 assinado eletronicamente nos termos do Art.1º §2º inciso III da Lei 11.419/2006',
    ),
  ).toBe(true);
  expect(isRemoved(stj, 'Código de Controle do Documento: 1a2b3c')).toBe(true);
  expect(isRemoved(stj, 'nos termos da Lei 11.419/2006, o processo eletrônico admite')).toBe(false);
  expect(stj(single('Site certificado')).removed[0]!.rule).toBe('boilerplate:stj-e-signature');
});

test('stj signature residue and barcode line removed (corpus regression)', () => {
  expect(
    isRemoved(
      stj,
      'Signatário(a): MARIA AUXILIADORA RAMALHO DA ROCHA, TERCEIRA TURMA Assinado em: 20/03/2025 15:45:10',
    ),
  ).toBe(true);
  expect(isRemoved(stj, 'C54224551500;524029032@ 2024/0192224-5 - REsp 2186037')).toBe(true);
  expect(isRemoved(stj, 'O signatário do contrato foi notificado.')).toBe(false);
});

test('dje header removed', () =>
  expect(isRemoved(dje, 'Edição nº 101/2022 Brasília - DF, disponibilização: terça-feira, 10 de maio de 2022')).toBe(
    true,
  ));

test('only the requested pattern sets apply', () =>
  expect(isRemoved(dje, 'Código de Controle do Documento: 1a2b3c')).toBe(false));

test('normalizeUnicode', () => {
  expect(norm('eﬁcácia')).toBe('eficácia');
  expect(norm('R$ 10')).toBe('R$ 10');
  expect(norm('ação')).toBe('ação');
  expect(norm('  dois   espaços\u0007 ')).toBe('dois espaços');
});

test('normalizeUnicode drops lines left empty', () => expect(texts(normalizeUnicode(single(' ​')))).toEqual([]));
