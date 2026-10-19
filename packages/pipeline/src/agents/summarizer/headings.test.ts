import { headingsFor, SECTION_HEADINGS } from './headings';

test('amendment headings', () =>
  expect(headingsFor('normative_act', 'amendment')).toEqual([
    'O que mudou',
    'Do que trata',
    'Quem precisa cumprir',
    'O que deve ser feito',
    'Prazos e vigência',
  ]));

test('headings per type', () => {
  expect(headingsFor('court_decision', null)).toEqual(SECTION_HEADINGS.court_decision);
  expect(headingsFor('court_decision', null)[1]).toBe('O que o tribunal decidiu');
  expect(headingsFor('generic', null)).toEqual(['Do que trata', 'Pontos principais', 'Prazos e valores']);
});
