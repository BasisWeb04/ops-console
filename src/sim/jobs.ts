import type { JobDef, JobId } from "./types";
import { DAY_MS, HOUR_MS, MINUTE_MS, WEEK_MS } from "./time";

/** Fictional company used in all copy and logs. */
export const COMPANY_NAME = "Fernhollow Home Services (fictional)";

/*
 * Colors are the Okabe-Ito colorblind-safe set, minus yellow and black,
 * which lack contrast on one of the two themes.
 */
export const JOBS: readonly JobDef[] = [
  {
    id: "invoice-sync",
    label: "invoice-sync",
    description: "Copies new invoices from the field app into the accounting ledger.",
    schedule: { kind: "interval", everyMs: HOUR_MS, offsetMs: 5 * MINUTE_MS },
    expectedIntervalMs: HOUR_MS,
    maxAttempts: 3,
    color: "#E69F00",
  },
  {
    id: "lead-enrich",
    label: "lead-enrich",
    description: "Looks up company size and address for new web leads via an enrichment vendor.",
    schedule: { kind: "interval", everyMs: 15 * MINUTE_MS, offsetMs: 0 },
    expectedIntervalMs: 15 * MINUTE_MS,
    maxAttempts: 3,
    color: "#56B4E9",
  },
  {
    id: "nightly-backup",
    label: "nightly-backup",
    description: "Snapshots the job database to object storage.",
    schedule: { kind: "interval", everyMs: DAY_MS, offsetMs: 2 * HOUR_MS },
    expectedIntervalMs: DAY_MS,
    maxAttempts: 2,
    color: "#009E73",
  },
  {
    id: "review-request-sms",
    label: "review-request-sms",
    description: "Texts customers a review link after a job is closed. Runs in bursts on events.",
    schedule: { kind: "event" },
    expectedIntervalMs: null,
    maxAttempts: 2,
    color: "#CC79A7",
  },
  {
    id: "weekly-report",
    label: "weekly-report",
    description: "Builds and emails the Monday operations summary.",
    schedule: { kind: "weekly", weekday: 1, offsetMs: 7 * HOUR_MS },
    expectedIntervalMs: WEEK_MS,
    maxAttempts: 2,
    color: "#0072B2",
  },
  {
    id: "crm-dedupe",
    label: "crm-dedupe",
    description: "Merges duplicate customer records in the CRM.",
    schedule: { kind: "interval", everyMs: 6 * HOUR_MS, offsetMs: 30 * MINUTE_MS },
    expectedIntervalMs: 6 * HOUR_MS,
    maxAttempts: 2,
    color: "#D55E00",
  },
];

export const JOB_IDS: readonly JobId[] = JOBS.map((j) => j.id);

export function getJob(id: JobId): JobDef {
  const job = JOBS.find((j) => j.id === id);
  if (!job) throw new Error(`Unknown job ${id}`);
  return job;
}
