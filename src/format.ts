import { HOUR_MS, MINUTE_MS } from "./sim/time";

export function formatPct(rate: number | null, digits = 1): string {
  return rate === null ? "no data" : `${(rate * 100).toFixed(digits)}%`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "no data";
  if (ms < 1000) return `${ms} ms`;
  if (ms < MINUTE_MS) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < HOUR_MS) return `${(ms / MINUTE_MS).toFixed(1)} min`;
  return `${(ms / HOUR_MS).toFixed(1)} h`;
}

export function formatHours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)} h`;
}

export function formatWindow(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
}

const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const DATE_ONLY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" });

/** All times display in UTC so the replay reads the same for every visitor. */
export function formatDateTime(ms: number): string {
  return `${DATE_TIME.format(ms)} UTC`;
}

export function formatDate(ms: number): string {
  return DATE_ONLY.format(ms);
}
