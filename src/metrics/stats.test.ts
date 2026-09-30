import { describe, expect, it } from "vitest";
import { makeRun } from "../testing/makeRun";
import { DAY_MS, HOUR_MS } from "../sim/time";
import { computeStats, dailyBuckets, lastRunAt, runsInWindow } from "./stats";

describe("computeStats", () => {
  it("reports no data, not 0 percent, for an empty set", () => {
    const s = computeStats([]);
    expect(s.successRate).toBeNull();
    expect(s.failureRate).toBeNull();
    expect(s.p95DurationMs).toBeNull();
    expect(s.costCents).toBe(0);
  });

  it("reports no data when every run was skipped", () => {
    const s = computeStats([makeRun({ startedAt: 0, status: "skipped" }), makeRun({ startedAt: 1, status: "skipped" })]);
    expect(s.skipped).toBe(2);
    expect(s.attempted).toBe(0);
    expect(s.successRate).toBeNull();
  });

  it("counts retried-success as success for the rate but keeps it separate", () => {
    const s = computeStats([
      makeRun({ startedAt: 0, status: "success" }),
      makeRun({ startedAt: 1, status: "retried-success", attempt: 2 }),
      makeRun({ startedAt: 2, status: "failed" }),
      makeRun({ startedAt: 3, status: "failed" }),
    ]);
    expect(s.success).toBe(1);
    expect(s.retriedSuccess).toBe(1);
    expect(s.successRate).toBe(0.5);
    expect(s.failureRate).toBe(0.5);
  });

  it("excludes skipped runs from rate denominators and from p95", () => {
    const s = computeStats([
      makeRun({ startedAt: 0, status: "success", durationMs: 100 }),
      makeRun({ startedAt: 1, status: "failed", durationMs: 200 }),
      makeRun({ startedAt: 2, status: "skipped", durationMs: 99_999 }),
    ]);
    expect(s.attempted).toBe(2);
    expect(s.failureRate).toBe(0.5);
    expect(s.p95DurationMs).toBe(200);
  });

  it("sums cost in integer cents", () => {
    const runs = Array.from({ length: 10 }, (_, i) => makeRun({ startedAt: i, costCents: 7 }));
    expect(computeStats(runs).costCents).toBe(70);
  });
});

describe("windows", () => {
  it("uses a half-open window (now - W, now] and hides unfinished runs", () => {
    const now = 10 * HOUR_MS;
    const runs = [
      makeRun({ id: "edge-start", startedAt: now - HOUR_MS, durationMs: 10 }),
      makeRun({ id: "inside", startedAt: now - HOUR_MS + 1, durationMs: 10 }),
      makeRun({ id: "running", startedAt: now - 5, durationMs: 10 }),
    ];
    expect(runsInWindow(runs, now, HOUR_MS).map((r) => r.id)).toEqual(["inside"]);
  });

  it("finds the last finished run of a job, or null when there is none", () => {
    const runs = [
      makeRun({ job: "crm-dedupe", startedAt: 100, durationMs: 10 }),
      makeRun({ job: "crm-dedupe", startedAt: 500, durationMs: 1000 }),
    ];
    expect(lastRunAt(runs, "crm-dedupe", 600)).toBe(100);
    expect(lastRunAt(runs, "weekly-report", 600)).toBeNull();
  });

  it("keeps a day with no runs as a null-rate bucket rather than 0 percent", () => {
    const runs = [makeRun({ startedAt: 0, status: "failed" }), makeRun({ startedAt: 2 * DAY_MS, status: "success" })];
    const buckets = dailyBuckets(runs, 0, 3, 3 * DAY_MS);
    expect(buckets.map((b) => b.stats.successRate)).toEqual([0, null, 1]);
  });
});
