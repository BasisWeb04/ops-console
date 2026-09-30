import type { JobId, Run } from "../sim/types";

export interface FailureGroup {
  signature: string;
  /** Runs that ended failed with this error. */
  failed: number;
  /** Runs that hit this error but succeeded on a later attempt. */
  recovered: number;
  firstSeen: number;
  lastSeen: number;
  jobs: JobId[];
  sampleLog: string | null;
  sampleRunId: string;
}

/** Groups errored runs by signature, most final failures first. */
export function groupFailures(runs: readonly Run[]): FailureGroup[] {
  const groups = new Map<string, FailureGroup>();
  for (const r of runs) {
    if (r.errorSignature === null || (r.status !== "failed" && r.status !== "retried-success")) continue;
    let g = groups.get(r.errorSignature);
    if (!g) {
      g = { signature: r.errorSignature, failed: 0, recovered: 0, firstSeen: r.startedAt, lastSeen: r.startedAt, jobs: [], sampleLog: null, sampleRunId: r.id };
      groups.set(r.errorSignature, g);
    }
    if (r.status === "failed") g.failed++;
    else g.recovered++;
    g.firstSeen = Math.min(g.firstSeen, r.startedAt);
    if (r.startedAt >= g.lastSeen) {
      g.lastSeen = r.startedAt;
      // Keep the latest excerpt, preferring a final failure over a recovered one.
      if (r.status === "failed" || g.sampleLog === null) {
        g.sampleLog = r.logExcerpt;
        g.sampleRunId = r.id;
      }
    }
    if (!g.jobs.includes(r.job)) g.jobs.push(r.job);
  }
  return [...groups.values()].sort((a, b) => b.failed - a.failed || b.recovered - a.recovered || a.signature.localeCompare(b.signature));
}
