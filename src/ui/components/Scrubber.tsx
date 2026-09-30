import type { AlertEpisode } from "../../alerts/history";
import { formatDateTime } from "../../format";
import { DAY_MS, HOUR_MS, dayNumber } from "../../sim/time";

export const STEP_MS = 15 * 60_000;

interface Props {
  startMs: number;
  endMs: number;
  now: number;
  onChange: (ms: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  speedMs: number;
  onSpeedChange: (ms: number) => void;
  episodes: AlertEpisode[];
}

const BTN =
  "rounded border border-stone-300 bg-white px-2.5 py-1 text-sm font-medium hover:bg-stone-100 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800";

export function Scrubber({ startMs, endMs, now, onChange, playing, onTogglePlay, speedMs, onSpeedChange, episodes }: Props) {
  const span = endMs - startMs;
  const clamp = (ms: number) => Math.min(endMs, Math.max(startMs, ms));
  const day = Math.min(dayNumber(now - 1, startMs), Math.round(span / DAY_MS));
  return (
    <div className="rounded-md border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">Replay time</div>
          <div className="tabular font-mono text-sm font-semibold" aria-live="off">
            {formatDateTime(now)} <span className="font-sans font-normal text-stone-600 dark:text-stone-400">day {Math.max(day, 1)} of 14</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={BTN} onClick={() => onChange(startMs)} disabled={now <= startMs}>
            Start
          </button>
          <button type="button" className={BTN} onClick={() => onChange(clamp(now - DAY_MS))} disabled={now <= startMs}>
            -1 day
          </button>
          <button type="button" className={BTN} onClick={() => onChange(clamp(now - HOUR_MS))} disabled={now <= startMs}>
            -1 h
          </button>
          <button type="button" className={`${BTN} min-w-16`} onClick={onTogglePlay} aria-pressed={playing}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className={BTN} onClick={() => onChange(clamp(now + HOUR_MS))} disabled={now >= endMs}>
            +1 h
          </button>
          <button type="button" className={BTN} onClick={() => onChange(clamp(now + DAY_MS))} disabled={now >= endMs}>
            +1 day
          </button>
          <button type="button" className={BTN} onClick={() => onChange(endMs)} disabled={now >= endMs}>
            End
          </button>
          <label className="ml-1 flex items-center gap-1.5 text-sm">
            <span className="text-stone-600 dark:text-stone-400">Speed</span>
            <select
              className="rounded border border-stone-300 bg-white px-1.5 py-1 text-sm dark:border-stone-700 dark:bg-stone-900"
              value={speedMs}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
            >
              <option value={STEP_MS}>15 min per tick</option>
              <option value={HOUR_MS}>1 h per tick</option>
              <option value={3 * HOUR_MS}>3 h per tick</option>
            </select>
          </label>
        </div>
      </div>
      <div className="relative mt-3">
        <div aria-hidden="true" className="relative mb-1 h-2">
          {episodes.map((ep) => {
            const left = ((ep.startMs - startMs) / span) * 100;
            const width = Math.max((((ep.endMs ?? endMs) - ep.startMs) / span) * 100, 0.4);
            return (
              <span
                key={`${ep.ruleId}-${ep.job}-${ep.startMs}`}
                className="absolute top-0 h-2 rounded-sm bg-red-600/80 dark:bg-red-400/80"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={ep.firstSummary}
              />
            );
          })}
        </div>
        <label htmlFor="scrubber" className="sr-only">
          Replay position
        </label>
        <input
          id="scrubber"
          type="range"
          className="w-full accent-teal-700 dark:accent-teal-300"
          min={startMs}
          max={endMs}
          step={STEP_MS}
          value={now}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={formatDateTime(now)}
        />
        <div aria-hidden="true" className="tabular flex justify-between text-[11px] text-stone-600 dark:text-stone-400">
          {Array.from({ length: 15 }, (_, i) => (
            <span key={i} className={i % 2 === 1 ? "hidden sm:inline" : ""}>
              {i === 14 ? "end" : `d${i + 1}`}
            </span>
          ))}
        </div>
        <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">Red marks above the slider show when the current rules fire across all 14 days.</p>
      </div>
    </div>
  );
}
