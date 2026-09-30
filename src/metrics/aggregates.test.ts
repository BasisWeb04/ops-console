import { describe, expect, it } from "vitest";
import { makeRun } from "../testing/makeRun";
import { DAY_MS, HOUR_MS } from "../sim/time";
import { groupFailures } from "./failures";
import { dailyCosts, totalsByJob } from "./costs";

describe("groupFailures", () => {
  const runs = [
    makeRun({ id: "a", job: "lead-enrich", startedAt: 1 * HOUR_MS, status: "failed", errorSignature: "x.429", logExcerpt: "log a" }),
    makeRun({ id: "b", job: "lead-enrich", startedAt: 2 * HOUR_MS, status: "retried-success", attempt: 2, errorSignature: "x.429", logExcerpt: "log b" }),
    makeRun({ id: "c", job: "invoice-sync", startedAt: 3 * HOUR_MS, status: "failed", errorSignature: "x.429", logExcerpt: "log c" }),
    makeRun({ id: "d", job: "crm-dedupe", startedAt: 4 * HOUR_MS, status: "failed", errorSignature: "y.lock", logExcerpt: "log d" }),
    makeRun({ id: "e", job: "crm-dedupe", startedAt: 5 * HOUR_MS, status: "success" }),
  ];

  it("groups by signature with failed and recovered counted separately", () => {
    const [top, second] = groupFailures(runs);
    expect(top).toMatchObject({ signature: "x.429", failed: 2, recovered: 1, firstSeen: HOUR_MS, lastSeen: 3 * HOUR_MS });
    expect(top!.jobs).toEqual(["lead-enrich", "invoice-sync"]);
    expect(top!.sampleLog).toBe("log c");
    expect(second).toMatchObject({ signature: "y.lock", failed: 1, recovered: 0 });
  });

  it("returns an empty list when nothing errored", () => {
    expect(groupFailures([makeRun({ startedAt: 0 })])).toEqual([]);
  });
});

describe("dailyCosts", () => {
  it("buckets integer cents by day and job, and omits days not yet reached", () => {
    const runs = [
      makeRun({ job: "lead-enrich", startedAt: HOUR_MS, costCents: 5 }),
      makeRun({ job: "lead-enrich", startedAt: 2 * HOUR_MS, costCents: 7 }),
      makeRun({ job: "review-request-sms", startedAt: DAY_MS + HOUR_MS, costCents: 30 }),
    ];
    const days = dailyCosts(runs, 0, 14, DAY_MS + 2 * HOUR_MS);
    expect(days).toHaveLength(2);
    expect(days[0]!.totalCents).toBe(12);
    expect(days[1]!.byJob.get("review-request-sms")).toBe(30);
    expect(totalsByJob(days).get("lead-enrich")).toBe(12);
  });
});
