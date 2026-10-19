import { createFileRoute } from '@tanstack/react-router';
import { ComparePage } from '@/features/compare/compare-page';

export const Route = createFileRoute('/compare')({
  validateSearch: (search: Record<string, unknown>): { runs?: string; from?: string } => ({
    runs: typeof search.runs === 'string' ? search.runs : undefined,
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: function CompareRoute() {
    const { runs, from } = Route.useSearch();
    return <ComparePage runs={runs} from={from} />;
  },
});
