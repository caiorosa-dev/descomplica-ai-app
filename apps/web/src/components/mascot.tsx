import { BotAvatar } from 'bot-avatars';
import { useTheme } from '@/lib/theme';

/** libraries.dev Bot Avatar in brand blue, used for empty and lost states. */
export function Mascot({
  state = 'default',
  size = 72,
}: {
  state?: 'default' | 'working' | 'sleeping';
  size?: number;
}) {
  const { theme } = useTheme();
  return <BotAvatar type="clover" state={state} size={size} color="#3043d6" theme={theme} />;
}
