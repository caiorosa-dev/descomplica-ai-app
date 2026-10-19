import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatUsd } from '@/lib/format';
import { useLlmCall } from './queries';

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="flex flex-col gap-1">
      <h4 className="text-sm font-medium">{title}</h4>
      <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
        {JSON.stringify(value, null, 2) ?? 'null'}
      </pre>
    </section>
  );
}

/** Full prompt and response of one LLM call. */
export function LlmCallSheet({
  runId,
  callId,
  onClose,
}: {
  runId: string;
  callId: string | null;
  onClose: () => void;
}) {
  const call = useLlmCall(runId, callId);
  return (
    <Sheet open={callId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{call.data ? `${call.data.agent} · ${call.data.model}` : 'Chamada de LLM'}</SheetTitle>
          <SheetDescription>
            {call.data
              ? `Tentativa ${call.data.attempt} · ${formatNumber(call.data.inputTokens)} + ${formatNumber(call.data.outputTokens)} tokens · ${formatUsd(call.data.costUsd)} · ${call.data.latencyMs} ms`
              : 'Carregando…'}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          {call.data ? (
            <div className="flex flex-col gap-4">
              <JsonBlock title="Parâmetros" value={call.data.params} />
              <JsonBlock title="Mensagens" value={call.data.messages} />
              <JsonBlock title="Resposta bruta" value={call.data.rawResponse} />
              <JsonBlock title="Saída validada" value={call.data.parsedOutput} />
              {call.data.error != null && <JsonBlock title="Erro" value={call.data.error} />}
            </div>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
