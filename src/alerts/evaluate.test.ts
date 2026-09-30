import { describe, expect, it } from "vitest";
import { makeRun } from "../testing/makeRun";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../sim/time";
import type { Run } from "../sim/types";
import { evaluateFailureRate, evaluateP95, evaluateRules, evaluateSpend, evaluateStale } from "./evaluate";
import { buildIndex, sliceWindow } from "./runIndex";
import type { FailureRateRule, P95Rule, SpendRule, StaleRule } from "./rules";
import { runsInWindow } from "../metrics/stats";

const NOW = 10 * DAY_MS;
const ctx = { observedFromMs: 0 };

const failRule: FailureRateRule = {
  id: "fr",
  kind: "failure-rate",
  enabled: true,
  job: "lead-enrich",
  thresholdPct: 25,
  windowMinutes: 60,
  minRuns: 4,
};

function leadRuns(statuses: Run["status"][]): Run[] {
  return statuses.map((status, i) =>
    makeRun({ job: "lead-enrich", startedAt: NOW - 50 * MINUTE_MS + i * MINUTE_MS, durationMs: 1000, status }),
  );
}

describe("failure-rate rule", () => {
  it("fires above the threshold and reports the numbers that fired it", () => {
    const [e] = evaluateFailureRate(buildIndex(leadRuns(["failed", "failed", "success", "success"])), failRule, NOW);
    expect(e!.state).toBe("firing");
    expect(e!.observed).toBe(50);
    expect(e!.summary).toContain("2 of 4");
  });

  it("does not fire when exactly at the threshold", () => {
    const [e] = evaluateFailureRate(buildIndex(leadRuns(["failed", "success", "success", "success"])), failRule, NOW);
    expect(e!.observed).toBe(25);
    expect(e!.state).toBe("ok");
  });

  it("treats an empty window as no data, never 0 percent failure", () => {
    const [e] = evaluateFailureRate(buildIndex([]), failRule, NOW);
    expect(e!.state).toBe("no-data");
    expect(e!.observed).toBeNull();
  });

  it("treats a window with only skipped runs as no data", () => {
    const [e] = evaluateFailureRate(buildIndex(leadRuns(["skipped", "skipped", "skipped", "skipped", "skipped"])), failRule, NOW);
    expect(e!.state).toBe("no-data");
  });

  it("treats fewer attempted runs than minRuns as no data, even when all failed", () => {
    const [e] = evaluateFailureRate(buildIndex(leadRuns(["failed", "failed", "failed"])), failRule, NOW);
    expect(e!.state).toBe("no-data");
  });

  it("counts retried-success as success, not failure", () => {
    const statuses: Run["status"][] = ["retried-success", "retried-success", "retried-success", "failed"];
    const [e] = evaluateFailureRate(buildIndex(leadRuns(statuses)), failRule, NOW);
    expect(e!.observed).toBe(25);
    expect(e!.state).toBe("ok");
  });

  it("ignores runs outside the window and runs of other jobs", () => {
    const runs = [
      ...leadRuns(["success", "success", "success", "success"]),
      makeRun({ job: "lead-enrich", startedAt: NOW - 2 * HOUR_MS, status: "failed" }),
      makeRun({ job: "invoice-sync", startedAt: NOW - MINUTE_MS, status: "failed", durationMs: 10 }),
    ];
    const [e] = evaluateFailureRate(buildIndex(runs), failRule, NOW);
    expect(e!.observed).toBe(0);
    expect(e!.state).toBe("ok");
  });

  it("evaluates every job when scoped to all", () => {
    expect(evaluateFailureRate(buildIndex([]), { ...failRule, job: "all" }, NOW)).toHaveLength(6);
  });
});

