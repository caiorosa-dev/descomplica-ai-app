import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Ease used across the app: quick start, soft landing. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const PILL_SPRING = { type: 'spring', bounce: 0.18, duration: 0.45 } as const;

/** Background of the selected item in a segmented control; it slides between items that share a layoutId. */
export function ActivePill({ layoutId, className }: { layoutId: string; className?: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      transition={PILL_SPRING}
      className={cn('absolute inset-0 -z-10 rounded-full bg-card shadow-sm', className)}
      aria-hidden
    />
  );
}

/** Content that rises in when it mounts (tab panels, swapped states). */
export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_OUT, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
