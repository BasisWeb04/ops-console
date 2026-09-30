export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

/** Monday 2026-09-14 00:00 UTC. A fixed start keeps every seed reproducible. */
export const DATA_START_MS = Date.UTC(2026, 8, 14);
export const DATA_DAYS = 14;
export const DATA_END_MS = DATA_START_MS + DATA_DAYS * DAY_MS;

export function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** 1-based day number within the dataset; day 1 is the first day. */
export function dayNumber(ms: number, startMs: number = DATA_START_MS): number {
  return Math.floor((ms - startMs) / DAY_MS) + 1;
}

export function dayStart(day: number, startMs: number = DATA_START_MS): number {
  return startMs + (day - 1) * DAY_MS;
}
