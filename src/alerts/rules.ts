import type { JobId } from "../sim/types";

export type JobScope = JobId | "all";

export interface FailureRateRule {
  id: string;
  kind: "failure-rate";
  enabled: boolean;
  job: JobScope;
  /** Fires when the failure rate is strictly above this percentage. */
  thresholdPct: number;
  windowMinutes: number;
  /** Fewer attempted runs than this reads as no data, so one failure out of two runs cannot page anyone. */
  minRuns: number;
}

export interface SpendRule {
  id: string;
  kind: "spend";
  enabled: boolean;
  /** Fires when spend in the current UTC day is strictly above this budget. */
  dailyBudgetCents: number;
}

export interface StaleRule {
  id: string;
  kind: "stale";
  enabled: boolean;
  job: JobScope;
  /** Fires when no run has started for more than multiplier times the job's expected interval. */
  multiplier: number;
}

export interface P95Rule {
  id: string;
  kind: "p95";
  enabled: boolean;
  job: JobScope;
  thresholdMs: number;
  windowMinutes: number;
}

export type AlertRule = FailureRateRule | SpendRule | StaleRule | P95Rule;
export type RuleKind = AlertRule["kind"];

export const DEFAULT_RULES: readonly AlertRule[] = [
  { id: "failure-rate-all", kind: "failure-rate", enabled: true, job: "all", thresholdPct: 30, windowMinutes: 360, minRuns: 5 },
  { id: "stale-all", kind: "stale", enabled: true, job: "all", multiplier: 1.5 },
  { id: "spend-daily", kind: "spend", enabled: true, dailyBudgetCents: 1200 },
  { id: "p95-lead-enrich", kind: "p95", enabled: true, job: "lead-enrich", thresholdMs: 20_000, windowMinutes: 180 },
];

export const RULE_KIND_LABELS: Record<RuleKind, string> = {
  "failure-rate": "Failure rate",
  spend: "Daily spend",
  stale: "Stale job",
  p95: "p95 duration",
};

export function newRule(kind: RuleKind, id: string): AlertRule {
  switch (kind) {
    case "failure-rate":
      return { id, kind, enabled: true, job: "all", thresholdPct: 20, windowMinutes: 120, minRuns: 5 };
    case "spend":
      return { id, kind, enabled: true, dailyBudgetCents: 2000 };
    case "stale":
      return { id, kind, enabled: true, job: "all", multiplier: 2 };
    case "p95":
      return { id, kind, enabled: true, job: "invoice-sync", thresholdMs: 30_000, windowMinutes: 360 };
  }
}
