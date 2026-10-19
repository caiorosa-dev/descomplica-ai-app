import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function MetricCard({
  label,
  value,
  hint,
  info,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  info?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1">
          {label}
          {info && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={`Sobre ${label}`} className="text-muted-foreground">
                  <InfoIcon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{info}</TooltipContent>
            </Tooltip>
          )}
        </CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="text-sm text-muted-foreground">{hint}</CardContent>}
    </Card>
  );
}
