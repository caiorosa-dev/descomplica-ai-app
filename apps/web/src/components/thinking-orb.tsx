import type { StageName } from '@app/shared';
import { ThinkingOrb as Orb, type OrbState } from 'thinking-orbs';
import { useTheme } from '@/lib/theme';

const STATE: Record<StageName, OrbState> = {
  text_extraction: 'searching',
  information_extraction: 'connecting',
  summarization: 'composing',
  similarity: 'weaving',
  verification: 'solving',
  report: 'shaping',
};

/** libraries.dev Thinking Orb; each pipeline stage gets its own animation. */
export function ThinkingOrb({ stage }: { stage: StageName | null }) {
  const { theme } = useTheme();
  return (
    <Orb
      state={stage ? STATE[stage] : 'breathing'}
      size={64}
      theme={theme}
      color={theme === 'dark' ? '#8b9bff' : '#3043d6'}
      aria-hidden
    />
  );
}
