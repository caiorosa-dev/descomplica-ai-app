import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRunResult, useRunText } from './queries';
import { SourceSheetProvider } from './source-sheet';
import { FactsTab } from './tabs/facts-tab';
import { SummaryTab } from './tabs/summary-tab';

export function RunTabs({ runId }: { runId: string }) {
  const result = useRunResult(runId, true);
  const text = useRunText(runId);
  if (result.isPending) return <Skeleton className="h-96 w-full" />;
  if (result.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar o resultado</AlertTitle>
        <AlertDescription>{result.error.message}</AlertDescription>
      </Alert>
    );
  return (
    <SourceSheetProvider runId={runId}>
      <Tabs defaultValue="summary" className="flex flex-col gap-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          <TabsTrigger value="facts">Dados extraídos</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <SummaryTab result={result.data} text={text.data} />
        </TabsContent>
        <TabsContent value="facts">
          <FactsTab result={result.data} />
        </TabsContent>
      </Tabs>
    </SourceSheetProvider>
  );
}
