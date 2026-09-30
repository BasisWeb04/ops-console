import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { DEFAULT_SEED, INCIDENTS, generateDataset, normalizeSeed, smsCostCents } from "./simulate";
import { JOB_IDS } from "./jobs";
import { DATA_END_MS, DATA_START_MS, dayNumber } from "./time";
import { sumCents } from "../metrics/money";

const data = generateDataset(DEFAULT_SEED);

describe("rng", () => {
  it("produces the same sequence for the same seed, in [0, 1)", () => {
    const a = createRng(7);
    const b = createRng(7);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe("simulator", () => {
  it("is deterministic: same seed, same data", () => {
    expect(generateDataset(DEFAULT_SEED)).toEqual(generateDataset(DEFAULT_SEED));
  });

  it("changes the data when the seed changes", () => {
    const other = generateDataset(DEFAULT_SEED + 1);
    expect(other.runs.map((r) => r.startedAt)).not.toEqual(data.runs.map((r) => r.startedAt));
  });

  it("covers all six jobs with unique ids, sorted by start, inside the 14-day window", () => {
    expect(new Set(data.runs.map((r) => r.job))).toEqual(new Set(JOB_IDS));
    expect(new Set(data.runs.map((r) => r.id)).size).toBe(data.runs.length);
    for (let i = 1; i < data.runs.length; i++) {
      expect(data.runs[i]!.startedAt).toBeGreaterThanOrEqual(data.runs[i - 1]!.startedAt);
    }
    expect(data.runs.every((r) => r.startedAt >= DATA_START_MS && r.startedAt < DATA_END_MS)).toBe(true);
  });

  it("stores cost as non-negative integer cents with costUsd derived from it", () => {
    for (const r of data.runs) {
      expect(Number.isInteger(r.costCents)).toBe(true);
      expect(r.costCents).toBeGreaterThanOrEqual(0);
      expect(r.costUsd).toBe(r.costCents / 100);
    }
  });

  it("gives every errored run a signature and a log excerpt, and clean runs neither", () => {
    for (const r of data.runs) {
      if (r.status === "failed" || r.status === "retried-success") {
        expect(r.errorSignature).toBeTruthy();
        expect(r.logExcerpt).toContain("ERROR");
      } else {
        expect(r.errorSignature).toBeNull();
        expect(r.logExcerpt).toBeNull();
      }
    }
  });

  it("keeps attempt counts consistent with status", () => {
    for (const r of data.runs) {
      if (r.status === "success" || r.status === "skipped") expect(r.attempt).toBe(1);
      else expect(r.attempt).toBeGreaterThanOrEqual(2);
    }
  });

  it("injects the silent backup stop: no nightly-backup records at all on days 11 and 12", () => {
    const backupDays = data.runs.filter((r) => r.job === "nightly-backup").map((r) => dayNumber(r.startedAt));
    for (const d of INCIDENTS.backupSilentStop.days) expect(backupDays).not.toContain(d);
    expect(backupDays).toContain(10);
    expect(backupDays).toContain(13);
  });

  it("injects the rate-limit storm: 429 failures for lead-enrich only on day 9", () => {
    const storm = data.runs.filter((r) => r.job === "lead-enrich" && r.errorSignature === "enrich-api.http-429-rate-limit");
    expect(storm.length).toBeGreaterThan(10);
    expect(storm.every((r) => dayNumber(r.startedAt) === INCIDENTS.rateLimitStorm.day)).toBe(true);
  });

  it("injects the SMS cost spike: day 5 SMS spend is over five times any other day", () => {
    const byDay = new Map<number, number[]>();
    for (const r of data.runs.filter((x) => x.job === "review-request-sms")) {
      const d = dayNumber(r.startedAt);
      byDay.set(d, [...(byDay.get(d) ?? []), r.costCents]);
    }
    const spike = sumCents(byDay.get(INCIDENTS.smsCostSpike.day) ?? []);
    for (const [d, cents] of byDay) {
      if (d !== INCIDENTS.smsCostSpike.day) expect(spike).toBeGreaterThan(5 * sumCents(cents));
    }
  });

  it("rounds SMS cost once per run to whole cents", () => {
    expect(smsCostCents(1)).toBe(2);
    expect(smsCostCents(10)).toBe(15);
    expect(Number.isInteger(smsCostCents(7))).toBe(true);
  });

  it("normalizes any seed input to an unsigned 32-bit integer", () => {
    expect(normalizeSeed(12.7)).toBe(12);
    expect(normalizeSeed(-5)).toBe(5);
    expect(normalizeSeed(Number.NaN)).toBe(DEFAULT_SEED);
  });
});
