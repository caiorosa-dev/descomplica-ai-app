import { ApiErrorBody, UploadDocumentResponse } from '@app/shared';
import type { z } from 'zod';

const BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  method: string,
  path: string,
  init: { body?: BodyInit; json?: unknown; schema?: z.ZodType<T> },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      headers: init.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível falar com a API. Ela está rodando?');
  }
  const text = await response.text();
  const data = text ? safeJson(text) : undefined;
  if (!response.ok) {
    const parsed = ApiErrorBody.safeParse(data);
    if (parsed.success)
      throw new ApiError(response.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.details);
    throw new ApiError(response.status, 'HTTP_ERROR', `A API respondeu ${response.status}.`);
  }
  return init.schema ? init.schema.parse(data) : (data as T);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Typed client over the API: every response is validated with the contracts of @app/shared. */
export const api = {
  get: <T>(path: string, schema: z.ZodType<T>) => request('GET', path, { schema }),
  post: <T>(path: string, body: unknown, schema: z.ZodType<T>) => request('POST', path, { json: body ?? {}, schema }),
  put: <T>(path: string, body: unknown, schema: z.ZodType<T>) => request('PUT', path, { json: body, schema }),
  del: async (path: string): Promise<void> => {
    await request('DELETE', path, {});
  },
  /** Multipart upload through XHR so the caller can show progress (0–1). */
  upload(file: File, onProgress?: (fraction: number) => void): Promise<UploadDocumentResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/documents`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(e.loaded / e.total);
      };
      xhr.onerror = () =>
        reject(new ApiError(0, 'NETWORK_ERROR', 'Não foi possível falar com a API. Ela está rodando?'));
      xhr.onload = () => {
        const data = safeJson(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) return resolve(UploadDocumentResponse.parse(data));
        const parsed = ApiErrorBody.safeParse(data);
        reject(
          parsed.success
            ? new ApiError(xhr.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.details)
            : new ApiError(xhr.status, 'HTTP_ERROR', `A API respondeu ${xhr.status}.`),
        );
      };
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
  },
};
