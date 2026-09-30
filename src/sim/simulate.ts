import { JOBS } from "./jobs";
import { createRng, pick, randInt, type Rng } from "./rng";
import { DATA_END_MS, DATA_START_MS, DAY_MS, HOUR_MS, MINUTE_MS, dayNumber, dayStart } from "./time";
import type { Dataset, JobDef, JobId, Run, RunStatus } from "./types";

export const DEFAULT_SEED = 20260930;

/** Injected incidents. Days are 1-based within the 14-day window; hours are UTC. */
export const INCIDENTS = {
  smsCostSpike: { job: "review-request-sms" as JobId, day: 5, fromHour: 10, toHour: 16 },
  rateLimitStorm: { job: "lead-enrich" as JobId, day: 9, fromHour: 9, toHour: 14 },
  backupSilentStop: { job: "nightly-backup" as JobId, days: [11, 12] },
} as const;

interface Outcome {
  status: RunStatus;
  attempt: number;
  durationMs: number;
  costCents: number;
  errorSignature: string | null;
  errorLine: string | null;
}

interface ErrorKind {
  signature: string;
  message: (rng: Rng) => string;
}

const ERRORS: Record<JobId, ErrorKind[]> = {
  "invoice-sync": [
    { signature: "billing-api.timeout", message: () => "POST /ledger/invoices timed out after 30000 ms" },
    {
      signature: "ledger.duplicate-invoice-number",
      message: (rng) => `Ledger rejected INV-${randInt(rng, 10400, 10999)}: invoice number already exists`,
    },
  ],
  "lead-enrich": [
    { signature: "enrich-api.http-503", message: () => "GET /v2/companies returned 503 Service Unavailable" },
  ],
  "nightly-backup": [
    {
      signature: "storage.checksum-mismatch",
      message: (rng) => `Upload part ${randInt(rng, 2, 39)}/40 checksum mismatch, aborting multipart upload`,
    },
  ],
  "review-request-sms": [
    {
      signature: "sms-gateway.invalid-number",
      message: (rng) => `Gateway rejected +1-555-01${randInt(rng, 10, 99)}: not a mobile number`,
    },
  ],
  "weekly-report": [{ signature: "warehouse.query-timeout", message: () => "Warehouse query exceeded 120 s limit" }],
  "crm-dedupe": [
    {
      signature: "crm-api.lock-conflict",
      message: (rng) => `Record C-${randInt(rng, 1000, 9999)} locked by another writer (HTTP 409)`,
    },
  ],
};

const RATE_LIMIT: ErrorKind = {
  signature: "enrich-api.http-429-rate-limit",
  message: () => "GET /v2/companies returned 429 Too Many Requests (retry-after: 60)",
};

interface Profile {
  pFail: number;
  pRetry: number;
  pSkip: number;
  baseMs: [number, number];
  backoffMs: [number, number];
  costCents: (rng: Rng) => number;
  failedCostCents: number;
}

/*
 * Retry backoff ranges are chosen so ordinary retries stay under the default
 * p95 alert threshold; only the incident pushes durations past it.
 */
const PROFILES: Record<JobId, Profile> = {
  "invoice-sync": {
    pFail: 0.02,
    pRetry: 0.04,
    pSkip: 0,
    baseMs: [4_000, 20_000],
    backoffMs: [5_000, 15_000],
    costCents: (rng) => randInt(rng, 1, 3),
    failedCostCents: 0,
  },
  "lead-enrich": {
    pFail: 0.012,
    pRetry: 0.04,
    pSkip: 0.08,
    baseMs: [2_000, 8_000],
    backoffMs: [4_000, 9_000],
    costCents: (rng) => randInt(rng, 3, 8),
    failedCostCents: 0,
  },
  "nightly-backup": {
    pFail: 0.04,
    pRetry: 0.05,
    pSkip: 0,
    baseMs: [14 * MINUTE_MS, 26 * MINUTE_MS],
    backoffMs: [2 * MINUTE_MS, 5 * MINUTE_MS],
    costCents: (rng) => randInt(rng, 30, 40),
    failedCostCents: 10,
  },
  "review-request-sms": {
    pFail: 0.02,
    pRetry: 0.03,
    pSkip: 0,
    baseMs: [1_000, 5_000],
    backoffMs: [2_000, 6_000],
    costCents: () => 0,
    failedCostCents: 0,
  },
  "weekly-report": {
    pFail: 0.05,
    pRetry: 0.1,
    pSkip: 0,
    baseMs: [40_000, 90_000],
    backoffMs: [30_000, 60_000],
    costCents: (rng) => randInt(rng, 20, 30),
    failedCostCents: 5,
  },
  "crm-dedupe": {
    pFail: 0.03,
    pRetry: 0.06,
    pSkip: 0,
    baseMs: [30_000, 120_000],
    backoffMs: [10_000, 30_000],
    costCents: (rng) => randInt(rng, 8, 16),
    failedCostCents: 2,
  },
};

