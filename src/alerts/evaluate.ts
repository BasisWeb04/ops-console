import { JOBS, getJob } from "../sim/jobs";
import { MINUTE_MS, startOfUtcDay } from "../sim/time";
import type { JobId } from "../sim/types";
import { formatCents } from "../metrics/money";
import { computeStats } from "../metrics/stats";
import { formatDuration, formatHours, formatPct, formatWindow } from "../format";
import type { AlertRule, FailureRateRule, JobScope, P95Rule, SpendRule, StaleRule } from "./rules";
import { lastFinishedStart, sliceFrom, sliceWindow, type RunIndex } from "./runIndex";

export type EvalState = "firing" | "ok" | "no-data" | "not-applicable";

export interface Evaluation {
  ruleId: string;
  kind: AlertRule["kind"];
  job: JobId | null;
  state: EvalState;
  /** The number compared against the threshold; null when there was nothing to measure. */
  observed: number | null;
  threshold: number;
  summary: string;
}

export interface EvalContext {
  /** Start of observation. A job never seen is measured from here, so a job that never runs still goes stale. */
  observedFromMs: number;
}

function scopedJobs(scope: JobScope): JobId[] {
  return scope === "all" ? JOBS.map((j) => j.id) : [scope];
}

function jobRuns(index: RunIndex, job: JobId) {
  return index.byJob.get(job) ?? [];
}

export function evaluateFailureRate(index: RunIndex, rule: FailureRateRule, now: number): Evaluation[] {
  const windowMs = rule.windowMinutes * MINUTE_MS;
  const win = formatWindow(rule.windowMinutes);
  return scopedJobs(rule.job).map((job) => {
    const stats = computeStats(sliceWindow(jobRuns(index, job), now, windowMs));
    const base = { ruleId: rule.id, kind: rule.kind, job, threshold: rule.thresholdPct };
    if (stats.failureRate === null || stats.attempted < rule.minRuns) {
      return {
        ...base,
        state: "no-data" as const,
        observed: null,
        summary: `${job}: no data (${stats.attempted} attempted runs in last ${win}, need ${rule.minRuns})`,
      };
    }
    const pct = stats.failureRate * 100;
    const firing = pct > rule.thresholdPct;
    return {
      ...base,
      state: firing ? ("firing" as const) : ("ok" as const),
      observed: pct,
      summary: `${job}: ${formatPct(stats.failureRate)} failed (${stats.failed} of ${stats.attempted} attempted runs) in last ${win}; fires above ${rule.thresholdPct}%`,
    };
  });
}

export function evaluateSpend(index: RunIndex, rule: SpendRule, now: number): Evaluation[] {
  const dayStartMs = startOfUtcDay(now);
  // Spending nothing is a real $0.00, unlike a rate, so an empty day is "ok", not "no data".
  const spent = computeStats(sliceFrom(index.all, dayStartMs, now)).costCents;
  const firing = spent > rule.dailyBudgetCents;
  return [
    {
      ruleId: rule.id,
      kind: rule.kind,
      job: null,
      state: firing ? "firing" : "ok",
      observed: spent,
      threshold: rule.dailyBudgetCents,
      summary: `Spend today ${formatCents(spent)} vs daily budget ${formatCents(rule.dailyBudgetCents)}`,
    },
  ];
}

export function evaluateStale(index: RunIndex, rule: StaleRule, now: number, ctx: EvalContext): Evaluation[] {
  return scopedJobs(rule.job).map((job) => {
    const interval = getJob(job).expectedIntervalMs;
    const base = { ruleId: rule.id, kind: rule.kind, job };
    if (interval === null) {
      return {
        ...base,
        state: "not-applicable" as const,
        observed: null,
        threshold: 0,
        summary: `${job}: event-driven, no expected interval`,
      };
    }
    const limit = rule.multiplier * interval;
    const last = lastFinishedStart(jobRuns(index, job), now);
    const reference = last ?? ctx.observedFromMs;
    const gap = now - reference;
    const firing = gap > limit;
    const what = last === null ? "no run since observation start" : "last run";
    return {
      ...base,
      state: firing ? ("firing" as const) : ("ok" as const),
      observed: gap,
      threshold: limit,
      summary: `${job}: ${what} ${formatHours(gap)} ago; expected every ${formatHours(interval)}, stale after ${formatHours(limit)}`,
    };
  });
}

export function evaluateP95(index: RunIndex, rule: P95Rule, now: number): Evaluation[] {
  const win = formatWindow(rule.windowMinutes);
  return scopedJobs(rule.job).map((job) => {
    const stats = computeStats(sliceWindow(jobRuns(index, job), now, rule.windowMinutes * MINUTE_MS));
    const base = { ruleId: rule.id, kind: rule.kind, job, threshold: rule.thresholdMs };
    if (stats.p95DurationMs === null) {
      return { ...base, state: "no-data" as const, observed: null, summary: `${job}: no data (no attempted runs in last ${win})` };
    }
    const firing = stats.p95DurationMs > rule.thresholdMs;
    return {
      ...base,
      state: firing ? ("firing" as const) : ("ok" as const),
      observed: stats.p95DurationMs,
      summary: `${job}: p95 ${formatDuration(stats.p95DurationMs)} over ${stats.attempted} runs in last ${win}; fires above ${formatDuration(rule.thresholdMs)}`,
    };
  });
}

export function evaluateRule(index: RunIndex, rule: AlertRule, now: number, ctx: EvalContext): Evaluation[] {
  if (!rule.enabled) return [];
  switch (rule.kind) {
    case "failure-rate":
      return evaluateFailureRate(index, rule, now);
    case "spend":
      return evaluateSpend(index, rule, now);
    case "stale":
      return evaluateStale(index, rule, now, ctx);
    case "p95":
      return evaluateP95(index, rule, now);
  }
}

export function evaluateRules(index: RunIndex, rules: readonly AlertRule[], now: number, ctx: EvalContext): Evaluation[] {
  return rules.flatMap((rule) => evaluateRule(index, rule, now, ctx));
}
