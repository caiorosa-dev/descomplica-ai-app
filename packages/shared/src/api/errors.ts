import { z } from 'zod';

/** Every HTTP error response: `{ error: { code, message, details? } }` (message in pt-BR). */
export const ApiErrorBody = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const ApiIssue = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
  code: z.string().optional(),
});
export type ApiIssue = z.infer<typeof ApiIssue>;
