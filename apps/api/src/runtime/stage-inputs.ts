import { PipelineError, type RunTotals } from '@app/pipeline';
import type { StageName } from '@app/shared';
import type { StageOutputs } from './persistence/load-outputs';

function need<S extends StageName>(outputs: Partial<StageOutputs>, stage: S): StageOutputs[S] {
  const output = outputs[stage];
  if (!output) throw new PipelineError('INTERNAL_ERROR', `Missing checkpoint of stage ${stage}`);
  return output;
}

/** Builds a stage's input from the previous stages' outputs (spec §7, runner step 2). */
export function buildStageInput(
  stage: StageName,
  outputs: Partial<StageOutputs>,
  extra: { buffer: Uint8Array; filename: string; totals: RunTotals },
): unknown {
  switch (stage) {
    case 'text_extraction':
      return { buffer: extra.buffer, filename: extra.filename };
    case 'information_extraction':
      return { text: need(outputs, 'text_extraction') };
    case 'summarization':
      return { text: need(outputs, 'text_extraction'), info: need(outputs, 'information_extraction') };
    case 'similarity':
      return {
        text: need(outputs, 'text_extraction'),
        info: need(outputs, 'information_extraction'),
        summarization: need(outputs, 'summarization'),
      };
    case 'verification':
      return {
        text: need(outputs, 'text_extraction'),
        info: need(outputs, 'information_extraction'),
        summarization: need(outputs, 'summarization'),
        similarity: need(outputs, 'similarity'),
      };
    case 'report':
      return {
        info: need(outputs, 'information_extraction'),
        summarization: need(outputs, 'summarization'),
        similarity: need(outputs, 'similarity'),
        verification: need(outputs, 'verification'),
        totals: extra.totals,
      };
  }
}
