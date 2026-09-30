import { useId, useState } from "react";
import { RULE_KIND_LABELS, newRule, type AlertRule, type RuleKind } from "../../alerts/rules";
import type { Evaluation } from "../../alerts/evaluate";
import { formatDateTime, formatHours } from "../../format";
import { EmptyState, Panel, TABLE, TD, TH } from "../components/Panel";
import { EvalStateBadge } from "../components/Badges";
import { JobName } from "../components/JobName";
import { RuleEditor } from "../components/RuleEditor";
import type { ViewModel } from "../model";

interface Props {
  vm: ViewModel;
  onRulesChange: (rules: AlertRule[]) => void;
  onResetRules: () => void;
}

const STATE_ORDER: Record<Evaluation["state"], number> = { firing: 0, "no-data": 1, ok: 2, "not-applicable": 3 };

function EvaluationRows({ rows }: { rows: Evaluation[] }) {
  return (
    <div className="overflow-x-auto">
      <table className={`${TABLE} min-w-[520px]`}>
        <thead>
          <tr>
            <th className={TH}>State</th>
            <th className={TH}>Rule</th>
            <th className={TH}>Numbers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={`${e.ruleId}-${e.job}`}>
              <td className={TD}>
                <EvalStateBadge state={e.state} />
              </td>
              <td className={`${TD} whitespace-nowrap`}>
                <div className="font-medium">{RULE_KIND_LABELS[e.kind]}</div>
                <div className="font-mono text-xs text-stone-600 dark:text-stone-400">{e.ruleId}</div>
              </td>
              <td className={`${TD} tabular`}>{e.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Alerts({ vm, onRulesChange, onResetRules }: Props) {
  const [kind, setKind] = useState<RuleKind>("failure-rate");
  const addId = useId();
  const sorted = [...vm.evaluations].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
  const firing = sorted.filter((e) => e.state === "firing");
  const rest = sorted.filter((e) => e.state !== "firing");

  function update(i: number, rule: AlertRule) {
    onRulesChange(vm.rules.map((r, j) => (j === i ? rule : r)));
  }

  function add() {
    const taken = new Set(vm.rules.map((r) => r.id));
    let n = 1;
    while (taken.has(`${kind}-${n}`)) n++;
    onRulesChange([...vm.rules, newRule(kind, `${kind}-${n}`)]);
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Panel
        title={`Rules (${vm.rules.length})`}
        id="rules"
        action={
          <button type="button" onClick={onResetRules} className="rounded px-2 py-1 text-xs font-medium text-teal-800 underline underline-offset-2 dark:text-teal-300">
            Reset to defaults
          </button>
        }
      >
        <div className="space-y-3">
          {vm.rules.length === 0 && <EmptyState>No rules. Nothing can alert until you add one.</EmptyState>}
          {vm.rules.map((rule, i) => (
            <RuleEditor key={rule.id} rule={rule} onChange={(r) => update(i, r)} onDelete={() => onRulesChange(vm.rules.filter((_, j) => j !== i))} />
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t border-stone-200 pt-3 dark:border-stone-800">
            <div className="flex flex-col gap-1">
              <label htmlFor={addId} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                New rule type
              </label>
              <select
                id={addId}
                value={kind}
                onChange={(e) => setKind(e.target.value as RuleKind)}
                className="rounded border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-950"
              >
                {(Object.keys(RULE_KIND_LABELS) as RuleKind[]).map((k) => (
                  <option key={k} value={k}>
                    {RULE_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={add} className="rounded bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 dark:bg-teal-300 dark:text-stone-950 dark:hover:bg-teal-200">
              Add rule
            </button>
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title={`Evaluation at ${formatDateTime(vm.now)}`} id="evaluation">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Firing ({firing.length})</h3>
          {firing.length === 0 ? <EmptyState>Nothing is firing at this point in the replay.</EmptyState> : <EvaluationRows rows={firing} />}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">Other checks ({rest.length}): no data, OK and not applicable</summary>
            <div className="mt-2">{rest.length === 0 ? <EmptyState>No other checks.</EmptyState> : <EvaluationRows rows={rest} />}</div>
          </details>
        </Panel>

        <Panel title={`Alert history up to now (${vm.episodes.length})`} id="history">
          {vm.episodes.length === 0 ? (
            <EmptyState>No alert has fired yet in this replay.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className={`${TABLE} min-w-[600px]`}>
                <thead>
                  <tr>
                    <th className={TH}>Started</th>
                    <th className={TH}>Rule and job</th>
                    <th className={TH}>Lasted</th>
                    <th className={TH}>Numbers when it fired</th>
                    <th className={TH}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vm.episodes.map((ep) => (
                    <tr key={`${ep.ruleId}-${ep.job}-${ep.startMs}`}>
                      <td className={`${TD} tabular whitespace-nowrap`}>{formatDateTime(ep.startMs)}</td>
                      <td className={TD}>
                        <div className="font-medium">{RULE_KIND_LABELS[ep.kind]}</div>
                        {ep.job ? <JobName job={ep.job} /> : <span className="text-xs text-stone-600 dark:text-stone-400">all jobs</span>}
                      </td>
                      <td className={`${TD} tabular whitespace-nowrap`}>{ep.endMs === null ? `ongoing, ${formatHours(vm.now - ep.startMs)}` : formatHours(ep.endMs - ep.startMs)}</td>
                      <td className={`${TD} tabular`}>{ep.firstSummary}</td>
                      <td className={TD}>
                        <button
                          type="button"
                          onClick={() => vm.jumpTo(ep.startMs)}
                          className="rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-teal-800 underline underline-offset-2 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950"
                        >
                          Jump
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-stone-600 dark:text-stone-400">History re-evaluates every rule at 15-minute steps over the replay, so an alert shorter than one step can be missed.</p>
        </Panel>
      </div>
    </div>
  );
}
