import type { DocumentType, Section } from '@app/shared';
import { segmentCourtDecision } from './court-decision';
import { segmentGeneric } from './generic';
import { segmentNormativeAct } from './normative-act';

/** Deterministic segmentation by markers; falls back to one section per paragraph when markers are missing. */
export function segmentDocument(canonicalText: string, type: DocumentType): { sections: Section[]; fallback: boolean } {
  if (type === 'generic') return { sections: segmentGeneric(canonicalText), fallback: false };
  const sections = type === 'court_decision' ? segmentCourtDecision(canonicalText) : segmentNormativeAct(canonicalText);
  return sections ? { sections, fallback: false } : { sections: segmentGeneric(canonicalText), fallback: true };
}
