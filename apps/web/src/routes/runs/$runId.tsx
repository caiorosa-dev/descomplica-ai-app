import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/runs/$runId')({
  component: function RunPlaceholder() {
    const { runId } = Route.useParams();
    return <h1 className="font-heading text-2xl font-semibold">Execução {runId}</h1>;
  },
});
