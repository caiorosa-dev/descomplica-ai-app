import type { DocumentDto, DocumentType } from '@app/shared';
import { Link } from '@tanstack/react-router';
import {
  ChevronRightIcon,
  FileTextIcon,
  LandmarkIcon,
  type LucideIcon,
  RotateCcwIcon,
  ScaleIcon,
  Trash2Icon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { EASE_OUT } from '@/components/motion';
import { DocumentTypeBadge, RunStatusBadge, ToneBadge } from '@/components/tone-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api-client';
import { formatWhen } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDeleteDocument } from './queries';

const TYPE_ICON: Record<DocumentType | 'unknown', { icon: LucideIcon; className: string }> = {
  court_decision: { icon: ScaleIcon, className: 'bg-info-soft text-info' },
  normative_act: { icon: LandmarkIcon, className: 'bg-violet-soft text-violet' },
  generic: { icon: FileTextIcon, className: 'bg-neutral-soft text-neutral-tone' },
  unknown: { icon: FileTextIcon, className: 'bg-neutral-soft text-neutral-tone' },
};

function DeleteButton({ doc }: { doc: DocumentDto }) {
  const remove = useDeleteDocument();
  const busy = doc.lastRunStatus === 'queued' || doc.lastRunStatus === 'running';
  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Excluir arquivo"
              disabled={busy || remove.isPending}
              className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
            >
              <Trash2Icon />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{busy ? 'Espere terminar para excluir' : 'Excluir'}</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este arquivo?</AlertDialogTitle>
          <AlertDialogDescription>
            {doc.filename} e os resultados dele saem do app. Não dá para desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              remove.mutate(doc.id, {
                onSuccess: () => toast.success('Arquivo excluído'),
                onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível excluir.'),
              })
            }
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DocumentRow({
  doc,
  index,
  onProcess,
}: {
  doc: DocumentDto;
  index: number;
  onProcess: (doc: DocumentDto) => void;
}) {
  const { icon: Icon, className } = TYPE_ICON[doc.detectedType ?? 'unknown'];
  const body = (
    <>
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', className)}>
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate font-medium" title={doc.filename}>
          {doc.filename}
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {doc.lastRunStatus && <RunStatusBadge status={doc.lastRunStatus} />}
          {doc.detectedType && <DocumentTypeBadge type={doc.detectedType} />}
          {doc.source === 'corpus' && <ToneBadge tone="teal">Corpus</ToneBadge>}
          {doc.pages !== null && <span>{doc.pages === 1 ? '1 página' : `${doc.pages} páginas`}</span>}
          <span>{formatWhen(doc.createdAt)}</span>
        </span>
      </span>
    </>
  );
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: EASE_OUT, delay: Math.min(index, 12) * 0.03 }}
      className="group flex items-center gap-1 rounded-2xl pr-2 transition-colors hover:bg-card"
    >
      {doc.lastRunId ? (
        <Link
          to="/runs/$runId"
          params={{ runId: doc.lastRunId }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
          <ChevronRightIcon
            aria-hidden
            className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
          />
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 p-3">{body}</div>
      )}
      {doc.lastRunId ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Simplificar de novo" onClick={() => onProcess(doc)}>
              <RotateCcwIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Simplificar de novo</TooltipContent>
        </Tooltip>
      ) : (
        <Button variant="secondary" size="sm" className="rounded-full" onClick={() => onProcess(doc)}>
          Simplificar
        </Button>
      )}
      {doc.source === 'upload' && <DeleteButton doc={doc} />}
    </motion.li>
  );
}

export function DocumentList({
  documents,
  onProcess,
}: {
  documents: DocumentDto[];
  onProcess: (doc: DocumentDto) => void;
}) {
  return (
    <ul className="-mx-3 flex flex-col">
      <AnimatePresence initial={false}>
        {documents.map((doc, i) => (
          <DocumentRow key={doc.id} doc={doc} index={i} onProcess={onProcess} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
