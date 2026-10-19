import { readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { type CrossSimilarityDto, type FactCategory, parseCorpusManifest } from '@app/shared';
import { createApiClient, waitForRun } from './http-client';
import { aggregate, type EvalRow } from './report/aggregate';
import { writeReport } from './report/write';

const root = process.env.INIT_CWD ?? process.cwd();
const fromRoot = (p: string) => (isAbsolute(p) ? p : resolve(root, p));

const { values } = parseArgs({
  options: {
    preset: { type: 'string', multiple: true },
    only: { type: 'string', multiple: true },
    api: { type: 'string', default: 'http://localhost:3333' },
    concurrency: { type: 'string', default: '2' },
    yes: { type: 'boolean', default: false },
  },
});
const presetSlugs = values.preset ?? [];
if (presetSlugs.length === 0) {
  console.error(
    'Uso: pnpm eval:corpus --preset <slug> [--preset <slug>] [--only <key>] [--api <url>] [--concurrency <n>] [--yes]',
  );
  process.exit(1);
}

const client = createApiClient(values.api);
const manifest = parseCorpusManifest(
  JSON.parse(readFileSync(join(fromRoot(process.env.CORPUS_DIR ?? './corpus'), 'manifest.json'), 'utf8')),
);
const documents = (await client.listDocuments()).filter(
  (d) => d.source === 'corpus' && (!values.only || values.only.includes(d.corpusKey ?? '')),
);
const presets = (await client.listPresets()).filter((p) => presetSlugs.includes(p.slug));
const missing = presetSlugs.filter((s) => !presets.some((p) => p.slug === s));
if (missing.length) throw new Error(`Presets não encontrados: ${missing.join(', ')}`);

const jobs = presets.flatMap((preset) => documents.map((document) => ({ preset, document })));
console.log(
  `Serão criadas ${jobs.length} execuções (${documents.length} documentos × ${presets.length} presets), com custo de API real.`,
);
if (!values.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Continuar? (s/N) ');
  rl.close();
  if (answer.trim().toLowerCase() !== 's') process.exit(0);
}

const rows: EvalRow[] = [];
const concurrency = Math.max(1, Number(values.concurrency));
let next = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < jobs.length) {
      const { preset, document } = jobs[next++] as (typeof jobs)[number];
      const created = await client.createRun({ documentId: document.id, presetId: preset.id, label: 'eval-corpus' });
      const run = await waitForRun(client, created.id);
      const result = run.status === 'completed' ? await client.getResult(run.id) : null;
      const m = result?.metrics;
      const factsByCategory: Partial<Record<FactCategory, number>> = {};
      for (const f of result?.facts ?? []) factsByCategory[f.category] = (factsByCategory[f.category] ?? 0) + 1;
      rows.push({
        key: document.corpusKey ?? document.filename,
        preset: preset.slug,
        runId: run.id,
        status: run.status,
        expectedType: manifest.find((e) => e.key === document.corpusKey)?.expectedType ?? null,
        detectedType: result?.classification?.documentType ?? null,
        factsConfirmed: m?.factsConfirmed ?? 0,
        factsUncertain: m?.factsUncertain ?? 0,
        factsByCategory,
        readabilitySource: m?.readabilitySource ?? null,
        readabilitySummary: m?.readabilitySummary ?? null,
        compressionRatio: m?.compressionRatio ?? null,
        centroid: m?.centroid ?? null,
        coverage: m?.coverage ?? null,
        support: m?.support ?? null,
        alignmentF1: m?.alignmentF1 ?? null,
        factualConsistency: m?.factualConsistency ?? null,
        claimSupport: m?.claimSupport ?? null,
        unverifiableCount: m?.unverifiableCount ?? 0,
        alertsHigh: m?.alertsHigh ?? 0,
        alertsMedium: m?.alertsMedium ?? 0,
        alertsLow: m?.alertsLow ?? 0,
        inputTokens: run.totals.inputTokens,
        outputTokens: run.totals.outputTokens,
        costUsd: run.totals.costUsd,
        durationMs: m?.durationMs ?? 0,
      });
      console.log(`${document.corpusKey} × ${preset.slug}: ${run.status}`);
    }
  }),
);

const cross: Record<string, CrossSimilarityDto> = {};
for (const preset of presets) {
  const runIds = rows.filter((r) => r.preset === preset.slug && r.status === 'completed').map((r) => r.runId);
  if (runIds.length >= 2) cross[preset.slug] = await client.crossSimilarity(runIds);
}
const dir = join(fromRoot('reports'), new Date().toISOString().replace(/:/g, '-'));
await writeReport(dir, { rows, summary: aggregate(rows, manifest), cross });
console.log(`Relatório em ${dir}`);
