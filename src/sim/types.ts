export type RunStatus = "success" | "failed" | "retried-success" | "skipped";

export type JobId =
  | "invoice-sync"
  | "lead-enrich"
  | "nightly-backup"
  | "review-request-sms"
  | "weekly-report"
  | "crm-dedupe";

export interface Run {
  id: string;
  job: JobId;
  /** Epoch milliseconds, UTC. */
  startedAt: number;
  durationMs: number;
  status: RunStatus;
  /** Number of attempts made; 1 means no retry. */
  attempt: number;
  /** Canonical money value in whole cents; always an integer. */
  costCents: number;
  /** Display convenience, derived from costCents. Never summed directly. */
  costUsd: number;
  /** Stable grouping key for the error that failed or was retried; null when clean. */
  errorSignature: string | null;
  /** Short log tail, present when an error happened. */
  logExcerpt: string | null;
}

export type Schedule =
  | { kind: "interval"; everyMs: number; offsetMs: number }
  | { kind: "weekly"; weekday: number; offsetMs: number }
  | { kind: "event" };

export interface JobDef {
  id: JobId;
  label: string;
  description: string;
  schedule: Schedule;
  /** Expected gap between runs; null for event-driven jobs, which cannot go stale. */
  expectedIntervalMs: number | null;
  maxAttempts: number;
  color: string;
}

export interface Dataset {
  seed: number;
  startMs: number;
  endMs: number;
  runs: Run[];
}
