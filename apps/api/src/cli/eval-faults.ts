import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { applyFault, FAULT_TYPES } from '@app/pipeline';
import type { Alert, FaultType, InjectedFault, RunResultDto } from '@app/shared';
import { toCsv } from '../modules/runs/export/csv';
import { createApiClient, waitForRun } from './http-client';

const root = process.env.INIT_CWD ?? process.cwd();
const fromRoot = (p: string) => (isAbsolute(p) ? p : resolve(root, p));

const { values } = parseArgs({
  options: {
    'from-label': { type: 'string', default: 'eval-corpus' },
    preset: { type: 'string' },
    api: { type: 'string', default: 'http://localhost:3333' },
    concurrency: { type: 'string', default: '2' },
    yes: { type: 'boolean', default: false },
  },
});

interface FaultRow {
  sourceRunId: string;
  documentId: string;
  fault: FaultType;
  applied: boolean;
  faultRunId: string | null;
  status: string | null;
  detected: boolean | null;
  spuriousAlerts: number;
  description: string;
}

/** Identifies an alert across runs: type, category and the fact or claim text it is about. */
function alertKey(alert: Alert, result: RunResultDto): string {
  const claim = alert.claimId ? result.claims.find((c) => c.id === alert.claimId)?.text : undefined;
  return [alert.type, alert.category ?? '', alert.sourceFactId ?? claim ?? ''].join('|');
}

function matchesExpected(alert: Alert, fault: InjectedFault): boolean {
  if (alert.type !== fault.expected.alertType) return false;
  // A fabricated sentence may come back as an untyped claim, so a null category also counts.
  if (fault.type === 'fabrication') return alert.category === fault.expected.category || alert.category === null;
  return alert.category === fault.expected.category;
}

const client = createApiClient(values.api);
const presets = await client.listPresets();
const presetId = values.preset ? presets.find((p) => p.slug === values.preset)?.id : undefined;
if (values.preset && !presetId) throw new Error(`Preset não encontrado: ${values.preset}`);

const sources = (await client.listRuns({ label: values['from-label'] })).filter(
  (r) => r.status === 'completed' && (!presetId || r.presetId === presetId),
);
const results = new Map<string, RunResultDto>();
for (const run of sources) results.set(run.id, await client.getResult(run.id));

const jobs = sources.flatMap((run) => {
  const result = results.get(run.id);
  const summary = result?.summary?.summary;
  if (!result || !summary) return [];
  return FAULT_TYPES.map((type) => ({ run, result, type, mutation: applyFault(type, summary, result.facts) }));
});
const applicable = jobs.filter((j) => j.mutation !== null);
console.log(
  `${sources.length} execuções de origem, ${applicable.length} falhas aplicáveis de ${jobs.length}. ` +
    'Cada falha cria um reprocessamento a partir da similaridade, com custo de API real.',
);
if (!values.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Continuar? (s/N) ');
  rl.close();
  if (answer.trim().toLowerCase() !== 's') process.exit(0);
}

const rows: FaultRow[] = jobs
  .filter((j) => j.mutation === null)
  .map((j) => ({
    sourceRunId: j.run.id,
    documentId: j.run.documentId,
    fault: j.type,
    applied: false,
    faultRunId: null,
    status: null,
    detected: null,
    spuriousAlerts: 0,
    description: 'Não se aplica a este resumo.',
  }));

let next = 0;
await Promise.all(
  Array.from({ length: Math.max(1, Number(values.concurrency)) }, async () => {
    while (next < applicable.length) {
      const { run, result, type, mutation } = applicable[next++] as (typeof applicable)[number];
      if (!mutation) continue;
      const created = await client.rerun(run.id, {
        fromStage: 'similarity',
        summaryOverride: mutation.summary,
        label: 'eval-faults',
        injectedFaults: [mutation.fault],
      });
      const done = await waitForRun(client, created.id);
      let detected: boolean | null = null;
      let spurious = 0;
      if (done.status === 'completed') {
        const faulty = await client.getResult(done.id);
        const before = new Set(result.alerts.map((a) => alertKey(a, result)));
        const fresh = faulty.alerts.filter((a) => !before.has(alertKey(a, faulty)));
        detected = fresh.some((a) => matchesExpected(a, mutation.fault));
        spurious = fresh.filter((a) => !matchesExpected(a, mutation.fault)).length;
      }
      rows.push({
        sourceRunId: run.id,
        documentId: run.documentId,
        fault: type,
        applied: true,
        faultRunId: done.id,
        status: done.status,
        detected,
        spuriousAlerts: spurious,
        description: mutation.fault.description,
      });
      console.log(
        `${run.id.slice(0, 8)} × ${type}: ${done.status}${detected === null ? '' : detected ? ', detectada' : ', não detectada'}`,
      );
    }
  }),
);

const byType = FAULT_TYPES.map((type) => {
  const applied = rows.filter((r) => r.fault === type && r.applied && r.status === 'completed');
  const detected = applied.filter((r) => r.detected).length;
  return {
    type,
    applied: applied.length,
    detected,
    rate: applied.length ? detected / applied.length : null,
    spuriousMean: applied.length ? applied.reduce((s, r) => s + r.spuriousAlerts, 0) / applied.length : null,
  };
});

const LABELS: Record<FaultType, string> = {
  date_shift: 'Data trocada',
  value_change: 'Valor trocado',
  deadline_change: 'Prazo trocado',
  outcome_flip: 'Resultado invertido',
  omission: 'Omissão',
  fabrication: 'Frase inventada',
};
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1).replace('.', ',')}%`);
const num = (n: number | null) => (n === null ? '—' : n.toFixed(2).replace('.', ','));
const allApplied = byType.reduce((s, t) => s + t.applied, 0);
const allDetected = byType.reduce((s, t) => s + t.detected, 0);

const dir = join(fromRoot('reports'), `${new Date().toISOString().replace(/:/g, '-')}-faults`);
await mkdir(dir, { recursive: true });
await writeFile(join(dir, 'results.json'), JSON.stringify({ rows, byType }, null, 2));
const columns = [
  'sourceRunId',
  'documentId',
  'fault',
  'applied',
  'faultRunId',
  'status',
  'detected',
  'spuriousAlerts',
  'description',
];
await writeFile(join(dir, 'results.csv'), toCsv(rows as never, columns));
await writeFile(
  join(dir, 'summary.md'),
  [
    '# Injeção de falhas',
    '',
    `Execuções de origem: ${sources.length} (label \`${values['from-label']}\`${values.preset ? `, preset \`${values.preset}\`` : ''}).`,
    `Detecção geral: ${allDetected} de ${allApplied} (${pct(allApplied ? allDetected / allApplied : null)}).`,
    '',
    '| Falha | Aplicadas | Detectadas | Taxa | Alertas espúrios por execução |',
    '| --- | --: | --: | --: | --: |',
    ...byType.map(
      (t) => `| ${LABELS[t.type]} | ${t.applied} | ${t.detected} | ${pct(t.rate)} | ${num(t.spuriousMean)} |`,
    ),
    '',
    'Uma falha conta como detectada quando a execução com a falha tem um alerta novo do tipo e da categoria esperados.',
    '',
  ].join('\n'),
);
console.log(`Relatório em ${dir}`);
