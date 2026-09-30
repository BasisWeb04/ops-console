import type { JobId, Run } from "../sim/types";
import { endedAt } from "../metrics/stats";

/** Runs sorted by start time, overall and per job, so window lookups are binary searches. */
export interface RunIndex {
  all: Run[];
  byJob: Map<JobId, Run[]>;
}

export function buildIndex(runs: readonly Run[]): RunIndex {
  const all = [...runs].sort((a, b) => a.startedAt - b.startedAt);
  const byJob = new Map<JobId, Run[]>();
  for (const r of all) {
    const list = byJob.get(r.job);
    if (list) list.push(r);
    else byJob.set(r.job, [r]);
  }
  return { all, byJob };
}

/** First index whose startedAt satisfies `startedAt > bound` (strict) or `>= bound`. */
function firstAfter(sorted: readonly Run[], bound: number, strict: boolean): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const t = sorted[mid]!.startedAt;
    if (strict ? t > bound : t >= bound) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Finished runs whose start is in (fromExclusive, now]. Matches metrics/stats runsInWindow. */
export function sliceWindow(sorted: readonly Run[], now: number, windowMs: number): Run[] {
  const lo = firstAfter(sorted, now - windowMs, true);
  const hi = firstAfter(sorted, now, true);
  return sorted.slice(lo, hi).filter((r) => endedAt(r) <= now);
}

/** Finished runs whose start is in [fromInclusive, now]. */
export function sliceFrom(sorted: readonly Run[], fromInclusive: number, now: number): Run[] {
  const lo = firstAfter(sorted, fromInclusive, false);
  const hi = firstAfter(sorted, now, true);
  return sorted.slice(lo, hi).filter((r) => endedAt(r) <= now);
}

/** Start time of the latest run finished by `now`, or null if none. */
export function lastFinishedStart(sorted: readonly Run[], now: number): number | null {
  for (let i = firstAfter(sorted, now, true) - 1; i >= 0; i--) {
    const r = sorted[i]!;
    if (endedAt(r) <= now) return r.startedAt;
  }
  return null;
}
