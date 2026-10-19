import { UploadIcon } from 'lucide-react';
import { type DragEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useUploadDocument } from './queries';

const ACCEPT = '.pdf,.docx,.html,.htm,.txt';

/** Drag-and-drop (or click) upload with progress; duplicates reuse the existing record. */
export function UploadDropzone() {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const upload = useUploadDocument();

  const send = async (file: File) => {
    setProgress(0);
    try {
      const result = await upload.mutateAsync({ file, onProgress: setProgress });
      if (result.deduplicated) toast.info('Este documento já existia; usando o registro existente');
      else toast.success('Documento enviado');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void send(file);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Enviar documento"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
          dragging ? 'border-primary bg-muted' : 'hover:bg-muted/50',
        )}
      >
        <UploadIcon className="text-muted-foreground" />
        <span className="font-medium">Arraste um documento ou clique para escolher</span>
        <span className="text-sm text-muted-foreground">PDF, DOCX, HTML ou TXT, até 20 MB</span>
        {progress !== null && (
          <Progress value={progress * 100} className="mt-2 w-full max-w-xs" aria-label="Progresso do envio" />
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void send(file);
        }}
      />
    </>
  );
}
