import { PipelineConfig, type ProvidersDto, type RunDto, STAGE_ORDER, type StageName } from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api-client';
import { STAGE_LABELS } from '@/lib/labels';
import { rerunnableStages, useRerun } from './actions';
import { buildOverrides } from './config-form/config-diff';
import { PipelineConfigForm } from './config-form/pipeline-config-form';

/** "Reprocessar a partir de...": pick a stage and change only the config of that stage onwards. */
export function RerunDialog({
  run,
  providers,
  open,
  onOpenChange,
}: {
  run: RunDto;
  providers: ProvidersDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const stages = rerunnableStages(run);
  const [fromStage, setFromStage] = useState<StageName>(
    stages.includes('summarization') ? 'summarization' : (stages.at(-1) ?? 'text_extraction'),
  );
  const form = useForm<PipelineConfig>({ defaultValues: run.config, resolver: zodResolver(PipelineConfig) as never });
  const rerun = useRerun(run.id);
  const editable = STAGE_ORDER.slice(STAGE_ORDER.indexOf(fromStage));

  const submit = form.handleSubmit((values) =>
    rerun.mutate(
      { fromStage, configOverrides: buildOverrides(run.config, values) },
      {
        onSuccess: () => onOpenChange(false),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível reprocessar.'),
      },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reprocessar a partir de uma etapa</DialogTitle>
          <DialogDescription>
            As etapas anteriores são reaproveitadas; só a configuração das etapas seguintes pode mudar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="from-stage">Reprocessar a partir de</FieldLabel>
            <Select value={fromStage} onValueChange={(v) => setFromStage(v as StageName)}>
              <SelectTrigger id="from-stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STAGE_ORDER.map((stage) => (
                    <SelectItem key={stage} value={stage} disabled={!stages.includes(stage)}>
                      {STAGE_LABELS[stage]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>Só aparecem as etapas cujas anteriores terminaram.</FieldDescription>
          </Field>
          <ScrollArea className="max-h-[50vh] pr-3">
            <PipelineConfigForm form={form} providers={providers} editableStages={editable} />
          </ScrollArea>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={rerun.isPending}>
              {rerun.isPending && <Spinner data-icon="inline-start" />}
              Reprocessar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
