import { Link, useRouterState } from '@tanstack/react-router';
import { Logo } from './logo';
import { ActivePill } from './motion';
import { ThemeToggle } from './theme-toggle';

const LINKS = [
  { to: '/presets', label: 'Presets' },
  { to: '/compare', label: 'Comparar' },
] as const;

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 md:px-6">
        <Link
          to="/"
          aria-label="DescomplicaAI, início"
          className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2"
        >
          <Logo />
        </Link>
        <nav className="ml-auto flex items-center gap-1" aria-label="Principal">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className="relative isolate rounded-full px-3 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 data-[active=true]:text-secondary-foreground"
                data-active={active}
              >
                {active && <ActivePill layoutId="nav-pill" className="bg-secondary shadow-none" />}
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
