import { isPipelineError } from '@app/pipeline';
import type { ApiErrorBody, ApiIssue } from '@app/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { HttpError, PIPELINE_ERROR_STATUS } from '../http-error';

const pathOf = (instancePath: string): (string | number)[] =>
  instancePath
    .split('/')
    .filter(Boolean)
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));

function body(code: string, message: string, details?: unknown): ApiErrorBody {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}

/** Maps every error to `{ error: { code, message, details? } }` with a pt-BR message. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(body('NOT_FOUND', `Rota ${request.method} ${request.url} não encontrada.`));
  });

  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof HttpError)
      return reply.status(error.status).send(body(error.code, error.message, error.details));
    if (isPipelineError(error))
      return reply.status(PIPELINE_ERROR_STATUS[error.code]).send(body(error.code, error.userMessage, error.details));
    if (hasZodFastifySchemaValidationErrors(error)) {
      const issues: ApiIssue[] = error.validation.map((v) => ({
        path: pathOf(v.instancePath),
        message: v.message ?? 'Valor inválido',
        code: v.keyword,
      }));
      return reply.status(400).send(body('VALIDATION_ERROR', 'Os dados enviados são inválidos.', { issues }));
    }
    if (error instanceof ZodError) {
      const issues: ApiIssue[] = error.issues.map((i) => ({
        path: i.path as (string | number)[],
        message: i.message,
        code: i.code,
      }));
      return reply.status(400).send(body('VALIDATION_ERROR', 'Os dados enviados são inválidos.', { issues }));
    }
    const fastifyError = error as FastifyError;
    if (fastifyError.code === 'FST_REQ_FILE_TOO_LARGE')
      return reply.status(413).send(body('FILE_TOO_LARGE', 'O arquivo passa do tamanho máximo permitido.'));
    const status = fastifyError.statusCode ?? 500;
    if (status < 500) return reply.status(status).send(body(fastifyError.code ?? 'BAD_REQUEST', error.message));
    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send(body('INTERNAL_ERROR', 'Ocorreu um erro interno inesperado.'));
  });
}
