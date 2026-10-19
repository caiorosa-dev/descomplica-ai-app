import { MODEL_REFS, type Provider, providerOf } from './catalog';
import { AgentRole, type PipelineConfig, type PipelineConfigInput } from './pipeline-config';

export interface BuiltinPreset {
  slug: string;
  name: string;
  description: string;
  config: PipelineConfigInput;
}

export const BUILTIN_PRESETS: readonly BuiltinPreset[] = [
  {
    slug: 'openai-default',
    name: 'OpenAI (padrão)',
    description: 'Modelo principal e modelo pequeno da OpenAI nos slots correspondentes. É a linha de base.',
    config: {},
  },
  {
    slug: 'anthropic-default',
    name: 'Anthropic (padrão)',
    description: 'Claude Sonnet nos slots principais e Claude Haiku nos pequenos. Os embeddings continuam na OpenAI.',
    config: {
      models: {
        cleaning: { model: MODEL_REFS.anthropicSmall },
        classification: { model: MODEL_REFS.anthropicSmall },
        extraction: { model: MODEL_REFS.anthropicMain },
        summarization: { model: MODEL_REFS.anthropicMain },
        claimExtraction: { model: MODEL_REFS.anthropicSmall },
        verification: { model: MODEL_REFS.anthropicMain },
      },
    },
  },
  {
    slug: 'cross-verifier',
    name: 'Verificador cruzado',
    description:
      'OpenAI até o resumo; extração de afirmações e verificação com Claude, para reduzir o viés de um modelo validar a própria família.',
    config: {
      models: {
        claimExtraction: { model: MODEL_REFS.anthropicSmall },
        verification: { model: MODEL_REFS.anthropicMain },
      },
    },
  },
  {
    slug: 'budget',
    name: 'Econômico',
    description: 'Modelo pequeno da OpenAI em todos os slots e limpeza por LLM desligada. Compara custo e qualidade.',
    config: {
      models: Object.fromEntries(AgentRole.options.map((role) => [role, { model: MODEL_REFS.openaiSmall }])),
      textExtraction: { cleaning: { llmCleanup: 'off' } },
    },
  },
];

/** Providers whose keys a config needs: every generation slot plus the embedding model. */
export function requiredProviders(config: PipelineConfig): Set<Provider> {
  const refs = [...AgentRole.options.map((role) => config.models[role].model), config.similarity.embeddingModel];
  return new Set(refs.map(providerOf));
}
