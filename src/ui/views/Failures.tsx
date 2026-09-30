import { groupFailures } from "../../metrics/failures";
import { formatDateTime } from "../../format";
import { EmptyState, Panel, TABLE, TD, TH } from "../components/Panel";
import { JobName } from "../components/JobName";
import type { ViewModel } from "../model";

export function Failures({ vm }: { vm: ViewModel }) {
  const groups = groupFailures(vm.visibleRuns);
  return (
    <Panel title={`Failures by error signature (${groups.length})`} id="failures">
      {groups.length === 0 ? (
        <EmptyState>No errors up to this point in the replay.</EmptyState>
      ) : (
        // relative: the sr-only span is absolutely positioned and would otherwise escape this scroll box and widen the page
        <div className="relative overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Signature</th>
                <th className={`${TH} text-right`}>Failed</th>
                <th className={`${TH} text-right`}>Recovered by retry</th>
                <th className={TH}>First seen</th>
                <th className={TH}>Last seen</th>
                <th className={TH}>Affected jobs</th>
                <th className={TH}>Latest log excerpt</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.signature}>
                  <td className={`${TD} font-mono text-[13px] break-all`}>{g.signature}</td>
                  <td className={`${TD} tabular text-right font-semibold`}>{g.failed}</td>
                  <td className={`${TD} tabular text-right`}>{g.recovered}</td>
                  <td className={`${TD} tabular whitespace-nowrap`}>{formatDateTime(g.firstSeen)}</td>
                  <td className={`${TD} tabular whitespace-nowrap`}>{formatDateTime(g.lastSeen)}</td>
                  <td className={TD}>
                    <div className="flex flex-col gap-1">
                      {g.jobs.map((j) => (
                        <JobName key={j} job={j} />
                      ))}
                    </div>
                  </td>
                  <td className={TD}>
                    {g.sampleLog ? (
                      <pre className="max-w-[28rem] overflow-x-auto rounded bg-stone-100 p-2 font-mono text-[11px] leading-relaxed text-stone-800 dark:bg-stone-950 dark:text-stone-200">
                        <span className="sr-only">Run {g.sampleRunId}: </span>
                        {g.sampleLog}
                      </pre>
                    ) : (
                      <span className="text-stone-600 dark:text-stone-400">no log captured</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-stone-600 dark:text-stone-400">
        Failed means every attempt failed. Recovered means the error happened but a retry succeeded; those runs count as successes in rates.
      </p>
    </Panel>
  );
}
