import { z } from 'zod';
import { ExtractorOutput, FactDraft } from './facts';
import { Summary } from './summary';
import { ClaimDraft } from './verification';

const deadline = {
  id: 'F01',
  category: 'deadline',
  label: 'Prazo para recorrer',
  value: { amount: 15, unit: 'days', businessDays: true, trigger: 'intimação' },
  evidence: [{ quote: '15 (quinze) dias úteis' }],
  confidence: 'high',
};

test('accepts a deadline fact', () => expect(FactDraft.parse(deadline)).toEqual(deadline));

test('rejects value of another category', () =>
  expect(() => FactDraft.parse({ ...deadline, category: 'date' })).toThrow());

test('rejects empty evidence', () => expect(() => FactDraft.parse({ ...deadline, evidence: [] })).toThrow());

test('LLM schemas have no allOf', () => {
  for (const s of [ExtractorOutput, Summary, z.object({ claims: z.array(ClaimDraft) })])
    expect(JSON.stringify(z.toJSONSchema(s))).not.toContain('"allOf"');
});
