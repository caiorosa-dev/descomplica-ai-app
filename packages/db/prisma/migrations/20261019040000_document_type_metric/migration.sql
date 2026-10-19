-- The documents list reads the detected type from stage metrics instead of the full stage output.
-- Backfill it for information extraction runs recorded before the metric existed.
UPDATE "stage_runs"
SET "metrics" = jsonb_set(COALESCE("metrics", '{}'::jsonb), '{documentType}', "output" -> 'classification' -> 'documentType')
WHERE "stage" = 'information_extraction'
  AND "output" -> 'classification' -> 'documentType' IS NOT NULL
  AND ("metrics" IS NULL OR NOT ("metrics" ? 'documentType'));
