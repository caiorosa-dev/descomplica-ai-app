export interface TextRange {
  start: number;
  end: number;
  className: string;
}

/** Splits [0, textLength) at every range boundary, so overlapping highlights combine their classes. */
export function buildTextSegments(
  textLength: number,
  ranges: TextRange[],
): { start: number; end: number; classNames: string[] }[] {
  if (textLength <= 0) return [];
  const clamped = ranges
    .map((r) => ({ ...r, start: Math.max(0, r.start), end: Math.min(textLength, r.end) }))
    .filter((r) => r.end > r.start);
  const cuts = new Set([0, textLength]);
  for (const r of clamped) {
    cuts.add(r.start);
    cuts.add(r.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: { start: number; end: number; classNames: string[] }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i] as number;
    const end = points[i + 1] as number;
    segments.push({
      start,
      end,
      classNames: clamped.filter((r) => r.start <= start && r.end >= end).map((r) => r.className),
    });
  }
  return segments;
}

/** Heat-map tone for a source chunk's coverage score; the worst chunks (highlighted) get a red tone. */
export function coverageClass(score: number, highlighted: boolean): string {
  if (highlighted) return 'bg-destructive/30';
  if (score < 0.2) return 'bg-info/5';
  if (score < 0.4) return 'bg-info/15';
  if (score < 0.6) return 'bg-info/25';
  if (score < 0.8) return 'bg-info/35';
  return 'bg-info/50';
}
