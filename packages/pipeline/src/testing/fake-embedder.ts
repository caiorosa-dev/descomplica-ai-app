import type { Embedder } from '../core/context';
import { normalizeVector } from '../stages/similarity/metrics';

export interface FakeEmbedder extends Embedder {
  calls: { texts: string[]; model: string; dimensions: number | null }[];
}

function hash(word: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic bag-of-words embedder (hashed into `dims` dimensions, L2-normalized) that records its calls. */
export function createFakeEmbedder(dims = 32): FakeEmbedder {
  const calls: FakeEmbedder['calls'] = [];
  return {
    calls,
    async embed(texts, options) {
      calls.push({ texts, model: options.model, dimensions: options.dimensions });
      return texts.map((text) => {
        const v = new Array<number>(dims).fill(0);
        for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
          const h = hash(word);
          v[h % dims] = (v[h % dims] as number) + 1;
        }
        return normalizeVector(v);
      });
    },
  };
}
