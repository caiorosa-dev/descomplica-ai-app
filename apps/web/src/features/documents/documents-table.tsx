import type { DocumentDto } from '@app/shared';
import { Link } from '@tanstack/react-router';
import { PlayIcon } from 'lucide-react';
import { RunStatusBadge, ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DOCUMENT_TYPE_LABELS } from '@/lib/labels';

export function DocumentsTable({
  documents,
  onProcess,
}: {
  documents: DocumentDto[];
  onProcess: (doc: DocumentDto) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Páginas</TableHead>
          <TableHead className="text-right">Execuções</TableHead>
          <TableHead>Última execução</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="max-w-72 truncate font-medium" title={doc.filename}>
              {doc.filename}
            </TableCell>
            <TableCell>
              <ToneBadge tone="neutral">{doc.source === 'corpus' ? 'Corpus' : 'Upload'}</ToneBadge>
            </TableCell>
            <TableCell>{doc.detectedType ? DOCUMENT_TYPE_LABELS[doc.detectedType] : '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{doc.pages ?? '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{doc.runCount}</TableCell>
            <TableCell>{doc.lastRunStatus ? <RunStatusBadge status={doc.lastRunStatus} /> : '—'}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                {doc.lastRunId && (
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/runs/$runId" params={{ runId: doc.lastRunId }}>
                      Ver última execução
                    </Link>
                  </Button>
                )}
                <Button size="sm" onClick={() => onProcess(doc)}>
                  <PlayIcon data-icon="inline-start" />
                  Processar
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
