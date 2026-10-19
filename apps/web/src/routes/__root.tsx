import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { Mascot } from '@/components/mascot';
import { TopBar } from '@/components/top-bar';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <div className="flex min-h-svh flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-4 pb-16 md:px-6">
        <Outlet />
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground">
        Projeto acadêmico. Não substitui o documento original nem orientação jurídica.
      </footer>
    </div>
  ),
  notFoundComponent: () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <Mascot />
        </EmptyMedia>
        <EmptyTitle>Página não encontrada</EmptyTitle>
        <EmptyDescription>Esse endereço não existe.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </EmptyContent>
    </Empty>
  ),
});
