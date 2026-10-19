import { type RemovedLine, TextExtractionOutput } from '@app/shared';
import type { StageContext } from '../../core/context';
import { PipelineError } from '../../core/errors';
import type { Stage } from '../../core/stage';
import { countTokens } from '../../core/tokens';
import { buildCanonicalText } from './assembly/canonical';
import { dehyphenate } from './assembly/dehyphenate';
import { paragraphBreaks } from './assembly/paragraphs';
import { removeBoilerplate } from './cleaning/boilerplate';
import { normalizeUnicode } from './cleaning/normalize-unicode';
import { removePageNumbers } from './cleaning/page-numbers';
import { removeRepeatedEdges } from './cleaning/repeated-edges';
import type { CleaningResult } from './cleaning/types';
import { detectFormat } from './detect-format';
import { extractLines } from './extractors';
import { allLines, type Line, type LineDocument } from './types';

export interface TextExtractionInput {
  buffer: Uint8Array;
  filename: string;
}

export type LlmCleanupFn = (doc: LineDocument, mode: 'edges' | 'full', ctx: StageContext) => Promise<CleaningResult>;

/** Replaced by the LLM cleaner (Task 10); never called while `llmCleanup` is 'off'. */
export const llmCleanupHook: LlmCleanupFn = async (doc) => ({ doc, removed: [] });

function regroup(doc: LineDocument, lines: Line[]): LineDocument {
  return { ...doc, pages: doc.pages.map((page) => ({ ...page, lines: lines.filter((l) => l.page === page.number) })) };
}

function countByRule(removed: RemovedLine[]): { rule: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of removed) counts.set(r.rule, (counts.get(r.rule) ?? 0) + 1);
  return [...counts.entries()].map(([rule, count]) => ({ rule, count }));
}

export const textExtractionStage: Stage<TextExtractionInput, TextExtractionOutput> = {
  name: 'text_extraction',
  output: TextExtractionOutput,
  async run(input, ctx) {
    const config = ctx.config.textExtraction;
    const progress = (message: string) => ctx.events.progress(message);

    progress('Verificando o arquivo');
    const maxBytes = config.maxFileSizeMb * 1024 * 1024;
    if (input.buffer.byteLength > maxBytes)
      throw new PipelineError('FILE_TOO_LARGE', `File has ${input.buffer.byteLength} bytes (max ${maxBytes})`, {
        sizeBytes: input.buffer.byteLength,
        maxBytes,
      });

    progress('Detectando o formato');
    const format = await detectFormat(input.buffer, input.filename);
    progress('Extraindo o texto');
    let doc = await extractLines(input.buffer, format, { dropStrikethrough: config.html.dropStrikethrough });
    const charsBefore = allLines(doc).reduce((sum, l) => sum + l.text.length, 0);

    if (format === 'pdf' && doc.pages.length > 0 && charsBefore / doc.pages.length < config.minCharsPerPage)
      throw new PipelineError('LOW_TEXT_DENSITY', `Average ${charsBefore / doc.pages.length} chars per page`, {
        charsPerPage: charsBefore / doc.pages.length,
      });

    const removed: RemovedLine[] = [];
    const apply = (result: CleaningResult) => {
      doc = result.doc;
      removed.push(...result.removed);
    };
    if (config.cleaning.normalizeUnicode) {
      progress('Normalizando caracteres');
      doc = normalizeUnicode(doc);
    }
    if (config.cleaning.removeRepeatedHeadersFooters) {
      progress('Removendo cabeçalhos e rodapés');
      apply(removeRepeatedEdges(doc, config.pdf));
    }
    if (config.cleaning.removePageNumbers) {
      progress('Removendo números de página');
      apply(removePageNumbers(doc));
    }
    if (config.cleaning.boilerplatePatternSets.length > 0) {
      progress('Removendo carimbos e cabeçalhos padronizados');
      apply(removeBoilerplate(doc, config.cleaning.boilerplatePatternSets));
    }
    if (config.cleaning.llmCleanup !== 'off') {
      progress('Limpando com o modelo de linguagem');
      apply(await llmCleanupHook(doc, config.cleaning.llmCleanup, ctx));
    }

    let lines = allLines(doc);
    if (config.cleaning.dehyphenate) {
      progress('Juntando palavras hifenizadas');
      lines = dehyphenate(lines);
    }
    progress('Reconstruindo parágrafos');
    const breaks = config.cleaning.rebuildParagraphs ? paragraphBreaks(regroup(doc, lines)) : lines.map(() => true);
    progress('Montando o texto canônico');
    const { canonicalText, pageMap } = buildCanonicalText(lines, breaks);

    return {
      sourceFormat: format,
      canonicalText,
      pageMap,
      cleaningReport: { removed, charsBefore, charsAfter: canonicalText.length, removedByRule: countByRule(removed) },
      stats: {
        pages: doc.pages.length,
        words: canonicalText.trim() ? canonicalText.trim().split(/\s+/).length : 0,
        estimatedTokens: countTokens(canonicalText),
      },
    };
  },
};
