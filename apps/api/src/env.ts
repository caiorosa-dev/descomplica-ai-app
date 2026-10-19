import { z } from 'zod';

const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().optional(),
  OPENAI_API_KEY: optionalSecret,
  ANTHROPIC_API_KEY: optionalSecret,
  UPLOAD_DIR: z.string().default('/data/uploads'),
  CORPUS_DIR: z.string().default('./corpus'),
  RUN_CONCURRENCY: z.coerce.number().int().positive().default(2),
  LLM_CONCURRENCY: z.coerce.number().int().positive().default(4),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.output<typeof EnvSchema>;

/** Validates the environment (spec §15 plus CORPUS_DIR); API keys are optional. */
export function loadEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): Env {
  return EnvSchema.parse(source);
}
