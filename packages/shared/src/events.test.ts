import { CLAIM_VERDICTS, SOURCE_VERDICTS } from './domain/enums';
import { RunEvent } from './events';

test('parses stage.progress', () =>
  expect(
    RunEvent.parse({
      type: 'stage.progress',
      runId: crypto.randomUUID(),
      seq: 3,
      createdAt: new Date().toISOString(),
      stage: 'information_extraction',
      message: 'Extraindo fatos: chunk 3/8',
      current: 3,
      total: 8,
    }).type,
  ).toBe('stage.progress'));

test('verdict subsets', () => {
  expect(SOURCE_VERDICTS).toEqual(['consistent', 'divergent', 'omitted', 'unverifiable']);
  expect(CLAIM_VERDICTS).toEqual(['supported', 'divergent', 'unsupported', 'unverifiable']);
});
