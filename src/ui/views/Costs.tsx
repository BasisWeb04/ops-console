import { JOBS } from "../../sim/jobs";
import { DATA_DAYS } from "../../sim/time";
import { dailyCosts, totalsByJob } from "../../metrics/costs";
import { formatCents } from "../../metrics/money";
import { formatDate } from "../../format";
import { EmptyState, Panel, TABLE, TD, TH } from "../components/Panel";
import { JobName, JobSwatch } from "../components/JobName";
import { StackedBars, type DayStack } from "../components/StackedBars";
import type { ViewModel } from "../model";

export function Costs({ vm }: { vm: ViewModel }) {
  const days = dailyCosts(vm.visibleRuns, vm.dataset.startMs, DATA_DAYS, vm.now);
  const totals = totalsByJob(days);
  const grand = days.reduce((acc, d) => acc + d.totalCents, 0);
  const stacks: DayStack[] = Array.from({ length: DATA_DAYS }, (_, i) => {
    const d = days[i];
    return { label: `Day ${i + 1}`, byJob: d ? d.byJob : null };
  });
  return (
    <div className="space-y-4">
      <Panel title="Daily spend by job" id="cost-chart">
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legend">
          {JOBS.map((j) => (
            <li key={j.id} className="inline-flex items-center gap-1.5 font-mono">
              <JobSwatch job={j.id} />
              {j.id}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-red-700 dark:border-red-400" />
            daily budget
          </li>
        </ul>
        <div className="overflow-x-auto">
          <StackedBars days={stacks} budgetCents={vm.budgetCents} />
        </div>
        <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">
          Numbers under each bar are dataset days. Shaded columns have not happened yet in the replay. Costs are summed in integer cents.
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Spend by job, replay start to now" id="cost-by-job">
          {grand === 0 ? (
            <EmptyState>No spend recorded yet.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className={`${TABLE} min-w-[420px]`}>
                <thead>
                  <tr>
                    <th className={TH}>Job</th>
                    <th className={`${TH} text-right`}>Spend</th>
                    <th className={`${TH} text-right`}>Share</th>
                    <th className={`${TH} text-right`}>Per day</th>
                  </tr>
                </thead>
                <tbody>
                  {JOBS.map((j) => {
                    const cents = totals.get(j.id) ?? 0;
                    return (
                      <tr key={j.id}>
                        <td className={TD}>
                          <JobName job={j.id} />
                        </td>
                        <td className={`${TD} tabular text-right`}>{formatCents(cents)}</td>
                        <td className={`${TD} tabular text-right`}>{((cents / grand) * 100).toFixed(1)}%</td>
                        <td className={`${TD} tabular text-right`}>{formatCents(Math.round(cents / Math.max(days.length, 1)))}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className={TD}>Total</td>
                    <td className={`${TD} tabular text-right`}>{formatCents(grand)}</td>
                    <td className={`${TD} tabular text-right`}>100%</td>
                    <td className={`${TD} tabular text-right`}>{formatCents(Math.round(grand / Math.max(days.length, 1)))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Spend by day" id="cost-by-day">
          {days.length === 0 ? (
            <EmptyState>The replay has not started a day yet.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className={`${TABLE} min-w-[360px]`}>
                <thead>
                  <tr>
                    <th className={TH}>Day</th>
                    <th className={`${TH} text-right`}>Spend</th>
                    <th className={TH}>Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const over = vm.budgetCents !== null && d.totalCents > vm.budgetCents;
                    return (
                      <tr key={d.day}>
                        <td className={`${TD} whitespace-nowrap`}>
                          {d.day}. {formatDate(d.startMs)}
                        </td>
                        <td className={`${TD} tabular text-right`}>{formatCents(d.totalCents)}</td>
                        <td className={`${TD} ${over ? "font-semibold text-red-700 dark:text-red-300" : "text-stone-600 dark:text-stone-400"}`}>
                          {vm.budgetCents === null ? "no budget" : over ? "Over budget" : "within"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