/** SMS costs 1.5 cents per message; rounding happens once per run so totals stay integer. */
export function smsCostCents(messages: number): number {
  return Math.round((messages * 3) / 2);
}

function randRange(rng: Rng, [min, max]: [number, number]): number {
  return randInt(rng, min, max);
}

function inHourRange(ms: number, day: number, fromHour: number, toHour: number): boolean {
  const start = dayStart(day) + fromHour * HOUR_MS;
  const end = dayStart(day) + toHour * HOUR_MS;
  return ms >= start && ms < end;
}

function scheduledTimes(job: JobDef, startMs: number, endMs: number): number[] {
  const times: number[] = [];
  const s = job.schedule;
  if (s.kind === "interval") {
    for (let t = startMs + s.offsetMs; t < endMs; t += s.everyMs) times.push(t);
  } else if (s.kind === "weekly") {
    for (let d = startMs; d < endMs; d += DAY_MS) {
      if (new Date(d).getUTCDay() === s.weekday) times.push(d + s.offsetMs);
    }
  }
  return times;
}

function normalOutcome(rng: Rng, job: JobDef, profile: Profile, at: number): Outcome {
  const hour = new Date(at).getUTCHours();
  // Lead volume drops overnight, so the enrich job often finds nothing to do.
  const pSkip = job.id === "lead-enrich" && hour < 6 ? 0.35 : profile.pSkip;
  const base = randRange(rng, profile.baseMs);
  const roll = rng();
  if (roll < pSkip) {
    return { status: "skipped", attempt: 1, durationMs: randInt(rng, 200, 900), costCents: 0, errorSignature: null, errorLine: null };
  }
  if (roll < pSkip + profile.pFail) {
    const err = pick(rng, ERRORS[job.id]);
    return {
      status: "failed",
      attempt: job.maxAttempts,
      durationMs: base + randRange(rng, profile.backoffMs),
      costCents: profile.failedCostCents,
      errorSignature: err.signature,
      errorLine: err.message(rng),
    };
  }
  if (roll < pSkip + profile.pFail + profile.pRetry) {
    const err = pick(rng, ERRORS[job.id]);
    return {
      status: "retried-success",
      attempt: randInt(rng, 2, job.maxAttempts),
      durationMs: base + randRange(rng, profile.backoffMs),
      costCents: profile.costCents(rng),
      errorSignature: err.signature,
      errorLine: err.message(rng),
    };
  }
  return { status: "success", attempt: 1, durationMs: base, costCents: profile.costCents(rng), errorSignature: null, errorLine: null };
}

function stormOutcome(rng: Rng, job: JobDef, profile: Profile): Outcome {
  const base = randRange(rng, profile.baseMs);
  const roll = rng();
  if (roll < 0.7) {
    return {
      status: "failed",
      attempt: job.maxAttempts,
      durationMs: base + randInt(rng, 20_000, 50_000),
      costCents: 0,
      errorSignature: RATE_LIMIT.signature,
      errorLine: RATE_LIMIT.message(rng),
    };
  }
  if (roll < 0.9) {
    return {
      status: "retried-success",
      attempt: job.maxAttempts,
      durationMs: base + randInt(rng, 20_000, 50_000),
      costCents: profile.costCents(rng),
      errorSignature: RATE_LIMIT.signature,
      errorLine: RATE_LIMIT.message(rng),
    };
  }
  return { status: "success", attempt: 1, durationMs: base, costCents: profile.costCents(rng), errorSignature: null, errorLine: null };
}

function smsOutcome(rng: Rng, job: JobDef, profile: Profile, messages: number): Outcome {
  const outcome = normalOutcome(rng, job, profile, 0);
  const durationMs = outcome.durationMs + messages * 100;
  const costCents = outcome.status === "failed" ? 0 : smsCostCents(messages);
  return { ...outcome, durationMs, costCents };
}

function isoTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19) + "Z";
}

