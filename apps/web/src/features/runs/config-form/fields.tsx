import type { PipelineConfig } from '@app/shared';
import { type FieldPath, type UseFormReturn, useController } from 'react-hook-form';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type ConfigForm = UseFormReturn<PipelineConfig>;
export type ConfigPath = FieldPath<PipelineConfig>;

interface BaseProps {
  form: ConfigForm;
  name: ConfigPath;
  label: string;
  help?: string;
  disabled?: boolean;
}

const fieldId = (name: string) => `cfg-${name.replace(/\./g, '-')}`;

export function NumberField({
  form,
  name,
  label,
  help,
  disabled,
  nullable,
  step,
}: BaseProps & { nullable?: boolean; step?: number }) {
  const { field, fieldState } = useController({ control: form.control, name });
  const value = field.value as number | null;
  return (
    <Field data-invalid={fieldState.invalid || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={fieldId(name)}>{label}</FieldLabel>
      <Input
        id={fieldId(name)}
        type="number"
        step={step ?? 'any'}
        disabled={disabled}
        aria-invalid={fieldState.invalid || undefined}
        value={value ?? ''}
        placeholder={nullable ? 'padrão do modelo' : undefined}
        onChange={(e) => field.onChange(e.target.value === '' ? (nullable ? null : 0) : Number(e.target.value))}
        onBlur={field.onBlur}
      />
      {help && <FieldDescription>{help}</FieldDescription>}
      <FieldError>{fieldState.error?.message}</FieldError>
    </Field>
  );
}

export function SwitchField({ form, name, label, help, disabled }: BaseProps) {
  const { field } = useController({ control: form.control, name });
  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined}>
      <Switch id={fieldId(name)} checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={disabled} />
      <FieldContent>
        <FieldLabel htmlFor={fieldId(name)}>{label}</FieldLabel>
        {help && <FieldDescription>{help}</FieldDescription>}
      </FieldContent>
    </Field>
  );
}

export function SelectField({
  form,
  name,
  label,
  help,
  disabled,
  options,
}: BaseProps & { options: { value: string; label: string; disabled?: boolean }[] }) {
  const { field, fieldState } = useController({ control: form.control, name });
  return (
    <Field data-invalid={fieldState.invalid || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={fieldId(name)}>{label}</FieldLabel>
      <Select
        value={field.value == null ? undefined : String(field.value)}
        onValueChange={field.onChange}
        disabled={disabled}
      >
        <SelectTrigger id={fieldId(name)} aria-invalid={fieldState.invalid || undefined} className="w-full">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {help && <FieldDescription>{help}</FieldDescription>}
      <FieldError>{fieldState.error?.message}</FieldError>
    </Field>
  );
}

export function MultiToggleField({
  form,
  name,
  label,
  help,
  disabled,
  options,
}: BaseProps & { options: { value: string; label: string }[] }) {
  const { field, fieldState } = useController({ control: form.control, name });
  return (
    <Field data-invalid={fieldState.invalid || undefined} data-disabled={disabled || undefined}>
      <FieldLabel>{label}</FieldLabel>
      <ToggleGroup
        type="multiple"
        variant="outline"
        className="flex-wrap justify-start"
        value={(field.value as string[]) ?? []}
        onValueChange={field.onChange}
        disabled={disabled}
        aria-label={label}
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value}>
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {help && <FieldDescription>{help}</FieldDescription>}
      <FieldError>{fieldState.error?.message}</FieldError>
    </Field>
  );
}
