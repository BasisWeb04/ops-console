import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { DEFAULT_SEED, generateDataset, normalizeSeed } from "./sim/simulate";
import { COMPANY_NAME } from "./sim/jobs";
import { MINUTE_MS } from "./sim/time";
import { finishedBy } from "./metrics/stats";
import { buildIndex } from "./alerts/runIndex";
import { evaluateRules } from "./alerts/evaluate";
import { computeAlertHistory, episodesUpTo } from "./alerts/history";
import { DEFAULT_RULES, type AlertRule } from "./alerts/rules";
import { Scrubber, STEP_MS } from "./ui/components/Scrubber";
import { Overview } from "./ui/views/Overview";
import { Jobs } from "./ui/views/Jobs";
import { Failures } from "./ui/views/Failures";
import { Costs } from "./ui/views/Costs";
import { Alerts } from "./ui/views/Alerts";
import type { ViewModel } from "./ui/model";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "jobs", label: "Jobs" },
  { id: "failures", label: "Failures" },
  { id: "costs", label: "Costs" },
  { id: "alerts", label: "Alerts" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TICK_MS = 400;

function param(name: string): string | null {
  return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(name);
}

function initialSeed(): number {
  const raw = param("seed");
  return raw === null ? DEFAULT_SEED : normalizeSeed(Number(raw));
}

function initialTab(): TabId {
  const raw = param("view");
  return TABS.find((t) => t.id === raw)?.id ?? "overview";
}

/** Replay position from ?at=ISO-time, snapped to the scrubber step and clamped to the dataset. */
function initialNow(startMs: number, endMs: number): number {
  const parsed = Date.parse(param("at") ?? "");
  if (Number.isNaN(parsed)) return endMs;
  const snapped = startMs + Math.round((parsed - startMs) / STEP_MS) * STEP_MS;
  return Math.min(endMs, Math.max(startMs, snapped));
}

function SeedControl({ seed, onApply }: { seed: number; onApply: (seed: number) => void }) {
  const [text, setText] = useState(String(seed));
  const valid = /^\d{1,10}$/.test(text.trim());
  useEffect(() => setText(String(seed)), [seed]);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onApply(normalizeSeed(Number(text)));
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="seed" className="text-xs font-medium text-stone-700 dark:text-stone-300">
          Simulation seed
        </label>
        <input
          id="seed"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={!valid}
          aria-describedby={valid ? undefined : "seed-err"}
          className="tabular w-32 rounded border border-stone-300 bg-white px-2 py-1 font-mono text-sm aria-invalid:border-red-700 dark:border-stone-700 dark:bg-stone-950"
        />
      </div>
      <button type="submit" disabled={!valid} className="rounded border border-stone-300 px-2.5 py-1 text-sm font-medium disabled:opacity-40 dark:border-stone-700">
        Apply
      </button>
      <button
        type="button"
        onClick={() => onApply(normalizeSeed(Math.floor(Math.random() * 1_000_000)))}
        className="rounded border border-stone-300 px-2.5 py-1 text-sm font-medium dark:border-stone-700"
      >
        Random
      </button>
      {!valid && (
        <span id="seed-err" className="w-full text-xs text-red-700 dark:text-red-300">
          Seed must be a whole number with up to 10 digits.
        </span>
      )}
    </form>
  );
}

