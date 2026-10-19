import { estimateCostUsd, findModel, MODEL_CATALOG, MODEL_REFS, providerOf } from './catalog';

test('estimateCostUsd', () => {
  const e = findModel(MODEL_REFS.openaiMain)!;
  expect(estimateCostUsd(e.ref, 1_000_000, 0)).toBeCloseTo(e.pricePerMTokens.input);
  expect(estimateCostUsd(e.ref, 0, 1_000_000)).toBeCloseTo(e.pricePerMTokens.output);
});

test('every MODEL_REFS entry is in the catalog with the provider of its prefix', () => {
  for (const ref of Object.values(MODEL_REFS)) {
    const entry = findModel(ref);
    expect(entry, ref).toBeDefined();
    expect(entry!.provider).toBe(providerOf(ref));
  }
  expect(new Set(MODEL_CATALOG.map((m) => m.ref)).size).toBe(MODEL_CATALOG.length);
});

test('providerOf rejects unknown providers', () => expect(() => providerOf('mistral:large')).toThrow());
