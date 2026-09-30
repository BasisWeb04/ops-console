import { describe, expect, it } from "vitest";
import { formatCents, sumCents, toCents } from "./money";

describe("money in integer cents", () => {
  it("rounds dollars to whole cents at the edge", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.999)).toBe(2000);
  });

  it("sums many small amounts exactly where float addition drifts", () => {
    const floatTotal = Array.from({ length: 1000 }, () => 0.1).reduce((a, b) => a + b, 0);
    expect(floatTotal).not.toBe(100);
    expect(sumCents(Array.from({ length: 1000 }, () => toCents(0.1)))).toBe(10000);
  });

  it("refuses non-integer cents so a float cannot sneak into a total", () => {
    expect(() => sumCents([1, 2.5])).toThrow(RangeError);
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
  });

  it("formats cents as dollars", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(-250)).toBe("-$2.50");
  });
});
