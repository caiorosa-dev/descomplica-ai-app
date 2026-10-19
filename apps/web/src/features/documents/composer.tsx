import type { DocumentDto, PresetDto, ProvidersDto, UploadDocumentResponse } from '@app/shared';
import { ArrowUpIcon, FileTextIcon, FileUpIcon, KeyRoundIcon, PaperclipIcon, XIcon } from 'lucide-react';
import { type DragEvent, useMemo, useRef, useState } from 'react';
import { Beam } from '@/components/beam';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api-client';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { presetAvailability } from './process-dialog';

const ACCEPT = '.pdf,.docx,.html,.htm,.txt';

export interface ComposerProps {
  presets: PresetDto[];
  providers: ProvidersDto;
  onUpload: (file: File, onProgress: (fraction: number) => void) => Promise<UploadDocumentResponse>;
  onSubmit: (documentId: string, presetId: string) => void;
  submitting?: boolean;
}

type Upload =
  | { state: 'idle' }
  | { state: 'uploading'; file: File; progress: number }
  | { state: 'ready'; document: DocumentDto; deduplicated: boolean }
  | { state: 'error'; message: string };

/** The home's main input: drop a file, pick a preset, simplify. The upload starts as soon as a file is chosen. */
export function Composer({ presets, providers, onUpload, onSubmit, submitting }: ComposerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<Upload>({ state: 'idle' });
  const [dragging, setDragging] = useState(false);
  const options = useMemo(
    () => presets.map((p) => ({ preset: p, ...presetAvailability(p, providers) })),
    [presets, providers],
  );
  const [chosenPreset, setChosenPreset] = useState<string | undefined>();
  const presetId = chosenPreset ?? options.find((o) => o.available)?.preset.id;

  const send = async (file: File) => {
    setUpload({ state: 'uploading', file, progress: 0 });
    try {
      const result = await onUpload(file, (progress) => setUpload({ state: 'uploading', file, progress }));
      setUpload({ state: 'ready', document: result.document, deduplicated: result.deduplicated });
    } catch (e) {
      setUpload({ state: 'error', message: e instanceof ApiError ? e.message : 'Não foi possível enviar o arquivo.' });
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void send(file);
  };

  const busy = upload.state === 'uploading' || Boolean(submitting);
  const ready = upload.state === 'ready' ? upload.document : null;

  return (
    <Beam active={busy || dragging}>
      <section
        aria-label="Novo documento"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col rounded-[1.75rem] border bg-card shadow-[var(--shadow-float)] transition-colors',
          dragging && 'border-primary bg-secondary/40',
        )}
      >
        <div className="min-h-36 p-3">
          {upload.state === 'uploading' || ready ? (
            <div className="flex items-center gap-3 rounded-2xl bg-muted/70 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <FileTextIcon aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium">
                  {upload.state === 'uploading' ? upload.file.name : ready?.filename}
                </span>
                {upload.state === 'uploading' ? (
                  <Progress value={upload.progress * 100} aria-label="Progresso do envio" className="h-1.5" />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {ready && formatBytes(ready.sizeBytes)}
                    {upload.state === 'ready' && upload.deduplicated && ', já enviado antes'}
                  </span>
                )}
              </div>
              {ready && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remover arquivo"
                  onClick={() => setUpload({ state: 'idle' })}
                  disabled={submitting}
                >
                  <XIcon />
                </Button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="group/drop flex h-full min-h-30 w-full items-center gap-4 rounded-2xl px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground transition-transform group-hover/drop:-translate-y-0.5">
                <FileUpIcon aria-hidden className="size-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-heading text-xl font-medium">
                  {dragging ? 'Pode soltar' : 'Solte o arquivo aqui'}
                </span>
                <span className="text-sm text-muted-foreground">
                  ou clique para escolher. PDF, DOCX, HTML ou TXT até 20 MB.
                </span>
              </span>
            </button>
          )}
          {!options.some((o) => o.available) && (
            <p className="flex items-center gap-2 px-3 pt-2 text-sm text-warning">
              <KeyRoundIcon aria-hidden className="size-4" />
              Coloque a OPENAI_API_KEY no .env para poder simplificar.
            </p>
          )}
          {upload.state === 'error' && (
            <p role="alert" className="px-3 pt-2 text-sm text-destructive">
              {upload.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-dashed px-3 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-muted-foreground"
            aria-label="Anexar outro arquivo"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            <PaperclipIcon />
          </Button>
          <Select value={presetId} onValueChange={setChosenPreset}>
            <SelectTrigger
              aria-label="Preset"
              size="sm"
              className="max-w-56 rounded-full border-transparent bg-muted/70"
            >
              <SelectValue placeholder="Escolha um preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map(({ preset, available, missing }) => (
                  <SelectItem key={preset.id} value={preset.id} disabled={!available}>
                    <span className="flex flex-col items-start">
                      <span>{preset.name}</span>
                      {!available && (
                        <span className="text-xs text-muted-foreground">
                          Falta a chave {missing.map((p) => `${p.toUpperCase()}_API_KEY`).join(' e ')}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            className="ml-auto rounded-full px-4"
            disabled={!ready || !presetId || submitting}
            onClick={() => ready && presetId && onSubmit(ready.id, presetId)}
          >
            {submitting ? <Spinner data-icon="inline-start" /> : <ArrowUpIcon data-icon="inline-start" />}
            Simplificar
          </Button>
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          aria-label="Escolher arquivo"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void send(file);
          }}
        />
      </section>
    </Beam>
  );
}
