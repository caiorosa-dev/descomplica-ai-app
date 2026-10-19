import type { RunMetricsShape } from '@app/shared';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const config = {
  a: { label: 'Execução A', color: 'var(--chart-2)' },
  b: { label: 'Execução B', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const METRICS: { key: keyof RunMetricsShape; label: string }[] = [
  { key: 'alignmentF1', label: 'Alinhamento (F1)' },
  { key: 'factualConsistency', label: 'Consistência factual' },
  { key: 'claimSupport', label: 'Respaldo das afirmações' },
];

/** Side-by-side bars of the 0–1 quality metrics of two runs. */
export function MetricsChart({ a, b }: { a: RunMetricsShape | null; b: RunMetricsShape | null }) {
  const data = METRICS.map((m) => ({
    metric: m.label,
    a: (a?.[m.key] as number | null) ?? 0,
    b: (b?.[m.key] as number | null) ?? 0,
  }));
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="metric" tickLine={false} axisLine={false} />
        <YAxis domain={[0, 1]} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="a" fill="var(--color-a)" radius={4} />
        <Bar dataKey="b" fill="var(--color-b)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
