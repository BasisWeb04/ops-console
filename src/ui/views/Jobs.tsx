import { JOBS } from "../../sim/jobs";
import { DATA_DAYS, dayNumber } from "../../sim/time";
import { computeStats, dailyBuckets, lastRunAt, runsForJob } from "../../metrics/stats";
import { formatDateTime, formatDuration, formatHours, formatPct } from "../../format";
import { Panel, TABLE, TD, TH } from "../components/Panel";
import { JobName } from "../components/JobName";
import { Sparkline } from "../components/Sparkline";
import type { ViewModel } from "../model";

function nextExpected(last: number | null, interval: number | null, now: number): string {
  if (interval === null) return "on events";
  if (last === null) return "awaiting first run";
  const next = last + interval;
  if (next >= now) return formatDateTime(next);
  return `overdue by ${formatHours(now - next)}`;
}

export function Jobs({ vm }: { vm: ViewModel }) {
  const elapsedDays = Math.min(dayNumber(vm.now - 1, vm.dataset.startMs), DATA_DAYS);
  return (
    <Panel title="Jobs, from replay start to now" id="jobs">
      <div className="overflow-x-auto">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Job</th>
              <th className={`${TH} text-right`}>Runs</th>
              <th className={`${TH} text-right`}>Success rate</th>
              <th className={`${TH} text-right`}>Ok after retry</th>
              <th className={`${TH} text-right`}>Failed</th>
              <th className={`${TH} text-right`}>p95</th>
              <th className={TH}>Last run</th>
              <th className={TH}>Next expected</th>
              <th className={TH}>Daily success, 14 days</th>
            </tr>
          </thead>
          <tbody>
            {JOBS.map((job) => {
              const runs = runsForJob(vm.visibleRuns, job.id);
              const s = computeStats(runs);
              const last = lastRunAt(runs, job.id, vm.now);
              const next = nextExpected(last, job.expectedIntervalMs, vm.now);
              const days = dailyBuckets(runs, vm.dataset.startMs, DATA_DAYS, vm.now).map((b) => b.stats.successRate);
              return (
                <tr key={job.id}>
                  <td className={TD}>
                    <JobName job={job.id} />
                    <div className="mt-0.5 max-w-64 text-xs text-stone-600 dark:text-stone-400">{job.description}</div>
                  </td>
                  <td className={`${TD} tabular text-right`}>{s.total}</td>
                  <td className={`${TD} tabular text-right`}>{formatPct(s.successRate)}</td>
                  <td className={`${TD} tabular text-right`}>{s.retriedSuccess}</td>
                  <td className={`${TD} tabular text-right`}>{s.failed}</td>
                  <td className={`${TD} tabular text-right`}>{formatDuration(s.p95DurationMs)}</td>
                  <td className={`${TD} tabular whitespace-nowrap`}>{last === null ? "none yet" : formatDateTime(last)}</td>
                  <td className={`${TD} tabular whitespace-nowrap ${next.startsWith("overdue") ? "font-semibold text-red-700 dark:text-red-300" : ""}`}>
                    {next}
                  </td>
                  <td className={TD}>
                    <Sparkline values={days} futureFrom={elapsedDays} label={`${job.id} daily success rate`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-stone-600 dark:text-stone-400">
        Success rate counts ok-after-retry as success and leaves skipped runs out. A crossed mark in a sparkline is a day with no runs: no data, not 0
        percent. Red dots mark days below 90 percent. Overdue means past the expected interval; the stale alert waits for its multiplier.
      </p>
    </Panel>
  );
}
