import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Mascot } from '@/components/mascot';
import { EASE_OUT } from '@/components/motion';
import { TopBar } from '@/components/top-bar';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/** Each page rises in softly when the path changes. */
function AnimatedOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className="flex flex-1 flex-col"
    >
      <Outlet />
    </motion.div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <div className="flex min-h-svh flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-4 pb-16 md:px-6">
        <AnimatedOutlet />
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
