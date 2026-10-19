import type { Fact } from '@app/shared';
import { render, screen } from '@testing-library/react';
import { FactValue } from './fact-value';

const base = {
  id: 'F01',
  label: 'x',
  evidence: [],
  confidence: 'high',
  status: 'confirmed',
  uncertaintyReasons: [],
} as const;
const fact = (f: object) => ({ ...base, ...f }) as unknown as Fact;

const factsOfEveryCategory: [Fact, string][] = [
  [fact({ category: 'date', value: { iso: '2025-03-24', role: 'judgment' } }), '24/03/2025 (julgamento)'],
  [
    fact({ category: 'deadline', value: { amount: 15, unit: 'days', businessDays: true, trigger: 'intimação' } }),
    '15 dias úteis, a partir de intimação',
  ],
  [
    fact({ category: 'monetary_value', value: { amount: 10_000, currency: 'BRL', role: 'indenização' } }),
    'R$ 10.000,00',
  ],
  [
    fact({
      category: 'obligation',
      value: { bearer: 'Os tribunais', action: 'publicar os dados', modality: 'must', condition: null },
    }),
    'Os tribunais deve publicar os dados',
  ],
  [
    fact({
      category: 'obligation',
      value: { bearer: 'O réu', action: 'contratar', modality: 'must_not', condition: null },
    }),
    'O réu não deve contratar',
  ],
  [
    fact({
      category: 'decision',
      value: { outcome: 'denied', description: 'Recurso desprovido', unanimity: 'unanimous' },
    }),
    'Negado (unânime)',
  ],
  [
    fact({ category: 'decision', value: { outcome: 'granted', description: 'x', unanimity: 'majority' } }),
    'Provido (por maioria)',
  ],
  [
    fact({
      category: 'legal_reference',
      value: { normType: 'Lei', number: '13.105', year: 2015, provision: 'art. 942', citation: 'art. 942 do CPC' },
    }),
    'art. 942 do CPC',
  ],
  [
    fact({
      category: 'amendment',
      value: { targetAct: 'Resolução 615/2025', targetProvision: 'art. 15', changeType: 'amended', newText: null },
    }),
    'alterou art. 15 de Resolução 615/2025',
  ],
];

test.each(factsOfEveryCategory)('FactValue renders %#', (fact, expected) => {
  render(<FactValue fact={fact} />);
  expect(screen.getByText(expected)).toBeInTheDocument();
});
