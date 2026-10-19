import type { Classification, TextExtractionOutput } from '@app/shared';
import { classifierAgent } from '../../agents/classifier/agent';
import { runAgent } from '../../core/agent';
import type { StageContext } from '../../core/context';
import { countTokens, headTokens, tailTokens } from '../../core/tokens';

const HEAD_TOKENS = 4000;
const TAIL_TOKENS = 1000;

/** Classifies from the first ~4k and last ~1k tokens; a forced type (config) always wins over the model. */
export async function classifyDocument(text: TextExtractionOutput, ctx: StageContext): Promise<Classification> {
  const canonical = text.canonicalText;
  const mode = ctx.config.classification.mode;
  const forcedType = mode === 'auto' ? null : mode;
  ctx.events.progress('Classificando o documento');
  const result = await runAgent(
    classifierAgent,
    {
      head: headTokens(canonical, HEAD_TOKENS),
      tail: countTokens(canonical) > HEAD_TOKENS + TAIL_TOKENS ? tailTokens(canonical, TAIL_TOKENS) : '',
      forcedType,
    },
    ctx,
  );
  const documentType = forcedType ?? result.documentType;
  const classification: Classification = {
    ...result,
    documentType,
    subtype: documentType === 'normative_act' ? result.subtype : null,
  };
  if (classification.confidence === 'low')
    ctx.events.warn('classification_low_confidence', 'A classificação do documento tem baixa confiança.');
  return classification;
}
