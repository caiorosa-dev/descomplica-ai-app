import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';

const LINKS = [
  { to: '/presets', label: 'Presets' },
  { to: '/compare', label: 'Comparar' },
] as const;

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 md:px-6">
        <Link to="/" aria-label="DescomplicaAI, início" className="rounded-full outline-none focus-visible:ring-2">
          <Logo />
        </Link>
        <nav className="ml-auto flex items-center gap-1" aria-label="Principal">
          {LINKS.map((link) => (
            <Button key={link.to} asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link to={link.to} activeProps={{ className: 'bg-secondary text-secondary-foreground' }}>
                {link.label}
              </Link>
            </Button>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
