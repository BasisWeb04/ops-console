import { describe, expect, it } from "vitest";
import { DEFAULT_SEED, INCIDENTS, generateDataset } from "../sim/simulate";
import { DATA_END_MS, DATA_START_MS, MINUTE_MS, dayNumber, dayStart } from "../sim/time";
import { computeAlertHistory, episodesUpTo, type AlertEpisode } from "./history";
import { DEFAULT_RULES } from "./rules";
import { buildIndex } from "./runIndex";
import { evaluateRules } from "./evaluate";
import { makeRun } from "../testing/makeRun";
import type { FailureRateRule } from "./rules";

const STEP = 15 * MINUTE_MS;
const ctx = { observedFromMs: DATA_START_MS };

function historyFor(seed: number): AlertEpisode[] {
  const index = buildIndex(generateDataset(seed).runs);
  return computeAlertHistory(index, DEFAULT_RULES, DATA_START_MS, DATA_END_MS, STEP, ctx);
}

const defaultHistory = historyFor(DEFAULT_SEED);

function stormEpisodes(h: AlertEpisode[]) {
  return h.filter((e) => e.ruleId === "failure-rate-all" && e.job === "lead-enrich" && dayNumber(e.startMs) === INCIDENTS.rateLimitStorm.day);
}

function backupEpisodes(h: AlertEpisode[]) {
  return h.filter((e) => e.ruleId === "stale-all" && e.job === "nightly-backup");
}

function spendEpisodes(h: AlertEpisode[]) {
  return h.filter((e) => e.ruleId === "spend-daily");
}

describe("injected incidents are caught by the default rules (default seed)", () => {
  it("rate-limit storm on day 9 fires the lead-enrich failure-rate alert", () => {
    const eps = stormEpisodes(defaultHistory);
    expect(eps.length).toBeGreaterThanOrEqual(1);
    expect(eps[0]!.peakObserved).toBeGreaterThan(30);
  });

  it("silent nightly-backup stop fires the stale alert and it stays firing through day 12", () => {
    const eps = backupEpisodes(defaultHistory);
    expect(eps).toHaveLength(1);
    const ep = eps[0]!;
    expect(dayNumber(ep.startMs)).toBe(11);
    expect(ep.endMs).not.toBeNull();
    expect(ep.endMs!).toBeGreaterThan(dayStart(13));
    expect(ep.firstSummary).toContain("nightly-backup");
  });

  it("SMS cost spike on day 5 fires the daily spend alert", () => {
    const eps = spendEpisodes(defaultHistory);
    expect(eps.map((e) => dayNumber(e.startMs))).toEqual([INCIDENTS.smsCostSpike.day]);
  });

  it("the storm also pushes lead-enrich p95 duration over its threshold", () => {
    const eps = defaultHistory.filter((e) => e.ruleId === "p95-lead-enrich");
    expect(eps.length).toBeGreaterThanOrEqual(1);
    expect(eps.every((e) => dayNumber(e.startMs) === INCIDENTS.rateLimitStorm.day)).toBe(true);
  });

  it("no scheduled job other than the stopped backup goes stale", () => {
    const stale = defaultHistory.filter((e) => e.ruleId === "stale-all");
    expect(stale.map((e) => e.job)).toEqual(["nightly-backup"]);
  });
});

describe("incident detection does not depend on a lucky seed", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed}: all three incidents fire`, () => {
      const h = historyFor(seed);
      expect(stormEpisodes(h).length).toBeGreaterThanOrEqual(1);
      expect(backupEpisodes(h).length).toBeGreaterThanOrEqual(1);
      expect(spendEpisodes(h).some((e) => dayNumber(e.startMs) === INCIDENTS.smsCostSpike.day)).toBe(true);
    });
  }
});

describe("alert history", () => {
  const rule: FailureRateRule = {
    id: "fr",
    kind: "failure-rate",
    enabled: true,
    job: "invoice-sync",
    thresholdPct: 40,
    windowMinutes: 60,
    minRuns: 2,
  };

  it("merges consecutive firing steps into one episode with start, end and peak", () => {
    const runs = [
      makeRun({ startedAt: 10 * MINUTE_MS, status: "failed", durationMs: 1 }),
      makeRun({ startedAt: 20 * MINUTE_MS, status: "failed", durationMs: 1 }),
      makeRun({ startedAt: 90 * MINUTE_MS, status: "success", durationMs: 1 }),
      makeRun({ startedAt: 100 * MINUTE_MS, status: "success", durationMs: 1 }),
    ];
    const h = computeAlertHistory(buildIndex(runs), [rule], 0, 180 * MINUTE_MS, STEP, { observedFromMs: 0 });
    expect(h).toHaveLength(1);
    expect(h[0]!.startMs).toBe(30 * MINUTE_MS);
    expect(h[0]!.endMs).toBe(75 * MINUTE_MS);
    expect(h[0]!.peakObserved).toBe(100);
  });

  it("leaves endMs null for an alert still firing at the end of the replay", () => {
    const runs = [
      makeRun({ startedAt: 10 * MINUTE_MS, status: "failed", durationMs: 1 }),
      makeRun({ startedAt: 20 * MINUTE_MS, status: "failed", durationMs: 1 }),
    ];
    const h = computeAlertHistory(buildIndex(runs), [rule], 0, 45 * MINUTE_MS, STEP, { observedFromMs: 0 });
    expect(h[0]!.endMs).toBeNull();
  });

  it("clips history to the replay position: future episodes hidden, running ones ongoing", () => {
    const eps = [
      { ruleId: "a", kind: "spend" as const, job: null, startMs: 100, endMs: 200, peakObserved: 1, firstSummary: "" },
      { ruleId: "b", kind: "spend" as const, job: null, startMs: 150, endMs: 400, peakObserved: 1, firstSummary: "" },
      { ruleId: "c", kind: "spend" as const, job: null, startMs: 500, endMs: null, peakObserved: 1, firstSummary: "" },
    ];
    const clipped = episodesUpTo(eps, 300);
    expect(clipped.map((e) => [e.ruleId, e.endMs])).toEqual([
      ["a", 200],
      ["b", null],
    ]);
  });

  it("the default rules produce no firing alert at the replay start when nothing has run yet", () => {
    const index = buildIndex(generateDataset(DEFAULT_SEED).runs);
    const firing = evaluateRules(index, DEFAULT_RULES, DATA_START_MS + MINUTE_MS, ctx).filter((e) => e.state === "firing");
    expect(firing).toEqual([]);
  });
});
