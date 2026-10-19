import type { CategoryValue, Claim, FactCategory } from '@app/shared';
import { compareValues, normalizeCitation, retypeClaimValue } from './compare';

const claim = (c: Partial<Claim>): Claim => ({
  id: 'A01',
  text: '',
  paragraphRef: null,
  category: null,
  value: null,
  ...c,
});
const dl = (amount: number, unit: 'days' | 'months', businessDays: boolean | null): CategoryValue => ({
  amount,
  unit,
  businessDays,
  trigger: null,
});
const ref = (citation: string): CategoryValue => ({
  normType: 'lei',
  number: null,
  year: null,
  provision: null,
  citation,
});
const obl = (action: string): CategoryValue => ({ bearer: 'x', action, modality: 'must', condition: null });

test('retype fixes LLM-normalized money and dates (Review Focus 2)', () => {
  const c = retypeClaimValue(
    claim({
      text: 'A indenização é de R$ 10 mil.',
      category: 'monetary_value',
      value: { amount: 10, currency: 'BRL', role: 'indenização' },
    }),
  );
  expect(c.value).toMatchObject({ amount: 10_000, role: 'indenização' });
  expect(compareValues('monetary_value', c.value!, { amount: 10_000, currency: 'BRL', role: 'x' })).toBe('equal');
  const d = retypeClaimValue(
    claim({
      text: 'O julgamento foi em 24 de março de 2025.',
      category: 'date',
      value: { iso: '2025-03-25', role: 'judgment' },
    }),
  );
  expect(d.value).toEqual({ iso: '2025-03-24', role: 'judgment' });
  expect(compareValues('date', d.value!, { iso: '2025-03-24', role: 'judgment' })).toBe('equal');
});

test('retype deadline keeps trigger and takes amount, unit and business days from the text', () => {
  const c = retypeClaimValue(
    claim({
      text: 'O prazo é de 15 dias úteis.',
      category: 'deadline',
      value: { amount: 10, unit: 'days', businessDays: null, trigger: 'intimação' },
    }),
  );
  expect(c.value).toEqual({ amount: 15, unit: 'days', businessDays: true, trigger: 'intimação' });
});

test('retype leaves value when parser finds zero or several entities', () => {
  const none = claim({
    text: 'Houve indenização.',
    category: 'monetary_value',
    value: { amount: 5, currency: 'BRL', role: 'x' },
  });
  expect(retypeClaimValue(none).value).toEqual(none.value);
  const two = claim({
    text: 'Entre 01/01/2024 e 02/02/2024.',
    category: 'date',
    value: { iso: '2024-05-05', role: 'other' },
  });
  expect(retypeClaimValue(two).value).toEqual(two.value);
  const untyped = claim({ text: 'Em 01/01/2024.' });
  expect(retypeClaimValue(untyped)).toEqual(untyped);
});

test.each([
  ['date', { iso: '2025-03-24', role: 'judgment' }, { iso: '2025-03-24', role: 'publication' }, 'equal'],
  ['date', { iso: '2025-03-24', role: 'judgment' }, { iso: '2025-03-25', role: 'judgment' }, 'different'],
  ['deadline', dl(15, 'days', true), dl(15, 'days', null), 'equal'],
  ['deadline', dl(15, 'days', true), dl(15, 'days', false), 'different'],
  ['deadline', dl(15, 'days', null), dl(15, 'months', null), 'different'],
  [
    'monetary_value',
    { amount: 1000, currency: 'BRL', role: 'a' },
    { amount: 1000.001, currency: 'BRL', role: 'b' },
    'equal',
  ],
  ['legal_reference', ref('Lei nº 13.105/2015, art. 942'), ref('Lei 13.105/2015, art. 942'), 'equal'],
  ['legal_reference', ref('art. 942 do Código de Processo Civil'), ref('art. 942 do CPC'), 'equal'],
  ['legal_reference', ref('art. 942 do CPC'), ref('art. 943 do CPC'), 'different'],
  ['obligation', obl('a'), obl('b'), 'incomparable'],
])('compareValues %s', (cat, a, b, r) =>
  expect(compareValues(cat as FactCategory, a as CategoryValue, b as CategoryValue)).toBe(r),
);

test('normalizeCitation', () => {
  expect(normalizeCitation('Constituição Federal, art. 5º')).toBe('cfart5');
  expect(normalizeCitation('Lei Complementar n. 123')).toBe('lc123');
});
