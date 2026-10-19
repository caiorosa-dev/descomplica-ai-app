import { parseRunsParam } from './parse-runs-param';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

test('parseRunsParam', () => {
  expect(parseRunsParam(`${A},${B}`)).toEqual([A, B]);
  expect(parseRunsParam(`${A}`)).toBeNull();
  expect(parseRunsParam(`${A},${A}`)).toBeNull();
  expect(parseRunsParam(undefined)).toBeNull();
  expect(parseRunsParam(`${A},not-a-uuid`)).toBeNull();
  expect(parseRunsParam(`${A},${B},${A}`)).toBeNull();
  expect(parseRunsParam(42)).toBeNull();
});
