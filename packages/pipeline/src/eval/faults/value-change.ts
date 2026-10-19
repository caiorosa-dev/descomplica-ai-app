import type { InjectedFault, Summary } from '@app/shared';
import { findMoney } from '../../stages/information-extraction/parsers/money';
import { rewriteFirst } from './text-slots';

const brl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Multiplies the first amount in reais by ten, written as "R$ 1.234,56". */
export function valueChange(summary: Summary): { summary: Summary; fault: InjectedFault } | null {
  const result = rewriteFirst(summary, findMoney, (match) => `R$ ${brl.format(match.amount * 10)}`);
  if (!result) return null;
  return {
    summary: result.summary,
    fault: {
      type: 'value_change',
      description: `Valor trocado de "${result.before}" para "${result.after}".`,
      expected: { alertType: 'divergence', category: 'monetary_value' },
    },
  };
}
