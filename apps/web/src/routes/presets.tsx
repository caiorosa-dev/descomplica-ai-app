import { createFileRoute } from '@tanstack/react-router';
import { PresetsPage } from '@/features/presets/presets-page';

export const Route = createFileRoute('/presets')({ component: PresetsPage });
