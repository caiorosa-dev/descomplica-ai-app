import type { StageName } from '@app/shared';
import type { Stage } from '../core/stage';
import { informationExtractionStage } from './information-extraction/stage';
import { reportStage } from './report/stage';
import { similarityStage } from './similarity/stage';
import { summarizationStage } from './summarization/stage';
import { textExtractionStage } from './text-extraction/stage';
import { verificationStage } from './verification/stage';

export {
  informationExtractionStage,
  reportStage,
  similarityStage,
  summarizationStage,
  textExtractionStage,
  verificationStage,
};

// biome-ignore lint/suspicious/noExplicitAny: each stage has its own input and output types.
export const STAGES_BY_NAME: Record<StageName, Stage<any, any>> = {
  text_extraction: textExtractionStage,
  information_extraction: informationExtractionStage,
  summarization: summarizationStage,
  similarity: similarityStage,
  verification: verificationStage,
  report: reportStage,
};
