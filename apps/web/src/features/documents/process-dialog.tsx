import { type DocumentDto, type PresetDto, type Provider, type ProvidersDto, requiredProviders } from '@app/shared';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

export function presetAvailability(
  preset: PresetDto,
  providers: ProvidersDto,
): { available: boolean; missing: Provider[] } {
  const configured = new Set(providers.providers.filter((p) => p.configured).map((p) => p.id));
  const missing = [...requiredProviders(preset.config)].filter((p) => !configured.has(p));
  return { available: missing.length === 0, missing };
}

const keyName = (provider: Provider) => `${provider.toUpperCase()}_API_KEY`;

export interface ProcessDialogProps {
  document: DocumentDto;
  presets: PresetDto[];
  providers: ProvidersDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: (presetId: string) => void;
  pending?: boolean;
}

/** Picks a preset to process a document; presets whose providers have no API key are disabled. */
export function ProcessDialog({
  document,
  presets,
  providers,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: ProcessDialogProps) {
  const options = useMemo(
    () => presets.map((p) => ({ preset: p, ...presetAvailability(p, providers) })),
    [presets, providers],
  );
  const [presetId, setPresetId] = useState<string | undefined>();
  useEffect(() => {
    if (open) setPresetId(options.find((o) => o.available)?.preset.id);
  }, [open, options]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simplificar documento</DialogTitle>
          <DialogDescription>{document.filename}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="preset">Preset</FieldLabel>
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger id="preset" className="w-full">
                <SelectValue placeholder="Escolha um preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map(({ preset, available, missing }) => (
                    <SelectItem key={preset.id} value={preset.id} disabled={!available}>
                      <span className="flex flex-col items-start">
                        <span>
                          {preset.name} <span className="text-muted-foreground">({preset.slug})</span>
                        </span>
                        {!available && (
                          <span className="text-xs text-muted-foreground">
                            Configure a chave {missing.map(keyName).join(' e ')} no .env
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>Define os modelos usados em cada etapa.</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!presetId || pending} onClick={() => presetId && onConfirm?.(presetId)}>
            {pending && <Spinner data-icon="inline-start" />}
            Simplificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
