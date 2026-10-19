import {
  AlertType,
  Confidence,
  DocumentType,
  FactCategory,
  FactStatus,
  RunStatus,
  Severity,
  StageName,
  StageRunStatus,
  UncertaintyReason,
  Verdict,
} from '@app/shared';
import {
  ALERT_TYPE_LABELS,
  CATEGORY_LABELS,
  CONFIDENCE_LABELS,
  DOCUMENT_TYPE_LABELS,
  FACT_STATUS_LABELS,
  RUN_STATUS_LABELS,
  SEVERITY_LABELS,
  STAGE_LABELS,
  STAGE_RUN_STATUS_LABELS,
  UNCERTAINTY_REASON_LABELS,
  VERDICT_LABELS,
} from './labels';

test('labels cover every enum value', () => {
  expect(Object.keys(STAGE_LABELS).sort()).toEqual([...StageName.options].sort());
  expect(Object.keys(CATEGORY_LABELS).sort()).toEqual([...FactCategory.options].sort());
  expect(Object.keys(VERDICT_LABELS).sort()).toEqual([...Verdict.options].sort());
  expect(Object.keys(RUN_STATUS_LABELS).sort()).toEqual([...RunStatus.options].sort());
  expect(Object.keys(STAGE_RUN_STATUS_LABELS).sort()).toEqual([...StageRunStatus.options].sort());
  expect(Object.keys(DOCUMENT_TYPE_LABELS).sort()).toEqual([...DocumentType.options].sort());
  expect(Object.keys(CONFIDENCE_LABELS).sort()).toEqual([...Confidence.options].sort());
  expect(Object.keys(FACT_STATUS_LABELS).sort()).toEqual([...FactStatus.options].sort());
  expect(Object.keys(UNCERTAINTY_REASON_LABELS).sort()).toEqual([...UncertaintyReason.options].sort());
  expect(Object.keys(ALERT_TYPE_LABELS).sort()).toEqual([...AlertType.options].sort());
  expect(Object.keys(SEVERITY_LABELS).sort()).toEqual([...Severity.options].sort());
});

test('stage labels in pt-BR', () =>
  expect(Object.values(STAGE_LABELS)).toEqual([
    'Extração e limpeza',
    'Extração de informações',
    'Resumo',
    'Similaridade',
    'Verificação',
    'Relatório',
  ]));
