import type { DocumentDto } from '@app/shared';
import { FileTextIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { DocumentsTable } from './documents-table';
import { ProcessDialog } from './process-dialog';
import { useCreateRun, useDocuments, usePresets, useProviders } from './queries';
import { UploadDropzone } from './upload-dropzone';

export function DocumentsPage() {
  const documents = useDocuments();
  const presets = usePresets();
  const providers = useProviders();
  const createRun = useCreateRun();
  const [processing, setProcessing] = useState<DocumentDto | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Documentos</h1>
        <p className="text-muted-foreground">Envie decisões judiciais ou atos normativos e acompanhe as execuções.</p>
      </div>
      <UploadDropzone />
      <Card>
        <CardHeader>
          <CardTitle>Documentos cadastrados</CardTitle>
          <CardDescription>Envios e documentos do corpus de avaliação.</CardDescription>
        </CardHeader>
        <CardContent>
          {documents.isPending ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : documents.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Não foi possível carregar os documentos</AlertTitle>
              <AlertDescription>{documents.error.message}</AlertDescription>
            </Alert>
          ) : documents.data.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum documento ainda</EmptyTitle>
                <EmptyDescription>Envie um documento ou rode o seed para carregar o corpus.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <DocumentsTable documents={documents.data} onProcess={setProcessing} />
          )}
        </CardContent>
      </Card>
      {processing && presets.data && providers.data && (
        <ProcessDialog
          document={processing}
          presets={presets.data}
          providers={providers.data}
          open
          onOpenChange={(open) => !open && setProcessing(null)}
          pending={createRun.isPending}
          onConfirm={(presetId) =>
            createRun.mutate(
              { documentId: processing.id, presetId },
              { onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível criar a execução.') },
            )
          }
        />
      )}
    </div>
  );
}
