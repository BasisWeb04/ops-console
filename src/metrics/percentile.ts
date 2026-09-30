/**
 * Nearest-rank percentile: sort ascending, take the value at rank ceil(p/100 * n).
 * Always returns an observed value, never an interpolation. Empty input has no percentile.
 */
export function percentileNearestRank(values: readonly number[], p: number): number | null {
  if (!(p > 0 && p <= 100)) throw new RangeError(`Percentile must be in (0, 100], got ${p}`);
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[rank - 1] ?? null;
}

export function p95(values: readonly number[]): number | null {
  return percentileNearestRank(values, 95);
}
