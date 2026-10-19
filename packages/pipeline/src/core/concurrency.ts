import { PipelineError } from './errors';

function cancelled(): PipelineError {
  return new PipelineError('CANCELLED', 'Operation aborted');
}

/** Maps with at most `limit` calls in flight, preserving input order; rejects with CANCELLED when aborted. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  if (signal?.aborted) throw cancelled();
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;

  return new Promise<R[]>((resolve, reject) => {
    const fail = (e: unknown) => {
      if (failed) return;
      failed = true;
      signal?.removeEventListener('abort', onAbort);
      reject(e);
    };
    const onAbort = () => fail(cancelled());
    signal?.addEventListener('abort', onAbort, { once: true });

    let active = 0;
    const launch = () => {
      if (failed) return;
      if (next >= items.length && active === 0) {
        signal?.removeEventListener('abort', onAbort);
        resolve(results);
        return;
      }
      while (!failed && active < Math.max(1, limit) && next < items.length) {
        if (signal?.aborted) return fail(cancelled());
        const index = next++;
        active++;
        fn(items[index] as T, index).then(
          (value) => {
            results[index] = value;
            active--;
            launch();
          },
          (e) => fail(e),
        );
      }
    };
    launch();
  });
}
