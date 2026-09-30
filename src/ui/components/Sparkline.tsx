import { formatPct } from "../../format";

interface Props {
  /** One value per day in [0, 1]; null means no data that day, drawn as a gap, never as 0. */
  values: (number | null)[];
  /** Days at or after this index have not happened yet in the replay. */
  futureFrom: number;
  label: string;
}

const W = 112;
const H = 28;
const PAD = 3;

export function Sparkline({ values, futureFrom, label }: Props) {
  const n = values.length;
  const x = (i: number) => PAD + (n <= 1 ? 0 : (i * (W - 2 * PAD)) / (n - 1));
  const y = (v: number) => PAD + (1 - v) * (H - 2 * PAD);
  const segments: string[] = [];
  let current = "";
  values.forEach((v, i) => {
    if (v === null || i >= futureFrom) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    current += `${current ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
  });
  if (current) segments.push(current);
  const noData = values.map((v, i) => (v === null && i < futureFrom ? i : -1)).filter((i) => i >= 0);
  const described = values
    .slice(0, futureFrom)
    .map((v, i) => `day ${i + 1} ${formatPct(v, 0)}`)
    .join(", ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${label}: ${described}`} className="overflow-visible">
      <title>{`${label}: ${described}`}</title>
      <line x1={PAD} x2={W - PAD} y1={y(1)} y2={y(1)} className="stroke-stone-200 dark:stroke-stone-700" strokeWidth="1" strokeDasharray="2 2" />
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" className="stroke-stone-800 dark:stroke-stone-200" strokeWidth="1.5" />
      ))}
      {values.map((v, i) =>
        v !== null && i < futureFrom && v < 0.9 ? <circle key={i} cx={x(i)} cy={y(v)} r="2" className="fill-red-600 dark:fill-red-400" /> : null,
      )}
      {noData.map((i) => (
        <path key={`nd${i}`} d={`M${x(i) - 2},${H - 4} l4,-4 M${x(i) - 2},${H - 8} l4,4`} className="stroke-stone-500" strokeWidth="1.2" />
      ))}
    </svg>
  );
}
