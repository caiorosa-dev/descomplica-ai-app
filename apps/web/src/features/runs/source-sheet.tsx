import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useRunText } from './queries';
import { SourceSheetContext, type SourceSpan } from './use-source-sheet';

/** "Ver trecho": opens the canonical text on the right, scrolled to the highlighted span. */
export function SourceSheetProvider({ runId, children }: { runId: string; children: ReactNode }) {
  const [span, setSpan] = useState<SourceSpan | null>(null);
  const text = useRunText(runId, span !== null);
  const mark = useRef<HTMLElement>(null);
  const value = useMemo(() => ({ open: (s: SourceSpan) => setSpan(s) }), []);
  const canonical = text.data?.canonicalText;

  useEffect(() => {
    if (!span || !canonical) return;
    const id = setTimeout(() => mark.current?.scrollIntoView({ block: 'center' }), 150);
    return () => clearTimeout(id);
  }, [span, canonical]);

  return (
    <SourceSheetContext.Provider value={value}>
      {children}
      <Sheet open={span !== null} onOpenChange={(open) => !open && setSpan(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Trecho do documento
              {span?.page != null && <Badge variant="secondary">Página {span.page}</Badge>}
            </SheetTitle>
            <SheetDescription>O trecho aparece destacado no texto do documento.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
            {canonical && span ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {canonical.slice(0, span.start)}
                <mark ref={mark} className="rounded-sm bg-warning/30 px-0.5 text-foreground">
                  {canonical.slice(span.start, span.end)}
                </mark>
                {canonical.slice(span.end)}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </SourceSheetContext.Provider>
  );
}
