import type { ObligationValue } from '@app/shared';
import { findDates } from './dates';
import { findDurations } from './durations';
import { findMoney } from './money';
import { parsePtNumberWords } from './numbers';
import { valueAppearsIn } from './value-check';

test.each([
  ['quinze', 15],
  ['trinta e cinco', 35],
  ['cento e vinte', 120],
  ['cem', 100],
  ['novecentos e noventa e nove', 999],
  ['um', 1],
  ['duas', 2],
  ['banana', null],
  ['vinte trinta', null],
  ['', null],
])('parsePtNumberWords(%s)', (t, n) => expect(parsePtNumberWords(t)).toBe(n));

test.each([
  ['julgado em 24 de março de 2025', '2025-03-24'],
  ['em 1º de janeiro de 2025', '2025-01-01'],
  ['DJe 24/03/2025', '2025-03-24'],
  ['em 24.3.2025', '2025-03-24'],
  ['em 05/06/25', '2025-06-05'],
  ['em 2 de Abril de 2024', '2024-04-02'],
])('findDates(%s)', (t, iso) => expect(findDates(t).map((d) => d.iso)).toEqual([iso]));

test('invalid date skipped', () => expect(findDates('31/02/2025')).toEqual([]));

test('law numbers and money are not dates', () => {
  expect(findDates('nos termos da Lei 11.419/2006')).toEqual([]);
  expect(findDates('R$ 1.234,56')).toEqual([]);
});

test('date spans point at the text', () => {
  const text = 'Publicado no DJe de 10/05/2022 e julgado em 3 de maio de 2022.';
  expect(findDates(text).map((d) => text.slice(d.start, d.end))).toEqual(['10/05/2022', '3 de maio de 2022']);
});

test.each([
  ['R$ 1.234,56', 1234.56],
  ['R$1234', 1234],
  ['R$ 10 mil', 10_000],
  ['R$ 2,5 milhões', 2_500_000],
  ['R$ 3 bilhões', 3e9],
  ['R$ 1 milhão', 1_000_000],
  ['10.000,00 reais', 10_000],
])('findMoney(%s)', (t, n) => expect(findMoney(t)[0]!.amount).toBeCloseTo(n));

test.each([
  ['15 (quinze) dias úteis', { amount: 15, unit: 'days', businessDays: true }],
  ['trinta dias', { amount: 30, unit: 'days', businessDays: null }],
  ['10 dias corridos', { amount: 10, unit: 'days', businessDays: false }],
  ['6 meses', { amount: 6, unit: 'months', businessDays: null }],
  ['cento e vinte dias', { amount: 120, unit: 'days', businessDays: null }],
  ['prazo de um ano', { amount: 1, unit: 'years', businessDays: null }],
  ['no prazo de 5 (cinco) dias', { amount: 5, unit: 'days', businessDays: null }],
])('findDurations(%s)', (t, d) => expect(findDurations(t)[0]).toMatchObject(d));

test('duration span covers number, unit and qualifier', () => {
  const text = 'no prazo de 15 (quinze) dias úteis, contados';
  const [d] = findDurations(text);
  expect(text.slice(d!.start, d!.end)).toBe('15 (quinze) dias úteis');
});

const obligation: ObligationValue = { bearer: 'os tribunais', action: 'publicar', modality: 'must', condition: null };

test('valueAppearsIn', () => {
  expect(valueAppearsIn('date', { iso: '2025-03-24', role: 'judgment' }, 'em 24/03/2025')).toBe(true);
  expect(valueAppearsIn('date', { iso: '2025-03-24', role: 'judgment' }, 'em 25/03/2025')).toBe(false);
  expect(
    valueAppearsIn('deadline', { amount: 15, unit: 'days', businessDays: true, trigger: null }, 'prazo de 15 dias'),
  ).toBe(true);
  expect(
    valueAppearsIn('deadline', { amount: 15, unit: 'days', businessDays: true, trigger: null }, '15 dias corridos'),
  ).toBe(false);
  expect(valueAppearsIn('monetary_value', { amount: 10_000, currency: 'BRL', role: 'x' }, 'de R$ 10 mil')).toBe(true);
  expect(valueAppearsIn('monetary_value', { amount: 10_000, currency: 'BRL', role: 'x' }, 'de R$ 1.000,00')).toBe(
    false,
  );
  expect(valueAppearsIn('obligation', obligation, 'qualquer')).toBeNull();
});
