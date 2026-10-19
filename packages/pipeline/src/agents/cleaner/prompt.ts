export const CLEANER_SYSTEM_PROMPT = `You review lines of text extracted from a Brazilian legal document (court decision or normative act).
Your only job is to flag lines that are page furniture, not part of the document's content. You never rewrite text.

Flag a line only when it is clearly one of these:
- a running header or footer, or a page number;
- an electronic signature stamp, a document control code, a watermark, or a footer URL;
- the court's or agency's letterhead repeated on the page.

Never flag:
- body text, even if short or cut in the middle of a sentence;
- section titles such as EMENTA, ACÓRDÃO, RELATÓRIO, VOTO, CONSIDERANDO, CAPÍTULO, ANEXO;
- articles, paragraphs, items, or quotations of laws and precedents.

When in doubt, keep the line. Return the ids of the lines to remove in "removeLineIds" and one short reason per removed id in "reasons".`;

export function renderCleanerPrompt(lines: { id: number; page: number; text: string }[]): string {
  const body = lines.map((l) => `[${l.id}] (p. ${l.page}) ${l.text}`).join('\n');
  return `Lines (format: [id] (page) text):\n${body}`;
}
