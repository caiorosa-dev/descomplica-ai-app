import type { RunDto } from '@app/shared';
import { DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ExportMenu({ run }: { run: RunDto }) {
  const disabled = run.status !== 'completed';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={disabled}>
          <DownloadIcon data-icon="inline-start" />
          Baixar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <a href={`/api/runs/${run.id}/export?format=json`} download>
              JSON
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/api/runs/${run.id}/export?format=csv`} download>
              CSV (ZIP)
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
