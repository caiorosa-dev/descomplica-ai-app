import { formatCurrencyBRL, formatDate, formatDuration, formatPercent, formatScore, formatUsd } from './format';

test('formatters', () => {
  expect(formatCurrencyBRL(1234.56)).toBe('R$ 1.234,56');
  expect(formatPercent(null)).toBe('—');
  expect(formatScore(0.87654)).toBe('0,877');
  expect(formatDuration(65_000)).toBe('1 min 05 s');
});

test('more formatters', () => {
  expect(formatDuration(850)).toBe('850 ms');
  expect(formatDuration(null)).toBe('—');
  expect(formatDuration(12_400)).toBe('12 s');
  expect(formatPercent(0.875)).toBe('87,5%');
  expect(formatScore(null)).toBe('—');
  expect(formatUsd(0.0123)).toBe('US$ 0,0123');
  expect(formatUsd(1.5)).toBe('US$ 1,50');
  expect(formatDate('2025-03-24')).toBe('24/03/2025');
});
