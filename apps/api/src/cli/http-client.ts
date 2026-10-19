import {
  ApiErrorBody,
  CrossSimilarityDto,
  DocumentDto,
  type InjectedFault,
  PresetDto,
  RunDto,
  RunResultDto,
  type Summary,
} from '@app/shared';
import { z } from 'zod';

/** Typed HTTP client for the evaluation CLIs; they go through the same API as the UI (spec §13.2). */
export function createApiClient(baseUrl: string) {
  async function request<T>(method: string, path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = ApiErrorBody.safeParse(data);
      throw new Error(
        err.success ? `${err.data.error.code}: ${err.data.error.message}` : `HTTP ${res.status} on ${method} ${path}`,
      );
    }
    return schema.parse(data);
  }
  return {
    listDocuments: () => request('GET', '/documents', z.array(DocumentDto)),
    listPresets: () => request('GET', '/presets', z.array(PresetDto)),
    listRuns: (filter: { label?: string; documentId?: string }) =>
      request(
        'GET',
        `/runs?${new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][])}`,
        z.array(RunDto),
      ),
    createRun: (body: { documentId: string; presetId: string; label?: string }) =>
      request('POST', '/runs', RunDto, body),
    rerun: (
      runId: string,
      body: { fromStage: 'similarity'; summaryOverride: Summary; label: string; injectedFaults: InjectedFault[] },
    ) => request('POST', `/runs/${runId}/rerun`, RunDto, body),
    getRun: (runId: string) => request('GET', `/runs/${runId}`, RunDto),
    getResult: (runId: string) => request('GET', `/runs/${runId}/result`, RunResultDto),
    crossSimilarity: (runIds: string[]) =>
      request('POST', '/analysis/cross-similarity', CrossSimilarityDto, { runIds }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Polls a run every 3 s until it reaches a terminal status (acceptable for a CLI). */
export async function waitForRun(client: ApiClient, runId: string, intervalMs = 3000): Promise<RunDto> {
  for (;;) {
    const run = await client.getRun(runId);
    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(run.status)) return run;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
