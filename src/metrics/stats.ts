import type { JobId, Run } from "../sim/types";
import { DAY_MS } from "../sim/time";
import { sumCents } from "./money";
import { p95 } from "./percentile";

export function endedAt(run: Run): number {
  return run.startedAt + run.durationMs;
}

/** A run is visible at `now` only once it has finished; before that its status is unknown. */
export function finishedBy(runs: readonly Run[], now: number): Run[] {
  return runs.filter((r) => endedAt(r) <= now);
}

/** Finished runs that started in the half-open window (now - windowMs, now]. */
export function runsInWindow(runs: readonly Run[], now: number, windowMs: number): Run[] {
  const from = now - windowMs;
  return runs.filter((r) => r.startedAt > from && r.startedAt <= now && endedAt(r) <= now);
}

export interface RunStats {
  total: number;
  success: number;
  retriedSuccess: number;
  failed: number;
  skipped: number;
  /** Runs that did work: success + retried-success + failed. Skipped runs are excluded. */
  attempted: number;
  /** null means no data, which is different from 0 percent. */
  successRate: number | null;
  failureRate: number | null;
  p95DurationMs: number | null;
  costCents: number;
}

export function computeStats(runs: readonly Run[]): RunStats {
  let success = 0;
  let retriedSuccess = 0;
  let failed = 0;
  let skipped = 0;
  const durations: number[] = [];
  for (const r of runs) {
    if (r.status === "success") success++;
    else if (r.status === "retried-success") retriedSuccess++;
    else if (r.status === "failed") failed++;
    else skipped++;
    if (r.status !== "skipped") durations.push(r.durationMs);
  }
  const attempted = success + retriedSuccess + failed;
  return {
    total: runs.length,
    success,
    retriedSuccess,
    failed,
    skipped,
    attempted,
    successRate: attempted === 0 ? null : (success + retriedSuccess) / attempted,
    failureRate: attempted === 0 ? null : failed / attempted,
    p95DurationMs: p95(durations),
    costCents: sumCents(runs.map((r) => r.costCents)),
  };
}

export function runsForJob(runs: readonly Run[], job: JobId): Run[] {
  return runs.filter((r) => r.job === job);
}

/** Latest start among runs finished by `now`, or null if the job has not run yet. */
export function lastRunAt(runs: readonly Run[], job: JobId, now: number): number | null {
  let last: number | null = null;
  for (const r of runs) {
    if (r.job === job && endedAt(r) <= now && (last === null || r.startedAt > last)) last = r.startedAt;
  }
  return last;
}

export interface DayBucket {
  day: number;
  startMs: number;
  stats: RunStats;
}

/** One bucket per calendar day from startMs; days with no runs keep null rates. */
export function dailyBuckets(runs: readonly Run[], startMs: number, days: number, now: number): DayBucket[] {
  const groups: Run[][] = Array.from({ length: days }, () => []);
  for (const r of runs) {
    if (endedAt(r) > now) continue;
    const idx = Math.floor((r.startedAt - startMs) / DAY_MS);
    groups[idx]?.push(r);
  }
  return groups.map((g, i) => ({ day: i + 1, startMs: startMs + i * DAY_MS, stats: computeStats(g) }));
}