export function App() {
  const [seed, setSeed] = useState(initialSeed);
  const [rules, setRules] = useState<AlertRule[]>(() => [...DEFAULT_RULES]);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(STEP_MS * 4);

  const dataset = useMemo(() => generateDataset(seed), [seed]);
  const [now, setNow] = useState(() => initialNow(dataset.startMs, dataset.endMs));
  const index = useMemo(() => buildIndex(dataset.runs), [dataset]);
  const ctx = useMemo(() => ({ observedFromMs: dataset.startMs }), [dataset]);

  // History replays every rule over 14 days; deferring keeps typing in the rules editor responsive.
  const deferredRules = useDeferredValue(rules);
  const history = useMemo(
    () => computeAlertHistory(index, deferredRules, dataset.startMs, dataset.endMs, 15 * MINUTE_MS, ctx),
    [index, deferredRules, dataset, ctx],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("seed", String(seed));
    url.searchParams.set("view", tab);
    url.searchParams.set("at", new Date(now).toISOString());
    window.history.replaceState(null, "", url);
  }, [seed, tab, now]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setNow((n) => Math.min(n + speedMs, dataset.endMs)), TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, speedMs, dataset.endMs]);

  useEffect(() => {
    if (playing && now >= dataset.endMs) setPlaying(false);
  }, [playing, now, dataset.endMs]);

  const jumpTo = useCallback((ms: number) => {
    setPlaying(false);
    setNow(ms);
  }, []);

  const togglePlay = () => {
    if (!playing && now >= dataset.endMs) setNow(dataset.startMs);
    setPlaying((p) => !p);
  };

  const vm: ViewModel = useMemo(() => {
    const spendRule = rules.find((r) => r.kind === "spend" && r.enabled);
    return {
      dataset,
      index,
      now,
      visibleRuns: finishedBy(dataset.runs, now),
      rules,
      evaluations: evaluateRules(index, rules, now, ctx),
      episodes: episodesUpTo(history, now),
      budgetCents: spendRule && spendRule.kind === "spend" ? spendRule.dailyBudgetCents : null,
      jumpTo,
    };
  }, [dataset, index, now, rules, ctx, history, jumpTo]);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Ops Console</h1>
            <span className="rounded border border-amber-700/40 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-300/40 dark:bg-amber-950 dark:text-amber-200">
              Demo with fictional data
            </span>
          </div>
          <p className="text-sm text-stone-700 dark:text-stone-300">
            Automation runs, failures, costs and alerts for {COMPANY_NAME}. 14 simulated days, replayable.
          </p>
          <p className="text-sm">
            <a href="https://ethanchacko.com" className="font-medium text-teal-800 underline underline-offset-2 dark:text-teal-300">
              Built by Ethan Chacko
            </a>
          </p>
        </div>
        <SeedControl
          seed={seed}
          onApply={(s) => {
            setPlaying(false);
            setSeed(s);
          }}
        />
      </header>

      <div className="mb-4">
        <Scrubber
          startMs={dataset.startMs}
          endMs={dataset.endMs}
          now={now}
          onChange={jumpTo}
          playing={playing}
          onTogglePlay={togglePlay}
          speedMs={speedMs}
          onSpeedChange={setSpeedMs}
          episodes={history}
        />
      </div>

      <nav aria-label="Views" className="mb-4 flex flex-wrap gap-x-1 border-b border-stone-200 dark:border-stone-800">
        {TABS.map((t) => {
          const firingCount = t.id === "alerts" ? vm.evaluations.filter((e) => e.state === "firing").length : 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${
                tab === t.id
                  ? "border-teal-700 text-stone-900 dark:border-teal-300 dark:text-stone-100"
                  : "border-transparent text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              }`}
            >
              {t.label}
              {firingCount > 0 && (
                <span className="tabular ml-1.5 rounded bg-red-700 px-1.5 text-xs text-white dark:bg-red-400 dark:text-stone-950">{firingCount} firing</span>
              )}
            </button>
          );
        })}
      </nav>

      <main>
        {tab === "overview" && <Overview vm={vm} />}
        {tab === "jobs" && <Jobs vm={vm} />}
        {tab === "failures" && <Failures vm={vm} />}
        {tab === "costs" && <Costs vm={vm} />}
        {tab === "alerts" && <Alerts vm={vm} onRulesChange={setRules} onResetRules={() => setRules([...DEFAULT_RULES])} />}
      </main>

      <footer className="mt-8 border-t border-stone-200 pt-3 text-xs text-stone-600 dark:border-stone-800 dark:text-stone-400">
        Demo with fictional data. {COMPANY_NAME} and every job, vendor, log line and number here are simulated. All times UTC.{" "}
        <a href="https://ethanchacko.com" className="text-teal-800 underline underline-offset-2 dark:text-teal-300">
          Built by Ethan Chacko
        </a>
        .
      </footer>
    </div>
  );
}
