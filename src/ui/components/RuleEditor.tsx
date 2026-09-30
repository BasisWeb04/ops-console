import { useId } from "react";
import { JOBS } from "../../sim/jobs";
import { RULE_KIND_LABELS, type AlertRule, type JobScope } from "../../alerts/rules";
import { toCents } from "../../metrics/money";
import { NumberField } from "./NumberField";

interface Props {
  rule: AlertRule;
  onChange: (rule: AlertRule) => void;
  onDelete: () => void;
}

function JobSelect({ value, onChange, allowAll = true }: { value: JobScope; onChange: (v: JobScope) => void; allowAll?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-stone-700 dark:text-stone-300">
        Job
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as JobScope)}
        className="rounded border border-stone-300 bg-white px-2 py-1 font-mono text-sm dark:border-stone-700 dark:bg-stone-950"
      >
        {allowAll && <option value="all">all jobs</option>}
        {JOBS.map((j) => (
          <option key={j.id} value={j.id}>
            {j.id}
          </option>
        ))}
      </select>
    </div>
  );
}

function describe(rule: AlertRule): string {
  switch (rule.kind) {
    case "failure-rate":
      return "Fires when failed / attempted runs is above the threshold. Windows with fewer attempted runs than the minimum read as no data.";
    case "spend":
      return "Fires when spend since 00:00 UTC is above the budget. A day with no spend is a real $0.00.";
    case "stale":
      return "Fires when a scheduled job has not started a run for more than the multiplier times its interval. Event-driven jobs are exempt.";
    case "p95":
      return "Fires when the nearest-rank p95 duration of attempted runs in the window is above the threshold.";
  }
}

function Fields({ rule, onChange }: Pick<Props, "rule" | "onChange">) {
  switch (rule.kind) {
    case "failure-rate":
      return (
        <>
          <JobSelect value={rule.job} onChange={(job) => onChange({ ...rule, job })} />
          <NumberField label="Threshold" suffix="% failed" value={rule.thresholdPct} min={0} max={100} onCommit={(v) => onChange({ ...rule, thresholdPct: v })} />
          <NumberField label="Window" suffix="minutes" value={rule.windowMinutes} min={15} max={10080} step={15} onCommit={(v) => onChange({ ...rule, windowMinutes: v })} />
          <NumberField label="Minimum runs" value={rule.minRuns} min={1} max={1000} onCommit={(v) => onChange({ ...rule, minRuns: Math.round(v) })} />
        </>
      );
    case "spend":
      return (
        <NumberField
          label="Daily budget"
          suffix="USD"
          value={rule.dailyBudgetCents / 100}
          min={0}
          max={100000}
          step={0.5}
          onCommit={(v) => onChange({ ...rule, dailyBudgetCents: toCents(v) })}
        />
      );
    case "stale":
      return (
        <>
          <JobSelect value={rule.job} onChange={(job) => onChange({ ...rule, job })} />
          <NumberField label="Multiplier" suffix="x interval" value={rule.multiplier} min={1} max={20} step={0.5} onCommit={(v) => onChange({ ...rule, multiplier: v })} />
        </>
      );
    case "p95":
      return (
        <>
          <JobSelect value={rule.job} onChange={(job) => onChange({ ...rule, job })} />
          <NumberField
            label="Threshold"
            suffix="seconds"
            value={rule.thresholdMs / 1000}
            min={0.1}
            max={86400}
            step={1}
            onCommit={(v) => onChange({ ...rule, thresholdMs: Math.round(v * 1000) })}
          />
          <NumberField label="Window" suffix="minutes" value={rule.windowMinutes} min={15} max={10080} step={15} onCommit={(v) => onChange({ ...rule, windowMinutes: v })} />
        </>
      );
  }
}

export function RuleEditor({ rule, onChange, onDelete }: Props) {
  const enabledId = useId();
  return (
    <fieldset className="rounded-md border border-stone-200 p-3 dark:border-stone-800">
      <legend className="px-1 text-sm font-semibold">
        {RULE_KIND_LABELS[rule.kind]} <span className="font-mono text-xs font-normal text-stone-600 dark:text-stone-400">{rule.id}</span>
      </legend>
      <p className="mb-3 text-xs text-stone-600 dark:text-stone-400">{describe(rule)}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Fields rule={rule} onChange={onChange} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label htmlFor={enabledId} className="inline-flex items-center gap-2 text-sm">
          <input id={enabledId} type="checkbox" checked={rule.enabled} onChange={(e) => onChange({ ...rule, enabled: e.target.checked })} className="h-4 w-4 accent-teal-700" />
          Enabled
        </label>
        <button
          type="button"
          onClick={onDelete}
          className="rounded px-2 py-1 text-xs font-medium text-red-800 underline underline-offset-2 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
        >
          Delete rule
        </button>
      </div>
    </fieldset>
  );
}
