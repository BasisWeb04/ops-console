import { describe, expect, it } from "vitest";
import { p95, percentileNearestRank } from "./percentile";

describe("nearest-rank percentile", () => {
  it("returns null for an empty array instead of 0", () => {
    expect(p95([])).toBeNull();
  });

  it("returns the only value for a single-element array", () => {
    expect(p95([42])).toBe(42);
  });

  it("takes rank ceil(0.95 * 10) = 10 for ten values", () => {
    expect(p95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(10);
  });

  it("takes rank ceil(0.95 * 20) = 19 for twenty values", () => {
    expect(p95(Array.from({ length: 20 }, (_, i) => i + 1))).toBe(19);
  });

  it("takes the 95th value of 1..100", () => {
    expect(p95(Array.from({ length: 100 }, (_, i) => i + 1))).toBe(95);
  });

  it("sorts unsorted input without mutating it", () => {
    const input = [30, 10, 20];
    expect(p95(input)).toBe(30);
    expect(input).toEqual([30, 10, 20]);
  });

  it("always returns an observed value, never an interpolation", () => {
    expect(percentileNearestRank([1, 100], 50)).toBe(1);
    expect(percentileNearestRank([5, 5, 5, 9], 75)).toBe(5);
  });

  it("rejects percentiles outside (0, 100]", () => {
    expect(() => percentileNearestRank([1], 0)).toThrow(RangeError);
    expect(() => percentileNearestRank([1], 101)).toThrow(RangeError);
  });
});
