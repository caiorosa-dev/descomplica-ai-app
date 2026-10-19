import { AgentRole, FactCategory, type ProvidersDto, type StageName } from '@app/shared';
import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldGroup } from '@/components/ui/field';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CATEGORY_LABELS } from '@/lib/labels';
import { CONFIG_BLOCK_STAGE } from './config-diff';
import { type ConfigForm, MultiToggleField, NumberField, SelectField, SwitchField } from './fields';
import { ModelSlotField } from './model-slot-field';

const CATEGORY_OPTIONS = FactCategory.options.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));
const grid = 'grid gap-4 sm:grid-cols-2';

export interface PipelineConfigFormProps {
  form: ConfigForm;
  providers: ProvidersDto;
  editableStages: StageName[];
  readOnly?: boolean;
}

/** One accordion block per stage; blocks outside `editableStages` (or everything when read-only) are disabled. */
export function PipelineConfigForm({ form, providers, editableStages, readOnly }: PipelineConfigFormProps) {
  const [showJson, setShowJson] = useState(false);
  const locked = (block: string) => readOnly || !editableStages.includes(CONFIG_BLOCK_STAGE[block] as StageName);
  const embeddingOptions = providers.models
    .filter((m) => m.kind === 'embedding')
    .map((m) => ({ value: m.ref, label: m.label }));

  return (
    <div className="flex flex-col gap-3">
      <Accordion type="multiple" defaultValue={['models']} className="rounded-lg border px-4">
        <AccordionItem value="models">
          <AccordionTrigger>Modelos</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-6">
            {AgentRole.options.map((role) => (
              <ModelSlotField
                key={role}
                form={form}
                role={role}
                providers={providers}
                disabled={locked(`models.${role}`)}
              />
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="textExtraction">
          <AccordionTrigger>Extração e limpeza</AccordionTrigger>
          <AccordionContent>
            <FieldGroup className={grid}>
              <NumberField
                form={form}
                name="textExtraction.maxFileSizeMb"
                label="Tamanho máximo (MB)"
                disabled={locked('textExtraction')}
              />
              <NumberField
                form={form}
                name="textExtraction.minCharsPerPage"
                label="Mínimo de caracteres por página"
                help="Abaixo disso o PDF é tratado como escaneado."
                disabled={locked('textExtraction')}
              />
              <NumberField
                form={form}
                name="textExtraction.pdf.edgeBandRatio"
                label="Faixa de cabeçalho/rodapé"
                step={0.01}
                disabled={locked('textExtraction')}
              />
              <NumberField
                form={form}
                name="textExtraction.pdf.repeatThreshold"
                label="Repetição mínima nas páginas"
                step={0.05}
                disabled={locked('textExtraction')}
              />
              <SelectField
                form={form}
                name="textExtraction.cleaning.llmCleanup"
                label="Limpeza por LLM"
                options={[
                  { value: 'off', label: 'Desligada' },
                  { value: 'edges', label: 'Bordas das páginas' },
                  { value: 'full', label: 'Todas as linhas' },
                ]}
                disabled={locked('textExtraction')}
              />
              <MultiToggleField
                form={form}
                name="textExtraction.cleaning.boilerplatePatternSets"
                label="Padrões removidos"
                options={[
                  { value: 'stj-e-signature', label: 'Carimbo do STJ' },
                  { value: 'dje-header', label: 'Cabeçalho do DJe' },
                ]}
                disabled={locked('textExtraction')}
              />
              <SwitchField
                form={form}
                name="textExtraction.html.dropStrikethrough"
                label="Ignorar texto riscado (HTML)"
                disabled={locked('textExtraction')}
              />
              <SwitchField
                form={form}
                name="textExtraction.cleaning.normalizeUnicode"
                label="Normalizar Unicode"
                disabled={locked('textExtraction')}
              />
              <SwitchField
                form={form}
                name="textExtraction.cleaning.removeRepeatedHeadersFooters"
                label="Remover cabeçalhos e rodapés"
                disabled={locked('textExtraction')}
              />
              <SwitchField
                form={form}
                name="textExtraction.cleaning.removePageNumbers"
                label="Remover números de página"
                disabled={locked('textExtraction')}
              />
              <SwitchField
                form={form}
                name="textExtraction.cleaning.dehyphenate"
                label="Juntar palavras hifenizadas"
                disabled={locked('textExtraction')}
              />
              <SwitchField
                form={form}
                name="textExtraction.cleaning.rebuildParagraphs"
                label="Reconstruir parágrafos"
                disabled={locked('textExtraction')}
              />
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="extraction">
          <AccordionTrigger>Classificação e extração</AccordionTrigger>
          <AccordionContent>
            <FieldGroup className={grid}>
              <SelectField
                form={form}
                name="classification.mode"
                label="Tipo do documento"
                options={[
                  { value: 'auto', label: 'Detectar automaticamente' },
                  { value: 'court_decision', label: 'Decisão judicial' },
                  { value: 'normative_act', label: 'Ato normativo' },
                  { value: 'generic', label: 'Outro' },
                ]}
                disabled={locked('classification')}
              />
              <SelectField
                form={form}
                name="extraction.strategy"
                label="Estratégia"
                options={[
                  { value: 'single_pass', label: 'Texto inteiro' },
                  { value: 'chunked', label: 'Em partes' },
                ]}
                disabled={locked('extraction')}
              />
              <SelectField
                form={form}
                name="extraction.agentSplit"
                label="Divisão das chamadas"
                options={[
                  { value: 'unified', label: 'Todas as categorias juntas' },
                  { value: 'per_category', label: 'Uma por grupo de categorias' },
                ]}
                disabled={locked('extraction')}
              />
              <SelectField
                form={form}
                name="extraction.minConfidence"
                label="Confiança mínima"
                options={[
                  { value: 'low', label: 'Baixa' },
                  { value: 'medium', label: 'Média' },
                  { value: 'high', label: 'Alta' },
                ]}
                disabled={locked('extraction')}
              />
              <NumberField
                form={form}
                name="extraction.maxSinglePassTokens"
                label="Tokens máximos em uma chamada"
                disabled={locked('extraction')}
              />
              <NumberField
                form={form}
                name="extraction.chunkTokens"
                label="Tokens por parte"
                disabled={locked('extraction')}
              />
              <NumberField
                form={form}
                name="extraction.overlapTokens"
                label="Sobreposição entre partes"
                disabled={locked('extraction')}
              />
              <NumberField
                form={form}
                name="extraction.grounding.fuzzyThreshold"
                label="Similaridade mínima da citação"
                step={0.01}
                help="Usada na ancoragem aproximada (0 a 1)."
                disabled={locked('extraction')}
              />
              <div className="sm:col-span-2">
                <MultiToggleField
                  form={form}
                  name="extraction.categories"
                  label="Categorias extraídas"
                  options={CATEGORY_OPTIONS}
                  disabled={locked('extraction')}
                />
              </div>
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="summarization">
          <AccordionTrigger>Resumo</AccordionTrigger>
          <AccordionContent>
            <FieldGroup className={grid}>
              <SelectField
                form={form}
                name="summarization.audience"
                label="Público"
                options={[
                  { value: 'layperson', label: 'Leigo' },
                  { value: 'professional', label: 'Profissional do direito' },
                ]}
                disabled={locked('summarization')}
              />
              <SelectField
                form={form}
                name="summarization.targetLength"
                label="Tamanho"
                options={[
                  { value: 'short', label: 'Curto (~150 palavras)' },
                  { value: 'medium', label: 'Médio (~350 palavras)' },
                  { value: 'long', label: 'Longo (~700 palavras)' },
                ]}
                disabled={locked('summarization')}
              />
              <SelectField
                form={form}
                name="summarization.strategy"
                label="Estratégia"
                options={[
                  { value: 'direct', label: 'Direta' },
                  { value: 'hierarchical', label: 'Hierárquica' },
                ]}
                disabled={locked('summarization')}
              />
              <SelectField
                form={form}
                name="summarization.uncertainFacts"
                label="Fatos incertos"
                options={[
                  { value: 'hedge', label: 'Citar com ressalva' },
                  { value: 'omit', label: 'Omitir' },
                ]}
                disabled={locked('summarization')}
              />
              <NumberField
                form={form}
                name="summarization.maxDirectTokens"
                label="Tokens máximos na estratégia direta"
                disabled={locked('summarization')}
              />
              <SwitchField
                form={form}
                name="summarization.useExtractedFacts"
                label="Usar os fatos extraídos"
                disabled={locked('summarization')}
              />
              <SwitchField
                form={form}
                name="summarization.includeGlossary"
                label="Incluir glossário"
                disabled={locked('summarization')}
              />
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="similarity">
          <AccordionTrigger>Similaridade</AccordionTrigger>
          <AccordionContent>
            <FieldGroup className={grid}>
              <SelectField
                form={form}
                name="similarity.embeddingModel"
                label="Modelo de embedding"
                options={embeddingOptions}
                disabled={locked('similarity')}
              />
              <NumberField
                form={form}
                name="similarity.dimensions"
                label="Dimensões"
                nullable
                disabled={locked('similarity')}
              />
              <SelectField
                form={form}
                name="similarity.chunking.method"
                label="Divisão do documento"
                options={[
                  { value: 'structural', label: 'Por seções' },
                  { value: 'fixed', label: 'Janelas fixas' },
                ]}
                disabled={locked('similarity')}
              />
              <SelectField
                form={form}
                name="similarity.headline"
                label="Índice principal"
                options={[
                  { value: 'alignment_f1', label: 'Alinhamento (F1)' },
                  { value: 'coverage', label: 'Cobertura' },
                  { value: 'support', label: 'Respaldo' },
                  { value: 'centroid', label: 'Centroide' },
                ]}
                disabled={locked('similarity')}
              />
              <NumberField
                form={form}
                name="similarity.chunking.maxTokens"
                label="Tokens por trecho"
                disabled={locked('similarity')}
              />
              <NumberField
                form={form}
                name="similarity.chunking.overlapTokens"
                label="Sobreposição (janelas fixas)"
                disabled={locked('similarity')}
              />
              <NumberField
                form={form}
                name="similarity.highlightBottomPercent"
                label="Destacar os piores (%)"
                disabled={locked('similarity')}
              />
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="verification">
          <AccordionTrigger>Verificação</AccordionTrigger>
          <AccordionContent>
            <FieldGroup className={grid}>
              <MultiToggleField
                form={form}
                name="verification.directions"
                label="Direções"
                options={[
                  { value: 'source_to_summary', label: 'Documento → resumo' },
                  { value: 'summary_to_source', label: 'Resumo → documento' },
                ]}
                disabled={locked('verification')}
              />
              <SwitchField
                form={form}
                name="verification.deterministicFirst"
                label="Comparar valores por código antes do LLM"
                disabled={locked('verification')}
              />
              <NumberField
                form={form}
                name="verification.retrievalTopK"
                label="Trechos recuperados por afirmação"
                disabled={locked('verification')}
              />
              <NumberField
                form={form}
                name="verification.batchSize"
                label="Itens por lote"
                disabled={locked('verification')}
              />
              <div className="sm:col-span-2">
                <MultiToggleField
                  form={form}
                  name="verification.criticalCategories"
                  label="Categorias críticas"
                  help="Geram alerta de omissão e entram na consistência factual."
                  options={CATEGORY_OPTIONS}
                  disabled={locked('verification')}
                />
              </div>
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Button type="button" variant="outline" className="w-fit" onClick={() => setShowJson(true)}>
        Ver JSON
      </Button>
      <Dialog open={showJson} onOpenChange={setShowJson}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configuração em JSON</DialogTitle>
            <DialogDescription>Valores atuais do formulário.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(form.getValues(), null, 2)}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
