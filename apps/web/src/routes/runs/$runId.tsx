import { createFileRoute } from '@tanstack/react-router';
import { RunPage } from '@/features/runs/run-page';

export const Route = createFileRoute('/runs/$runId')({
  component: function RunRoute() {
    const { runId } = Route.useParams();
    return <RunPage key={runId} runId={runId} />;
  },
});
