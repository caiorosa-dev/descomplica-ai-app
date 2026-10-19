import { segmentDocument } from './index';

const acordao = [
  'RECURSO ESPECIAL Nº 1.969.219 - SP',
  'EMENTA',
  'Direito civil...',
  'ACÓRDÃO',
  'Vistos...',
  'RELATÓRIO',
  'Trata-se...',
  'VOTO',
  'O recurso merece...',
  'Ante o exposto, nego provimento ao recurso especial.',
  'CERTIDÃO DE JULGAMENTO',
  'Certifico...',
].join('\n\n');

test('court decision sections are ordered and contiguous', () => {
  const { sections, fallback } = segmentDocument(acordao, 'court_decision');
  expect(fallback).toBe(false);
  expect(sections.map((s) => s.kind)).toEqual([
    'preamble',
    'headnote',
    'judgment',
    'report',
    'vote',
    'operative_part',
    'judgment_certificate',
  ]);
  for (let i = 1; i < sections.length; i++) expect(sections[i]!.start).toBeGreaterThanOrEqual(sections[i - 1]!.end);
  expect(sections.map((s) => s.id)).toEqual(['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07']);
  expect(sections.map((s) => s.label)).toEqual([
    'Preâmbulo',
    'Ementa',
    'Acórdão',
    'Relatório',
    'Voto',
    'Dispositivo',
    'Certidão de julgamento',
  ]);
  const operative = sections[5]!;
  expect(acordao.slice(operative.start, operative.end)).toBe('Ante o exposto, nego provimento ao recurso especial.');
  expect(acordao.slice(sections[4]!.start, sections[4]!.end)).toBe('VOTO\n\nO recurso merece...');
});

test('operative part only in the first vote and the last matching paragraph', () => {
  const text = [
    'EMENTA',
    'x',
    'VOTO',
    'Diante do exposto, preliminarmente...',
    'Mérito.',
    'Pelo exposto, dou provimento.',
    'VOTO-VISTA',
    'Ante o exposto, acompanho.',
  ].join('\n\n');
  const { sections } = segmentDocument(text, 'court_decision');
  expect(sections.map((s) => s.kind)).toEqual(['headnote', 'vote', 'operative_part', 'vote']);
  expect(text.slice(sections[2]!.start, sections[2]!.end)).toBe('Pelo exposto, dou provimento.');
});

test('normative act sections with chapter as parentLabel', () => {
  const ato = [
    'RESOLUÇÃO Nº 615, DE 11 DE MARÇO DE 2025',
    'CONSIDERANDO a ...',
    'CONSIDERANDO o ...',
    'RESOLVE:',
    'CAPÍTULO I',
    'Art. 1º Esta Resolução...',
    'Art. 2º Para fins...',
    'ANEXO I',
    'Tabela...',
  ].join('\n\n');
  const { sections } = segmentDocument(ato, 'normative_act');
  expect(sections.map((s) => s.kind)).toEqual(['preamble', 'recitals', 'article', 'article', 'annex']);
  expect(sections[3]).toMatchObject({ label: 'Art. 2º', parentLabel: 'CAPÍTULO I' });
  expect(sections[2]).toMatchObject({ label: 'Art. 1º', parentLabel: 'CAPÍTULO I' });
  expect(ato.slice(sections[2]!.start, sections[2]!.end)).toBe('CAPÍTULO I\n\nArt. 1º Esta Resolução...');
  expect(sections[4]!.label).toBe('Anexo I');
  expect(sections[1]!.label).toBe('Considerandos');
});

test('articles keep their paragraphs and numbers from 10 drop the ordinal sign', () => {
  const ato = ['Art. 9º Texto.', '§ 1º Parágrafo.', 'Art. 10. Outro.'].join('\n\n');
  const { sections } = segmentDocument(ato, 'normative_act');
  expect(sections.map((s) => s.label)).toEqual(['Art. 9º', 'Art. 10']);
  expect(ato.slice(sections[0]!.start, sections[0]!.end)).toBe('Art. 9º Texto.\n\n§ 1º Parágrafo.');
});

test('fallback to generic paragraphs', () => {
  const r = segmentDocument('Primeiro parágrafo.\n\nSegundo parágrafo.', 'court_decision');
  expect(r.fallback).toBe(true);
  expect(r.sections.map((s) => s.kind)).toEqual(['paragraph', 'paragraph']);
  expect(r.sections.map((s) => s.label)).toEqual(['Parágrafo 1', 'Parágrafo 2']);
  expect(segmentDocument('Sem artigos aqui.', 'normative_act').fallback).toBe(true);
});

test('generic type is never a fallback', () => {
  const r = segmentDocument('Um.\n\nDois.', 'generic');
  expect(r.fallback).toBe(false);
  expect(r.sections).toHaveLength(2);
});