describe("stale rule", () => {
  const rule: StaleRule = { id: "st", kind: "stale", enabled: true, job: "nightly-backup", multiplier: 1.5 };

  it("fires when the gap exceeds multiplier times the expected interval", () => {
    const runs = [makeRun({ job: "nightly-backup", startedAt: NOW - 37 * HOUR_MS, durationMs: 1000 })];
    const [e] = evaluateStale(buildIndex(runs), rule, NOW, ctx);
    expect(e!.state).toBe("firing");
    expect(e!.observed).toBe(37 * HOUR_MS);
    expect(e!.threshold).toBe(36 * HOUR_MS);
  });

  it("does not fire exactly at the limit", () => {
    const runs = [makeRun({ job: "nightly-backup", startedAt: NOW - 36 * HOUR_MS, durationMs: 1000 })];
    expect(evaluateStale(buildIndex(runs), rule, NOW, ctx)[0]!.state).toBe("ok");
  });

  it("fires for a job that never ran, measuring from the start of observation", () => {
    const [e] = evaluateStale(buildIndex([]), rule, 2 * DAY_MS, { observedFromMs: 0 });
    expect(e!.state).toBe("firing");
    expect(e!.summary).toContain("no run since observation start");
  });

  it("counts a failed run as proof the scheduler is alive", () => {
    const runs = [makeRun({ job: "nightly-backup", startedAt: NOW - HOUR_MS, status: "failed" })];
    expect(evaluateStale(buildIndex(runs), rule, NOW, ctx)[0]!.state).toBe("ok");
  });

  it("marks event-driven jobs as not applicable instead of stale", () => {
    const [e] = evaluateStale(buildIndex([]), { ...rule, job: "review-request-sms" }, NOW, ctx);
    expect(e!.state).toBe("not-applicable");
  });
});

describe("spend rule", () => {
  const rule: SpendRule = { id: "sp", kind: "spend", enabled: true, dailyBudgetCents: 1000 };

  it("fires when spend in the current UTC day is above budget, ignoring earlier days", () => {
    const runs = [
      makeRun({ startedAt: NOW - HOUR_MS, costCents: 5000 }),
      makeRun({ startedAt: NOW + HOUR_MS, costCents: 600 }),
      makeRun({ startedAt: NOW + 2 * HOUR_MS, costCents: 401 }),
    ];
    const [e] = evaluateSpend(buildIndex(runs), rule, NOW + 3 * HOUR_MS);
    expect(e!.observed).toBe(1001);
    expect(e!.state).toBe("firing");
  });

  it("does not fire at exactly the budget", () => {
    const runs = [makeRun({ startedAt: NOW + HOUR_MS, costCents: 1000 })];
    expect(evaluateSpend(buildIndex(runs), rule, NOW + 2 * HOUR_MS)[0]!.state).toBe("ok");
  });

  it("reports a real $0.00 for a day with no runs", () => {
    const [e] = evaluateSpend(buildIndex([]), rule, NOW);
    expect(e!.observed).toBe(0);
    expect(e!.state).toBe("ok");
  });
});

describe("p95 rule", () => {
  const rule: P95Rule = { id: "p", kind: "p95", enabled: true, job: "lead-enrich", thresholdMs: 20_000, windowMinutes: 60 };

  function runsWithSlow(slowCount: number, slowMs: number): Run[] {
    return Array.from({ length: 20 }, (_, i) =>
      makeRun({
        job: "lead-enrich",
        startedAt: NOW - 55 * MINUTE_MS + i * MINUTE_MS,
        durationMs: i >= 20 - slowCount ? slowMs : 5_000,
      }),
    );
  }

  it("fires when nearest-rank p95 is above the threshold", () => {
    const [e] = evaluateP95(buildIndex(runsWithSlow(2, 30_000)), rule, NOW);
    expect(e!.observed).toBe(30_000);
    expect(e!.state).toBe("firing");
  });

  it("does not fire when only the single slowest of 20 runs is slow", () => {
    expect(evaluateP95(buildIndex(runsWithSlow(1, 60_000)), rule, NOW)[0]!.state).toBe("ok");
  });

  it("reports no data for an empty window", () => {
    expect(evaluateP95(buildIndex([]), rule, NOW)[0]!.state).toBe("no-data");
  });
});

describe("rule set", () => {
  it("skips disabled rules", () => {
    expect(evaluateRules(buildIndex([]), [{ ...failRule, enabled: false }], NOW, ctx)).toEqual([]);
  });

  it("binary-search windows match the plain filter", () => {
    const runs = Array.from({ length: 200 }, (_, i) => makeRun({ startedAt: i * 7 * MINUTE_MS, durationMs: (i % 5) * MINUTE_MS }));
    const index = buildIndex(runs);
    for (const now of [0, 3 * HOUR_MS, 10 * HOUR_MS + 1, 23 * HOUR_MS]) {
      expect(sliceWindow(index.all, now, 2 * HOUR_MS)).toEqual(runsInWindow(runs, now, 2 * HOUR_MS));
    }
  });
});
