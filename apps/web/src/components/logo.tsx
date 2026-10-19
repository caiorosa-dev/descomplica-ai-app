import { useId } from 'react';
import { cn } from '@/lib/utils';

/** A document with a check badge: the simplified, verified page from the deck's cover. */
export function LogoMark({ className }: { className?: string }) {
  const cutout = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <mask id={cutout}>
        <rect width="32" height="32" fill="#fff" />
        <circle cx="23" cy="23" r="9" fill="#000" />
      </mask>
      <g mask={`url(#${cutout})`}>
        <path d="M7 2h9l6 6v17a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z" className="fill-brand-blue" />
        <path d="M16 2v4a2 2 0 0 0 2 2h4Z" className="fill-brand-periwinkle" />
        <g fill="#fff">
          <rect x="8" y="11" width="9" height="2" rx="1" />
          <rect x="8" y="15" width="9" height="2" rx="1" fillOpacity={0.75} />
          <rect x="8" y="19" width="5" height="2" rx="1" fillOpacity={0.55} />
        </g>
      </g>
      <circle cx="23" cy="23" r="7" className="fill-brand-periwinkle" />
      <path
        d="m19.8 23.1 2.3 2.3 4.2-4.6"
        fill="none"
        className="stroke-brand-navy"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark />
      <span className="font-heading text-lg font-bold tracking-[-0.03em]">DescomplicaAI</span>
    </span>
  );
}
