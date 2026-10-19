import { cleanerAgent } from '../../../agents/cleaner/agent';
import { runAgent } from '../../../core/agent';
import { mapWithConcurrency } from '../../../core/concurrency';
import type { StageContext } from '../../../core/context';
import type { Line, LineDocument } from '../types';
import { type CleaningResult, removeLines } from './types';

const BATCH_SIZE = 200;
const EDGE_LINES = 3;

function candidates(doc: LineDocument, mode: 'edges' | 'full'): Line[] {
  if (mode === 'full') return doc.pages.flatMap((p) => p.lines);
  return doc.pages.flatMap((p) => {
    const head = p.lines.slice(0, EDGE_LINES);
    const tail = p.lines.slice(Math.max(EDGE_LINES, p.lines.length - EDGE_LINES));
    return [...head, ...tail];
  });
}

/** Asks the cleaner which lines are noise (edges of each page or every line, in batches) and removes them. */
export async function applyLlmCleanup(
  doc: LineDocument,
  mode: 'edges' | 'full',
  ctx: StageContext,
): Promise<CleaningResult> {
  const sent = candidates(doc, mode);
  const batches: Line[][] = [];
  for (let i = 0; i < sent.length; i += BATCH_SIZE) batches.push(sent.slice(i, i + BATCH_SIZE));
  const sentIds = new Set(sent.map((l) => l.id));
  const toRemove = new Set<number>();
  let done = 0;
  await mapWithConcurrency(
    batches,
    ctx.llmConcurrency,
    async (batch) => {
      const out = await runAgent(cleanerAgent, { lines: batch.map(({ id, page, text }) => ({ id, page, text })) }, ctx);
      for (const id of out.removeLineIds) if (sentIds.has(id)) toRemove.add(id);
      ctx.events.progress(`Limpeza por LLM: lote ${++done}/${batches.length}`, done, batches.length);
    },
    ctx.signal,
  );
  return removeLines(doc, 'llm_cleaner', (line) => toRemove.has(line.id));
}
