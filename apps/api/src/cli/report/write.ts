import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CrossSimilarityDto } from '@app/shared';
import { toCsv } from '../../modules/runs/export/csv';
import { crossMatrixStats, type EvalRow, type EvalSummary, MEAN_FIELDS } from './aggregate';

const fmt = (n: number | null, digits = 3) => (n === null ? '—' : n.toFixed(digits).replace('.', ','));

const MEAN_LABELS: Record<(typeof MEAN_FIELDS)[number], string> = {
  readabilitySource: 'Legibilidade do original',
  readabilitySummary: 'Legibilidade do resumo',
  compressionRatio: 'Compressão',
  centroid: 'Centroide',
  coverage: 'Cobertura',
  support: 'Respaldo',
  alignmentF1: 'Alinhamento (F1)',
  factualConsistency: 'Consistência factual',
  claimSupport: 'Respaldo das afirmações',
  unverifiableCount: 'Não verificáveis',
  alertsHigh: 'Alertas altos',
  alertsMedium: 'Alertas médios',
  alertsLow: 'Alertas baixos',
  costUsd: 'Custo (US$)',
  durationMs: 'Duração (ms)',
};

/** Writes results.json, results.csv and summary.md (pt-BR tables). */
export async function writeReport(
  dir: string,
  data: { rows: EvalRow[]; summary: EvalSummary; cross: Record<string, CrossSimilarityDto> },
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'results.json'), JSON.stringify(data, null, 2));
  const columns = Object.keys(data.rows[0] ?? {}).filter((c) => c !== 'factsByCategory');
  await writeFile(
    join(dir, 'results.csv'),
    toCsv(
      data.rows.map((r) => ({
        ...Object.fromEntries(columns.map((c) => [c, r[c as keyof EvalRow] as never])),
        factsByCategory: JSON.stringify(r.factsByCategory),
      })),
      [...columns, 'factsByCategory'],
    ),
  );

  const lines = ['# Avaliação do corpus', '', `Gerado em ${new Date().toISOString()}.`, ''];
  for (const p of data.summary.byPreset) {
    lines.push(`## Preset \`${p.preset}\``, '');
    lines.push(`- Execuções: ${p.runs} (${p.completed} concluídas)`);
    lines.push(
      `- Acurácia da classificação: ${p.classificationAccuracy === null ? '—' : `${(p.classificationAccuracy * 100).toFixed(1)}%`}`,
    );
    lines.push(`- Correlação alinhamento × consistência factual (Pearson): ${fmt(p.correlation)}`);
    lines.push(`- Custo total estimado: US$ ${p.totalCostUsd.toFixed(4)}`, '');
    lines.push('| Métrica | Média |', '|---|---|');
    for (const f of MEAN_FIELDS) lines.push(`| ${MEAN_LABELS[f]} | ${fmt(p.means[f])} |`);
    lines.push('');
    const cross = data.cross[p.preset];
    if (cross) {
      const stats = crossMatrixStats(cross.matrix);
      lines.push('### Matriz cruzada (alinhamento F1, resumo × documento)', '');
      lines.push(`- Média da diagonal: ${fmt(stats.diagonalMean)}; fora da diagonal: ${fmt(stats.offDiagonalMean)}`);
      lines.push(
        `- Linhas em que o próprio documento é o mais similar: ${(stats.diagonalIsRowMaxRate * 100).toFixed(1)}%`,
        '',
      );
    }
    lines.push(
      '| Documento | Tipo detectado | Status | Alinhamento | Consistência | Respaldo | Alertas (A/M/B) | Custo |',
      '|---|---|---|---|---|---|---|---|',
    );
    for (const r of data.rows.filter((row) => row.preset === p.preset))
      lines.push(
        `| ${r.key} | ${r.detectedType ?? '—'} | ${r.status} | ${fmt(r.alignmentF1)} | ${fmt(r.factualConsistency)} | ${fmt(r.claimSupport)} | ${r.alertsHigh}/${r.alertsMedium}/${r.alertsLow} | ${r.costUsd.toFixed(4)} |`,
      );
    lines.push('');
  }
  await writeFile(join(dir, 'summary.md'), `${lines.join('\n')}\n`);
}
