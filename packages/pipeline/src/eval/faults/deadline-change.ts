import type { InjectedFault, Summary } from '@app/shared';
import { findDurations } from '../../stages/information-extraction/parsers/durations';
import { rewriteFirst } from './text-slots';

const UNIT = /(dias?|m[eê]s|meses|anos?)\b.*$/iu;
const PLURAL: Record<string, string> = { dia: 'dias', mês: 'meses', mes: 'meses', ano: 'anos' };

/** On the first deadline: drops "úteis" when it counts business days, otherwise doubles the amount. */
export function deadlineChange(summary: Summary): { summary: Summary; fault: InjectedFault } | null {
  const result = rewriteFirst(summary, findDurations, (match, raw) => {
    if (match.businessDays === true) return raw.replace(/\s+[úu]teis/iu, '');
    const unit = UNIT.exec(raw)?.[0];
    if (!unit) return null;
    const doubled = unit.replace(/^\p{L}+/u, (w) => PLURAL[w.toLowerCase()] ?? w);
    return `${match.amount * 2} ${doubled}`;
  });
  if (!result) return null;
  return {
    summary: result.summary,
    fault: {
      type: 'deadline_change',
      description: `Prazo trocado de "${result.before}" para "${result.after}".`,
      expected: { alertType: 'divergence', category: 'deadline' },
    },
  };
}
