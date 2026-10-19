import type { Section, SectionKind } from '@app/shared';
import { buildSections } from './build';
import { type SectionStart, splitParagraphs } from './paragraphs';

const MARKERS: Record<string, { kind: SectionKind; label: string }> = {
  EMENTA: { kind: 'headnote', label: 'Ementa' },
  ACÓRDÃO: { kind: 'judgment', label: 'Acórdão' },
  ACORDÃO: { kind: 'judgment', label: 'Acórdão' },
  RELATÓRIO: { kind: 'report', label: 'Relatório' },
  VOTO: { kind: 'vote', label: 'Voto' },
  'VOTO-VISTA': { kind: 'vote', label: 'Voto' },
  'VOTO VISTA': { kind: 'vote', label: 'Voto' },
  'VOTO VENCIDO': { kind: 'vote', label: 'Voto' },
  'CERTIDÃO DE JULGAMENTO': { kind: 'judgment_certificate', label: 'Certidão de julgamento' },
};

const OPERATIVE =
  /^(Ante o exposto|Diante do exposto|Pelo exposto|Em face do exposto|Isso posto|Com essas considerações)/;

/** Sections of an acórdão; null when neither EMENTA nor VOTO is present (caller falls back to generic). */
export function segmentCourtDecision(text: string): Section[] | null {
  const paragraphs = splitParagraphs(text);
  const starts: SectionStart<SectionKind>[] = [];
  for (const p of paragraphs) {
    const marker = MARKERS[p.text.replace(/[:.]$/, '').trim()];
    if (marker) starts.push({ paragraph: p.index, kind: marker.kind, label: marker.label, parentLabel: null });
  }
  if (!starts.some((s) => s.kind === 'headnote' || s.kind === 'vote')) return null;

  const firstVote = starts.findIndex((s) => s.kind === 'vote');
  if (firstVote >= 0) {
    const voteStart = (starts[firstVote] as SectionStart).paragraph;
    const voteEnd = starts[firstVote + 1]?.paragraph ?? paragraphs.length;
    const operative = paragraphs
      .slice(voteStart + 1, voteEnd)
      .filter((p) => OPERATIVE.test(p.text))
      .at(-1);
    if (operative)
      starts.splice(firstVote + 1, 0, {
        paragraph: operative.index,
        kind: 'operative_part',
        label: 'Dispositivo',
        parentLabel: null,
      });
  }
  return buildSections(paragraphs, starts);
}
