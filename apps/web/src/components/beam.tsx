import { BorderBeam } from 'border-beam';
import type { ReactNode } from 'react';
import { useTheme } from '@/lib/theme';

/** libraries.dev Border Beam in the brand's blue-violet range, shown only while something is happening. */
export function Beam({ active, children, className }: { active: boolean; children: ReactNode; className?: string }) {
  const { theme } = useTheme();
  return (
    <BorderBeam colorVariant="ocean" theme={theme} active={active} strength={0.85} className={className}>
      {children}
    </BorderBeam>
  );
}
