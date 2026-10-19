import type { ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { ActivePill } from './motion';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode }[];
  /** Shared by the sliding pill; unique per control on the page. */
  layoutId: string;
  'aria-label': string;
  /** `track`: pills on a muted track. `chips`: separate chips, the chosen one filled with the brand color. */
  variant?: 'track' | 'chips';
  className?: string;
}

/** Single-choice control whose selection slides from item to item. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  layoutId,
  variant = 'track',
  className,
  ...props
}: SegmentedProps<T>) {
  const chips = variant === 'chips';
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={props['aria-label']}
      className={cn(chips ? 'flex-wrap justify-start gap-1' : 'rounded-full bg-muted p-0.5', className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            'relative isolate rounded-full px-3 transition-colors aria-pressed:bg-transparent data-[state=on]:bg-transparent hover:bg-transparent',
            chips
              ? 'text-muted-foreground hover:text-foreground data-[state=on]:text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground data-[state=on]:text-foreground',
          )}
        >
          {value === o.value && (
            <ActivePill layoutId={layoutId} className={chips ? 'bg-primary shadow-none' : undefined} />
          )}
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
