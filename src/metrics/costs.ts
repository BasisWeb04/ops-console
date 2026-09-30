import type { JobId, Run } from "../sim/types";
import { DAY_MS } from "../sim/time";
import { endedAt } from "./stats";

export interface DayCost {
  day: number;
  startMs: number;
  /** Integer cents per job for runs finished by `now`. */
  byJob: Map<JobId, number>;
  totalCents: number;
}

/** Daily spend per job in integer cents; only days that have started by `now` are returned. */
export function dailyCosts(runs: readonly Run[], startMs: number, days: number, now: number): DayCost[] {
  const out: DayCost[] = [];
  for (let i = 0; i < days; i++) {
    const dayStart = startMs + i * DAY_MS;
    if (dayStart >= now) break;
    out.push({ day: i + 1, startMs: dayStart, byJob: new Map(), totalCents: 0 });
  }
  for (const r of runs) {
    if (endedAt(r) > now) continue;
    const bucket = out[Math.floor((r.startedAt - startMs) / DAY_MS)];
    if (!bucket) continue;
    bucket.byJob.set(r.job, (bucket.byJob.get(r.job) ?? 0) + r.costCents);
    bucket.totalCents += r.costCents;
  }
  return out;
}

export function totalsByJob(days: readonly DayCost[]): Map<JobId, number> {
  const totals = new Map<JobId, number>();
  for (const d of days) for (const [job, cents] of d.byJob) totals.set(job, (totals.get(job) ?? 0) + cents);
  return totals;
}
