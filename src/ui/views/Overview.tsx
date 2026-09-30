import { DAY_MS, startOfUtcDay } from "../../sim/time";
import { computeStats } from "../../metrics/stats";
import { formatCents } from "../../metrics/money";
import { formatDateTime, formatDuration, formatPct } from "../../format";
import { sliceFrom, sliceWindow } from "../../alerts/runIndex";
import { RULE_KIND_LABELS } from "../../alerts/rules";
import { EmptyState, Kpi, Panel } from "../components/Panel";
import { EvalStateBadge, RunStatusBadge } from "../components/Badges";
import { JobName } from "../components/JobName";
import type { ViewModel } from "../model";

export function Overview({ vm }: { vm: ViewModel }) {
  const last24 = computeStats(sliceWindow(vm.index.all, vm.now, DAY_MS));
  const today = computeStats(sliceFrom(vm.index.all, startOfUtcDay(vm.now), vm.now));
  const firing = vm.evaluations.filter((e) => e.state === "firing");
  const overBudget = vm.budgetCents !== null && today.costCents > vm.budgetCents;
  const recentFailures = vm.visibleRuns.filter((r) => r.status === "failed").slice(-5).reverse();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Success rate, last 24 h"
          value={formatPct(last24.successRate)}
          detail={`${last24.success} ok, ${last24.retriedSuccess} ok after retry, ${last24.failed} failed, ${last24.skipped} skipped`}
          tone={last24.successRate !== null && last24.successRate < 0.95 ? "bad" : "neutral"}
        />
        <Kpi label="p95 duration, last 24 h" value={formatDuration(last24.p95DurationMs)} detail="Nearest-rank, skipped runs excluded" />
        <Kpi label="Runs today" value={String(today.total)} detail={`Since 00:00 UTC, ${today.failed} failed`} />
        <Kpi
          label="Spend today"
          value={formatCents(today.costCents)}
          detail={vm.budgetCents === null ? "No budget rule enabled" : `${overBudget ? "Over" : "Within"} budget of ${formatCents(vm.budgetCents)}`}
          tone={overBudget ? "bad" : "neutral"}
        />
        <Kpi
          label="Active alerts"
          value={String(firing.length)}
          detail={firing.length === 0 ? "Nothing firing now" : "Listed below"}
          tone={firing.length > 0 ? "bad" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={`Firing now (${firing.length})`} id="firing-now">
          {firing.length === 0 ? (
            <EmptyState>No alert is firing at this point in the replay.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {firing.map((e) => (
                <li key={`${e.ruleId}-${e.job}`} className="flex flex-wrap items-start gap-2 text-sm">
                  <EvalStateBadge state={e.state} />
                  <span className="font-medium">{RULE_KIND_LABELS[e.kind]}</span>
                  <span className="tabular min-w-0 flex-1 basis-60 text-stone-700 dark:text-stone-300">{e.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Alert episodes so far" id="episodes">
          {vm.episodes.length === 0 ? (
            <EmptyState>No alert has fired yet in this replay.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {vm.episodes.map((ep) => (
                <li key={`${ep.ruleId}-${ep.job}-${ep.startMs}`} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="tabular font-mono text-xs text-stone-600 dark:text-stone-400">{formatDateTime(ep.startMs)}</span>
                  <span className="font-medium">{RULE_KIND_LABELS[ep.kind]}</span>
                  {ep.job ? <JobName job={ep.job} /> : <span className="text-stone-600 dark:text-stone-400">all jobs</span>}
                  <span className="text-xs text-stone-600 dark:text-stone-400">{ep.endMs === null ? "ongoing" : "resolved"}</span>
                  <button
                    type="button"
                    onClick={() => vm.jumpTo(ep.startMs)}
                    className="ml-auto rounded px-1.5 py-0.5 text-xs font-medium text-teal-800 underline underline-offset-2 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950"
                  >
                    Jump to start
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Latest failed runs" id="latest-failed">
        {recentFailures.length === 0 ? (
          <EmptyState>No failed runs yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {recentFailures.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <RunStatusBadge status={r.status} />
                <JobName job={r.job} />
                <span className="tabular font-mono text-xs text-stone-600 dark:text-stone-400">{formatDateTime(r.startedAt)}</span>
                <span className="font-mono text-xs break-all">{r.errorSignature}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
