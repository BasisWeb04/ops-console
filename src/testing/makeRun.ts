import type { Run } from "../sim/types";

let counter = 0;

/** Builds a run for tests; only the fields a test cares about need to be given. */
export function makeRun(partial: Partial<Run> & Pick<Run, "startedAt">): Run {
  counter++;
  const costCents = partial.costCents ?? 0;
  return {
    id: partial.id ?? `t${counter}`,
    job: partial.job ?? "invoice-sync",
    startedAt: partial.startedAt,
    durationMs: partial.durationMs ?? 1000,
    status: partial.status ?? "success",
    attempt: partial.attempt ?? 1,
    costCents,
    costUsd: costCents / 100,
    errorSignature: partial.errorSignature ?? null,
    logExcerpt: partial.logExcerpt ?? null,
  };
}
