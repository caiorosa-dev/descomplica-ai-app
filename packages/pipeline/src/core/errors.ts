export type PipelineErrorCode =
  | 'UNSUPPORTED_FILE'
  | 'FILE_TOO_LARGE'
  | 'LOW_TEXT_DENSITY'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMITED'
  | 'PROVIDER_QUOTA_EXCEEDED'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'CANCELLED'
  | 'INTERRUPTED'
  | 'INTERNAL_ERROR';

/** Messages shown in the UI (pt-BR, spec §12). */
export const USER_MESSAGES: Record<PipelineErrorCode, string> = {
  UNSUPPORTED_FILE: 'Formato de arquivo não suportado. Envie um PDF, DOCX, HTML ou TXT.',
  FILE_TOO_LARGE: 'O arquivo passa do tamanho máximo permitido.',
  LOW_TEXT_DENSITY: 'O PDF parece escaneado (há pouco texto por página); OCR está fora do escopo.',
  PROVIDER_NOT_CONFIGURED: 'A configuração usa um provedor sem chave de API. Configure o .env ou troque o preset.',
  PROVIDER_ERROR: 'O provedor de IA falhou mesmo após novas tentativas. Tente de novo a partir desta etapa.',
  RATE_LIMITED: 'O provedor de IA continuou limitando as requisições. Tente de novo ou reduza a concorrência.',
  PROVIDER_QUOTA_EXCEEDED:
    'A conta do provedor de IA está sem créditos. Adicione créditos e refaça a partir desta etapa.',
  SCHEMA_VALIDATION_FAILED: 'O modelo respondeu fora do formato esperado. Tente de novo ou troque o modelo.',
  CANCELLED: 'A execução foi cancelada.',
  INTERRUPTED: 'A API reiniciou durante a execução. Retome a execução para continuar.',
  INTERNAL_ERROR: 'Ocorreu um erro interno inesperado.',
};

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly userMessage: string;
  readonly details?: unknown;

  /** `message` is the English log message; the pt-BR `userMessage` comes from the code. */
  constructor(code: PipelineErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'PipelineError';
    this.code = code;
    this.userMessage = USER_MESSAGES[code];
    this.details = details;
  }
}

export function isPipelineError(e: unknown): e is PipelineError {
  return e instanceof PipelineError;
}
