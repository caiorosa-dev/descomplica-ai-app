import type { DocumentDto } from '@app/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Mascot } from '@/components/mascot';
import { Segmented } from '@/components/segmented';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { Composer } from './composer';
import { DocumentList } from './document-list';
import { ProcessDialog } from './process-dialog';
import { useCreateRun, useDocuments, usePresets, useProviders, useUploadDocument } from './queries';

type Filter = 'upload' | 'corpus';

export function DocumentsPage() {
  const documents = useDocuments();
  const presets = usePresets();
  const providers = useProviders();
  const createRun = useCreateRun();
  const upload = useUploadDocument();
  const [processing, setProcessing] = useState<DocumentDto | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);

  const all = documents.data ?? [];
  const uploads = all.filter((d) => d.source === 'upload');
  const corpus = all.filter((d) => d.source === 'corpus');
  const active: Filter = filter ?? (uploads.length > 0 || corpus.length === 0 ? 'upload' : 'corpus');
  const shown = active === 'upload' ? uploads : corpus;

  const start = (documentId: string, presetId: string) =>
    createRun.mutate(
      { documentId, presetId },
      { onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível começar.') },
    );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 pt-[8vh]">
      <section className="flex flex-col gap-6">
        <h1 className="text-center font-heading text-4xl font-semibold text-balance md:text-5xl">
          Qual documento você quer entender?
        </h1>
        {presets.data && providers.data ? (
          <Composer
            presets={presets.data}
            providers={providers.data}
            onUpload={(file, onProgress) => upload.mutateAsync({ file, onProgress })}
            onSubmit={start}
            submitting={createRun.isPending}
          />
        ) : presets.isError || providers.isError ? (
          <Alert variant="destructive">
            <AlertTitle>A API não respondeu</AlertTitle>
            <AlertDescription>Confira se o servidor está rodando e recarregue a página.</AlertDescription>
          </Alert>
        ) : (
          <Skeleton className="h-52 w-full rounded-[1.75rem]" />
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="docs-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="docs-title" className="text-lg font-semibold">
            Seus documentos
          </h2>
          <Segmented
            value={active}
            onChange={setFilter}
            layoutId="docs-filter"
            aria-label="Filtrar documentos"
            options={[
              {
                value: 'upload',
                label: (
                  <>
                    Enviados <span className="text-muted-foreground tabular-nums">{uploads.length}</span>
                  </>
                ),
              },
              {
                value: 'corpus',
                label: (
                  <>
                    Corpus <span className="text-muted-foreground tabular-nums">{corpus.length}</span>
                  </>
                ),
              },
            ]}
          />
        </div>
        {documents.isPending ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : documents.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Não deu para carregar a lista</AlertTitle>
            <AlertDescription>{documents.error.message}</AlertDescription>
          </Alert>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed p-8 text-center">
            <Mascot state="sleeping" size={64} />
            <p className="text-sm text-muted-foreground">
              {active === 'upload'
                ? 'Os arquivos que você enviar aparecem aqui.'
                : 'Rode o seed para carregar o corpus.'}
            </p>
          </div>
        ) : (
          <DocumentList key={active} documents={shown} onProcess={setProcessing} />
        )}
      </section>

      {processing && presets.data && providers.data && (
        <ProcessDialog
          document={processing}
          presets={presets.data}
          providers={providers.data}
          open
          onOpenChange={(open) => !open && setProcessing(null)}
          pending={createRun.isPending}
          onConfirm={(presetId) => start(processing.id, presetId)}
        />
      )}
    </div>
  );
}
