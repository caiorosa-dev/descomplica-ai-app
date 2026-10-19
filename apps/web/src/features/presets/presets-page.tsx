import { type PresetDto, requiredProviders } from '@app/shared';
import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ToneBadge } from '@/components/tone-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { usePresets, useProviders } from '../documents/queries';
import { PresetEditor } from './preset-editor';
import { useDeletePreset, useDuplicatePreset, useSavePreset } from './queries';

type Editing = { preset: PresetDto | null } | null;

export function PresetsPage() {
  const presets = usePresets();
  const providers = useProviders();
  const save = useSavePreset();
  const duplicate = useDuplicatePreset();
  const remove = useDeletePreset();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<PresetDto | null>(null);
  const fail = (e: unknown, fallback: string) => toast.error(e instanceof ApiError ? e.message : fallback);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Presets</h1>
          <p className="text-muted-foreground">
            Configurações completas da pipeline. Os padrões são somente leitura; duplique para alterar.
          </p>
        </div>
        <Button onClick={() => setEditing({ preset: null })}>
          <PlusIcon data-icon="inline-start" />
          Novo preset
        </Button>
      </div>
      {presets.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(presets.data ?? []).map((preset) => (
            <Card key={preset.id}>
              <CardHeader>
                <CardTitle>{preset.name}</CardTitle>
                <CardDescription>{preset.slug}</CardDescription>
                <CardAction className="flex gap-1">
                  {preset.isBuiltin && <ToneBadge tone="neutral">Padrão</ToneBadge>}
                </CardAction>
              </CardHeader>
              <div className="flex flex-col gap-3 px-6 text-sm">
                <p className="text-muted-foreground">{preset.description}</p>
                <div className="flex flex-wrap gap-1">
                  {[...requiredProviders(preset.config)].map((p) => (
                    <ToneBadge key={p} tone="neutral">
                      {p === 'openai' ? 'OpenAI' : 'Anthropic'}
                    </ToneBadge>
                  ))}
                </div>
              </div>
              <CardFooter className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing({ preset })}>
                  <PencilIcon data-icon="inline-start" />
                  {preset.isBuiltin ? 'Ver' : 'Editar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={duplicate.isPending}
                  onClick={() =>
                    duplicate.mutate(preset.id, {
                      onSuccess: (copy) => toast.success(`Preset duplicado como ${copy.slug}`),
                      onError: (e) => fail(e, 'Não foi possível duplicar.'),
                    })
                  }
                >
                  <CopyIcon data-icon="inline-start" />
                  Duplicar
                </Button>
                {!preset.isBuiltin && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(preset)}>
                    <Trash2Icon data-icon="inline-start" />
                    Excluir
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="right" className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{editing?.preset ? editing.preset.name : 'Novo preset'}</SheetTitle>
            <SheetDescription>
              {editing?.preset?.isBuiltin
                ? 'Preset padrão: somente leitura. Use "Duplicar" para criar uma cópia editável.'
                : 'Ajuste a configuração de cada etapa.'}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
            {editing && providers.data && (
              <PresetEditor
                key={editing.preset?.id ?? 'new'}
                preset={editing.preset}
                providers={providers.data}
                readOnly={editing.preset?.isBuiltin}
                onSave={(values) =>
                  save.mutateAsync({ id: editing.preset?.id ?? null, values }).then(() => {
                    toast.success('Preset salvo');
                    setEditing(null);
                  })
                }
              />
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o preset {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              As execuções feitas com ele continuam disponíveis, com a configuração guardada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleting &&
                remove.mutate(deleting.id, {
                  onSuccess: () => toast.success('Preset excluído'),
                  onError: (e) => fail(e, 'Não foi possível excluir.'),
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
