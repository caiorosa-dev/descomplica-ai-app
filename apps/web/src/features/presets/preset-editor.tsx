import {
  type ApiIssue,
  PipelineConfig,
  type PresetDto,
  type ProvidersDto,
  parsePipelineConfig,
  STAGE_ORDER,
} from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { PipelineConfigForm } from '../runs/config-form/pipeline-config-form';

export interface PresetFormValues {
  slug: string;
  name: string;
  description: string;
  config: PipelineConfig;
}

function issuesOf(error: ApiError): ApiIssue[] {
  const details = error.details as { issues?: ApiIssue[] } | undefined;
  return Array.isArray(details?.issues) ? details.issues : [];
}

/** Puts each Zod issue returned by the API under its config field (the `config.` prefix is dropped). */
export function applyApiIssues(form: UseFormReturn<PipelineConfig>, error: ApiError): void {
  for (const issue of issuesOf(error)) {
    if (issue.path[0] !== 'config' || issue.path.length < 2) continue;
    form.setError(issue.path.slice(1).join('.') as never, { type: 'server', message: issue.message });
  }
}

export interface PresetEditorProps {
  preset: PresetDto | null;
  providers: ProvidersDto;
  onSave: (values: PresetFormValues) => Promise<unknown>;
  readOnly?: boolean;
}

export function PresetEditor({ preset, providers, onSave, readOnly }: PresetEditorProps) {
  const form = useForm<PipelineConfig>({
    defaultValues: preset?.config ?? parsePipelineConfig({}),
    resolver: zodResolver(PipelineConfig) as never,
  });
  const [meta, setMeta] = useState({
    slug: preset?.slug ?? '',
    name: preset?.name ?? '',
    description: preset?.description ?? '',
  });
  const [metaErrors, setMetaErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = form.handleSubmit(async (config) => {
    setSaving(true);
    setMetaErrors({});
    try {
      await onSave({ ...meta, config });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      applyApiIssues(form, e);
      const errors: Record<string, string> = {};
      for (const issue of issuesOf(e)) if (issue.path.length === 1) errors[String(issue.path[0])] = issue.message;
      setMetaErrors(errors);
    } finally {
      setSaving(false);
    }
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={metaErrors.slug ? true : undefined} data-disabled={preset ? true : undefined}>
          <FieldLabel htmlFor="preset-slug">Slug</FieldLabel>
          <Input
            id="preset-slug"
            value={meta.slug}
            disabled={Boolean(preset) || readOnly}
            aria-invalid={metaErrors.slug ? true : undefined}
            onChange={(e) => setMeta({ ...meta, slug: e.target.value })}
            placeholder="meu-preset"
          />
          <FieldDescription>Letras minúsculas, números e hífens. Não muda depois de criado.</FieldDescription>
          <FieldError>{metaErrors.slug}</FieldError>
        </Field>
        <Field data-invalid={metaErrors.name ? true : undefined}>
          <FieldLabel htmlFor="preset-name">Nome</FieldLabel>
          <Input
            id="preset-name"
            value={meta.name}
            disabled={readOnly}
            onChange={(e) => setMeta({ ...meta, name: e.target.value })}
          />
          <FieldError>{metaErrors.name}</FieldError>
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="preset-description">Descrição</FieldLabel>
          <Textarea
            id="preset-description"
            value={meta.description}
            disabled={readOnly}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
          />
        </Field>
      </FieldGroup>
      <PipelineConfigForm form={form} providers={providers} editableStages={[...STAGE_ORDER]} readOnly={readOnly} />
      {!readOnly && (
        <Button type="submit" className="w-fit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          Salvar
        </Button>
      )}
    </form>
  );
}