function buildLog(job: JobDef, startedAt: number, o: Outcome): string | null {
  if (!o.errorLine) return null;
  const end = startedAt + o.durationMs;
  const lines = [
    `${isoTime(startedAt)} ${job.id} attempt 1/${job.maxAttempts} started`,
    `${isoTime(startedAt + Math.min(o.durationMs, 1500))} ERROR ${o.errorLine}`,
  ];
  lines.push(
    o.status === "failed"
      ? `${isoTime(end)} giving up after ${o.attempt} attempts`
      : `${isoTime(end)} attempt ${o.attempt}/${job.maxAttempts} succeeded`,
  );
  return lines.join("\n");
}

type Draft = Omit<Run, "id" | "costUsd" | "logExcerpt"> & { logExcerpt: string | null };

function draft(job: JobDef, startedAt: number, o: Outcome): Draft {
  return {
    job: job.id,
    startedAt,
    durationMs: o.durationMs,
    status: o.status,
    attempt: o.attempt,
    costCents: o.costCents,
    errorSignature: o.errorSignature,
    logExcerpt: buildLog(job, startedAt, o),
  };
}

function scheduledRuns(rng: Rng, job: JobDef, startMs: number, endMs: number): Draft[] {
  const profile = PROFILES[job.id];
  const drafts: Draft[] = [];
  const storm = INCIDENTS.rateLimitStorm;
  const stop = INCIDENTS.backupSilentStop;
  for (const t of scheduledTimes(job, startMs, endMs)) {
    const day = dayNumber(t, startMs);
    // The scheduler for this job silently stopped: no record at all, not even a failure.
    if (job.id === stop.job && (stop.days as readonly number[]).includes(day)) continue;
    const at = t + randInt(rng, 0, 20_000);
    const inStorm = job.id === storm.job && inHourRange(at, storm.day, storm.fromHour, storm.toHour);
    const o = inStorm ? stormOutcome(rng, job, profile) : normalOutcome(rng, job, profile, at);
    drafts.push(draft(job, at, o));
  }
  return drafts;
}

function smsRuns(rng: Rng, job: JobDef, startMs: number, endMs: number): Draft[] {
  const profile = PROFILES[job.id];
  const drafts: Draft[] = [];
  const days = Math.round((endMs - startMs) / DAY_MS);
  for (let day = 1; day <= days; day++) {
    const bursts = randInt(rng, 3, 6);
    for (let b = 0; b < bursts; b++) {
      // Jobs close in the US afternoon and evening, which is late UTC.
      let at = dayStart(day, startMs) + randInt(rng, 13 * 60, 23 * 60) * MINUTE_MS;
      const runsInBurst = randInt(rng, 1, 3);
      for (let r = 0; r < runsInBurst; r++) {
        const messages = randInt(rng, 5, 25);
        drafts.push(draft(job, at, smsOutcome(rng, job, profile, messages)));
        at += randInt(rng, 2, 9) * MINUTE_MS;
      }
    }
  }
  const spike = INCIDENTS.smsCostSpike;
  // A misconfigured trigger re-sent the review request to the whole customer list in batches.
  for (let t = dayStart(spike.day, startMs) + spike.fromHour * HOUR_MS; t < dayStart(spike.day, startMs) + spike.toHour * HOUR_MS; t += 10 * MINUTE_MS) {
    const messages = randInt(rng, 40, 60);
    const o = smsOutcome(rng, job, profile, messages);
    drafts.push(draft(job, t + randInt(rng, 0, 30_000), o));
  }
  return drafts.filter((d) => d.startedAt < endMs);
}

export function generateDataset(seed: number = DEFAULT_SEED, startMs = DATA_START_MS, endMs = DATA_END_MS): Dataset {
  const rng = createRng(seed);
  const drafts: Draft[] = [];
  for (const job of JOBS) {
    const jobDrafts = job.schedule.kind === "event" ? smsRuns(rng, job, startMs, endMs) : scheduledRuns(rng, job, startMs, endMs);
    drafts.push(...jobDrafts);
  }
  const order = new Map(JOBS.map((j, i) => [j.id, i]));
  drafts.sort((a, b) => a.startedAt - b.startedAt || (order.get(a.job) ?? 0) - (order.get(b.job) ?? 0));
  const runs: Run[] = drafts.map((d, i) => ({
    ...d,
    id: `r${String(i + 1).padStart(5, "0")}`,
    costUsd: d.costCents / 100,
  }));
  return { seed, startMs, endMs, runs };
}

/** Coerces any user input into a valid unsigned 32-bit seed. */
export function normalizeSeed(input: number): number {
  if (!Number.isFinite(input)) return DEFAULT_SEED;
  return Math.abs(Math.trunc(input)) >>> 0;
}
