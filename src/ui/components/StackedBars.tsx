import { JOBS } from "../../sim/jobs";
import type { JobId } from "../../sim/types";
import { formatCents } from "../../metrics/money";

export interface DayStack {
  label: string;
  /** Cents per job; days not yet reached in the replay pass null. */
  byJob: Map<JobId, number> | null;
}

interface Props {
  days: DayStack[];
  budgetCents: number | null;
}

const W = 1000;
const H = 280;
const LEFT = 52;
const BOTTOM = 26;
const TOP = 10;

function niceMax(v: number): number {
  const steps = [500, 1000, 2000, 2500, 5000, 10000, 20000, 50000, 100000];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 100000) * 100000;
}

export function StackedBars({ days, budgetCents }: Props) {
  const totals = days.map((d) => (d.byJob ? [...d.byJob.values()].reduce((a, b) => a + b, 0) : 0));
  const max = niceMax(Math.max(...totals, budgetCents ?? 0, 1));
  const plotH = H - TOP - BOTTOM;
  const slot = (W - LEFT) / Math.max(days.length, 1);
  const barW = slot * 0.66;
  const y = (cents: number) => TOP + plotH - (cents / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[600px]" role="img" aria-label="Daily spend by job, stacked, with the daily budget line. The table below lists the same numbers.">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={LEFT} x2={W} y1={y(t)} y2={y(t)} className="stroke-stone-200 dark:stroke-stone-800" strokeWidth="1" />
          <text x={LEFT - 6} y={y(t) + 4} textAnchor="end" className="fill-stone-600 text-[11px] dark:fill-stone-400">
            {formatCents(t).replace(".00", "")}
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = LEFT + i * slot + (slot - barW) / 2;
        let acc = 0;
        return (
          <g key={d.label}>
            {d.byJob === null ? (
              <rect x={x} y={TOP} width={barW} height={plotH} className="fill-stone-100 dark:fill-stone-900" />
            ) : (
              JOBS.map((job) => {
                const cents = d.byJob?.get(job.id) ?? 0;
                if (cents === 0) return null;
                const top = y(acc + cents);
                const h = y(acc) - top;
                acc += cents;
                return (
                  <rect key={job.id} x={x} y={top} width={barW} height={Math.max(h, 0.5)} fill={job.color}>
                    <title>{`${d.label} ${job.id}: ${formatCents(cents)}`}</title>
                  </rect>
                );
              })
            )}
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="fill-stone-600 text-[11px] dark:fill-stone-400">
              {i + 1}
            </text>
          </g>
        );
      })}
      {budgetCents !== null && (
        <g>
          <line x1={LEFT} x2={W} y1={y(budgetCents)} y2={y(budgetCents)} className="stroke-red-700 dark:stroke-red-400" strokeWidth="1.5" strokeDasharray="6 4" />
          <text x={W - 4} y={y(budgetCents) - 5} textAnchor="end" className="fill-red-800 text-[11px] font-medium dark:fill-red-300">
            {`Budget ${formatCents(budgetCents)}/day`}
          </text>
        </g>
      )}
    </svg>
  );
}
