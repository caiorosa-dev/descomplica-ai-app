import type { LlmCallSummaryDto, RunExportV1, RunMetricsShape } from '@app/shared';
import { strToU8, zipSync } from 'fflate';
import { toCsv } from './csv';

/** ZIP with facts.csv, claims.csv, alerts.csv, metrics.csv and llm_calls.csv (spec §11). */
export function buildCsvZip(exp: RunExportV1, llmCalls: LlmCallSummaryDto[]): Uint8Array {
  const facts = toCsv(
    exp.facts.map((f) => ({
      fact_key: f.id,
      category: f.category,
      label: f.label,
      value_json: JSON.stringify(f.value),
      confidence: f.confidence,
      status: f.status,
      uncertainty_reasons: f.uncertaintyReasons.join(';'),
      evidence_quotes: f.evidence.map((e) => e.quote).join(' | '),
      pages: [...new Set(f.evidence.map((e) => e.page).filter((p) => p !== null))].join(';'),
    })),
    [
      'fact_key',
      'category',
      'label',
      'value_json',
      'confidence',
      'status',
      'uncertainty_reasons',
      'evidence_quotes',
      'pages',
    ],
  );
  const claims = toCsv(
    exp.claims.map((c) => ({
      claim_key: c.id,
      text: c.text,
      category: c.category,
      value_json: c.value ? JSON.stringify(c.value) : null,
      section_index: c.paragraphRef?.sectionIndex ?? null,
      paragraph_index: c.paragraphRef?.paragraphIndex ?? null,
    })),
    ['claim_key', 'text', 'category', 'value_json', 'section_index', 'paragraph_index'],
  );
  const alerts = toCsv(
    exp.alerts.map((a) => ({
      alert_key: a.id,
      type: a.type,
      severity: a.severity,
      category: a.category,
      title: a.title,
      explanation: a.explanation,
      fact_key: a.sourceFactId,
      claim_key: a.claimId,
    })),
    ['alert_key', 'type', 'severity', 'category', 'title', 'explanation', 'fact_key', 'claim_key'],
  );
  const metrics = toCsv(
    Object.entries(exp.metrics ?? ({} as RunMetricsShape)).map(([metric, value]) => ({ metric, value })),
    ['metric', 'value'],
  );
  const calls = toCsv(
    llmCalls.map((c) => ({
      agent: c.agent,
      agent_version: c.agentVersion,
      model: c.model,
      attempt: c.attempt,
      status: c.status,
      input_tokens: c.inputTokens,
      output_tokens: c.outputTokens,
      cost_usd: c.costUsd,
      latency_ms: c.latencyMs,
      created_at: c.createdAt,
    })),
    [
      'agent',
      'agent_version',
      'model',
      'attempt',
      'status',
      'input_tokens',
      'output_tokens',
      'cost_usd',
      'latency_ms',
      'created_at',
    ],
  );
  return zipSync({
    'facts.csv': strToU8(facts),
    'claims.csv': strToU8(claims),
    'alerts.csv': strToU8(alerts),
    'metrics.csv': strToU8(metrics),
    'llm_calls.csv': strToU8(calls),
  });
}
