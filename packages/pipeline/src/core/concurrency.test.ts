import { mapWithConcurrency } from './concurrency';

test('mapWithConcurrency respects limit and order', async () => {
  let active = 0;
  let peak = 0;
  const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return n * 2;
  });
  expect(peak).toBe(2);
  expect(out).toEqual([2, 4, 6, 8, 10]);
});

test('mapWithConcurrency aborts', async () => {
  const ac = new AbortController();
  ac.abort();
  await expect(mapWithConcurrency([1], 1, async (n) => n, ac.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
});

test('mapWithConcurrency stops scheduling after an abort mid-run', async () => {
  const ac = new AbortController();
  const started: number[] = [];
  const run = mapWithConcurrency(
    [1, 2, 3, 4],
    1,
    async (n) => {
      started.push(n);
      if (n === 2) ac.abort();
      return n;
    },
    ac.signal,
  );
  await expect(run).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(started).toEqual([1, 2]);
});

test('mapWithConcurrency propagates the first rejection', async () => {
  await expect(
    mapWithConcurrency([1, 2], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    }),
  ).rejects.toThrow('boom');
});
