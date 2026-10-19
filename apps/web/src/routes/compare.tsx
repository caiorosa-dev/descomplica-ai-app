import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/compare')({
  component: () => <h1 className="font-heading text-2xl font-semibold">Comparar execuções</h1>,
});
