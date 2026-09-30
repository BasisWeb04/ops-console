import type { RunStatus } from "../../sim/types";
import type { EvalState } from "../../alerts/evaluate";

type Shape = "dot" | "ring" | "square" | "dash" | "triangle";

/* Each status has its own shape and text label, so meaning never depends on color alone. */
function ShapeIcon({ shape }: { shape: Shape }) {
  return (
    <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" className="shrink-0">
      {shape === "dot" && <circle cx="5" cy="5" r="4" fill="currentColor" />}
      {shape === "ring" && <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />}
      {shape === "square" && <rect x="1" y="1" width="8" height="8" fill="currentColor" />}
      {shape === "dash" && <rect x="1" y="4" width="8" height="2" fill="currentColor" />}
      {shape === "triangle" && <path d="M5 0.8 L9.4 9 L0.6 9 Z" fill="currentColor" />}
    </svg>
  );
}

const RUN_STATUS: Record<RunStatus, { label: string; shape: Shape; cls: string }> = {
  success: { label: "Success", shape: "dot", cls: "text-emerald-800 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-950" },
  "retried-success": { label: "Retried, ok", shape: "ring", cls: "text-sky-800 bg-sky-50 dark:text-sky-200 dark:bg-sky-950" },
  failed: { label: "Failed", shape: "square", cls: "text-red-800 bg-red-50 dark:text-red-200 dark:bg-red-950" },
  skipped: { label: "Skipped", shape: "dash", cls: "text-stone-700 bg-stone-100 dark:text-stone-300 dark:bg-stone-800" },
};

const EVAL_STATE: Record<EvalState, { label: string; shape: Shape; cls: string }> = {
  firing: { label: "Firing", shape: "triangle", cls: "text-red-800 bg-red-50 dark:text-red-200 dark:bg-red-950" },
  ok: { label: "OK", shape: "dot", cls: "text-emerald-800 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-950" },
  "no-data": { label: "No data", shape: "dash", cls: "text-stone-700 bg-stone-100 dark:text-stone-300 dark:bg-stone-800" },
  "not-applicable": { label: "N/A", shape: "ring", cls: "text-stone-700 bg-stone-100 dark:text-stone-300 dark:bg-stone-800" },
};

function Pill({ label, shape, cls }: { label: string; shape: Shape; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      <ShapeIcon shape={shape} />
      {label}
    </span>
  );
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Pill {...RUN_STATUS[status]} />;
}

export function EvalStateBadge({ state }: { state: EvalState }) {
  return <Pill {...EVAL_STATE[state]} />;
}
