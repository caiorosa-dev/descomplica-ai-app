import type { Section, SectionKind } from '@app/shared';
import { buildSections } from './build';
import { type SectionStart, splitParagraphs } from './paragraphs';

const RECITAL = /^CONSIDERANDO\b/;
const ARTICLE = /^Art\.\s*(\d+)/;
const CHAPTER = /^CAP[ÍI]TULO\b/;
const ANNEX = /^ANEXO\b\s*([IVXLCDM\d]+)?/;
const MAX_PARENT_LABEL = 80;

function articleLabel(n: number): string {
  return n < 10 ? `Art. ${n}º` : `Art. ${n}`;
}

/** Sections of a normative act; null when there is no article (caller falls back to generic). */
export function segmentNormativeAct(text: string): Section[] | null {
  const paragraphs = splitParagraphs(text);
  const starts: SectionStart<SectionKind>[] = [];
  let chapter: string | null = null;
  let pendingChapterAt: number | null = null;
  let inRecitals = false;
  let inAnnex = false;
  for (const p of paragraphs) {
    const annex = ANNEX.exec(p.text);
    if (annex) {
      starts.push({
        paragraph: p.index,
        kind: 'annex',
        label: annex[1] ? `Anexo ${annex[1]}` : 'Anexo',
        parentLabel: null,
      });
      inAnnex = true;
      inRecitals = false;
      continue;
    }
    if (inAnnex) continue;
    if (RECITAL.test(p.text)) {
      if (!inRecitals) starts.push({ paragraph: p.index, kind: 'recitals', label: 'Considerandos', parentLabel: null });
      inRecitals = true;
      continue;
    }
    if (CHAPTER.test(p.text)) {
      chapter = p.text.slice(0, MAX_PARENT_LABEL);
      pendingChapterAt ??= p.index;
      inRecitals = false;
      continue;
    }
    const article = ARTICLE.exec(p.text);
    if (article) {
      starts.push({
        paragraph: pendingChapterAt ?? p.index,
        kind: 'article',
        label: articleLabel(Number(article[1])),
        parentLabel: chapter,
      });
      pendingChapterAt = null;
      inRecitals = false;
    }
  }
  if (!starts.some((s) => s.kind === 'article')) return null;
  return buildSections(paragraphs, starts);
}
