import type { PipelineErrorCode } from '@app/pipeline';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const PIPELINE_ERROR_STATUS: Record<PipelineErrorCode, number> = {
  UNSUPPORTED_FILE: 415,
  FILE_TOO_LARGE: 413,
  LOW_TEXT_DENSITY: 500,
  PROVIDER_NOT_CONFIGURED: 400,
  PROVIDER_ERROR: 502,
  RATE_LIMITED: 429,
  SCHEMA_VALIDATION_FAILED: 500,
  CANCELLED: 500,
  INTERRUPTED: 500,
  INTERNAL_ERROR: 500,
};

export const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} não encontrado.`);
