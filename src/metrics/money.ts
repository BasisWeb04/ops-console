/** Converts a dollar amount to whole cents once, at the edge; all arithmetic after this is integer. */
export function toCents(usd: number): number {
  if (!Number.isFinite(usd)) throw new RangeError(`Not a finite amount: ${usd}`);
  return Math.round(usd * 100);
}

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) {
    if (!Number.isInteger(v)) throw new RangeError(`Cents must be an integer, got ${v}`);
    total += v;
  }
  return total;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars}.${rest}`;
}
