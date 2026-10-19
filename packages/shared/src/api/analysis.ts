import { z } from 'zod';

export const CrossSimilarityBody = z.object({ runIds: z.array(z.string().uuid()).min(2).max(50) });
export type CrossSimilarityBody = z.infer<typeof CrossSimilarityBody>;

/** `matrix[i][j]` = alignmentF1 of run i's summary against run j's document (spec §13.2). */
export const CrossSimilarityDto = z.object({
  runIds: z.array(z.string()),
  documentIds: z.array(z.string()),
  matrix: z.array(z.array(z.number())),
});
export type CrossSimilarityDto = z.infer<typeof CrossSimilarityDto>;
