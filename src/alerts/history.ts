import type { JobId } from "../sim/types";
import { evaluateRules, type EvalContext, type Evaluation } from "./evaluate";
import type { AlertRule } from "./rules";
import type { RunIndex } from "./runIndex";

export interface AlertEpisode {
  ruleId: string;
  kind: AlertRule["kind"];
  job: JobId | null;
  startMs: number;
  /** First evaluation step at which the alert was no longer firing; null if still firing at the end. */
  endMs: number | null;
  /** Largest observed value while firing. */
  peakObserved: number;
  /** Summary at the moment the alert first fired, so the numbers that fired it are kept. */
  firstSummary: string;
}

function keyOf(e: Evaluation): string {
  return `${e.ruleId}|${e.job ?? "-"}`;
}

/**
 * Replays evaluation on a fixed step and merges consecutive firing steps into episodes.
 * Resolution is bounded by the step: an alert shorter than one step can be missed.
 */
export function computeAlertHistory(
  index: RunIndex,
  rules: readonly AlertRule[],
  fromMs: number,
  toMs: number,
  stepMs: number,
  ctx: EvalContext,
): AlertEpisode[] {
  if (stepMs <= 0) throw new RangeError("stepMs must be positive");
  const open = new Map<string, AlertEpisode>();
  const done: AlertEpisode[] = [];
  for (let t = fromMs + stepMs; t <= toMs; t += stepMs) {
    const firingNow = new Set<string>();
    for (const e of evaluateRules(index, rules, t, ctx)) {
      if (e.state !== "firing" || e.observed === null) continue;
      const key = keyOf(e);
      firingNow.add(key);
      const ep = open.get(key);
      if (ep) ep.peakObserved = Math.max(ep.peakObserved, e.observed);
      else open.set(key, { ruleId: e.ruleId, kind: e.kind, job: e.job, startMs: t, endMs: null, peakObserved: e.observed, firstSummary: e.summary });
    }
    for (const [key, ep] of open) {
      if (!firingNow.has(key)) {
        ep.endMs = t;
        done.push(ep);
        open.delete(key);
      }
    }
  }
  done.push(...open.values());
  return done.sort((a, b) => a.startMs - b.startMs || a.ruleId.localeCompare(b.ruleId));
}

/** Episodes as they looked at `now`: later episodes hidden, and ones that end after `now` shown as ongoing. */
export function episodesUpTo(episodes: readonly AlertEpisode[], now: number): AlertEpisode[] {
  return episodes
    .filter((ep) => ep.startMs <= now)
    .map((ep) => (ep.endMs !== null && ep.endMs > now ? { ...ep, endMs: null } : ep));
}
