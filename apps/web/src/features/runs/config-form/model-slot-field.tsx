import { type AgentRole, findModel, type ProvidersDto } from '@app/shared';
import { useWatch } from 'react-hook-form';
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { type ConfigForm, NumberField, SelectField } from './fields';

export const ROLE_LABELS: Record<AgentRole, string> = {
  cleaning: 'Limpeza',
  classification: 'Classificação',
  extraction: 'Extração',
  summarization: 'Resumo',
  claimExtraction: 'Afirmações',
  verification: 'Verificação',
};

const EFFORT_OPTIONS = [
  { value: 'low', label: 'Baixo' },
  { value: 'medium', label: 'Médio' },
  { value: 'high', label: 'Alto' },
];

/** Model, temperature and reasoning effort of one slot; parameters the model does not accept are disabled. */
export function ModelSlotField({
  form,
  role,
  providers,
  disabled,
}: {
  form: ConfigForm;
  role: AgentRole;
  providers: ProvidersDto;
  disabled?: boolean;
}) {
  const ref = useWatch({ control: form.control, name: `models.${role}.model` });
  const entry = findModel(ref);
  const configured = new Set(providers.providers.filter((p) => p.configured).map((p) => p.id));
  const options = providers.models
    .filter((m) => m.kind === 'language' && (configured.has(m.provider) || m.ref === ref))
    .map((m) => ({ value: m.ref, label: m.label, disabled: !configured.has(m.provider) }));
  return (
    <FieldSet data-disabled={disabled || undefined}>
      <FieldLegend variant="label">{ROLE_LABELS[role]}</FieldLegend>
      <FieldGroup className="grid gap-4 sm:grid-cols-3">
        <SelectField
          form={form}
          name={`models.${role}.model`}
          label={`Modelo de ${ROLE_LABELS[role].toLowerCase()}`}
          options={options}
          disabled={disabled}
        />
        <NumberField
          form={form}
          name={`models.${role}.temperature`}
          label="Temperatura"
          step={0.1}
          nullable
          disabled={disabled || !entry?.supportsTemperature}
          help={entry?.supportsTemperature ? undefined : 'Este modelo não aceita temperatura.'}
        />
        <SelectField
          form={form}
          name={`models.${role}.reasoningEffort`}
          label="Esforço de raciocínio"
          options={EFFORT_OPTIONS}
          disabled={disabled || !entry?.supportsReasoningEffort}
          help={entry?.supportsReasoningEffort ? undefined : 'Este modelo não usa esforço de raciocínio.'}
        />
      </FieldGroup>
    </FieldSet>
  );
}
