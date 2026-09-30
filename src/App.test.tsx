import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { App } from "./App";
import { DEFAULT_SEED, generateDataset } from "./sim/simulate";
import { buildIndex } from "./alerts/runIndex";
import { evaluateRules } from "./alerts/evaluate";
import { computeAlertHistory, episodesUpTo } from "./alerts/history";
import { DEFAULT_RULES } from "./alerts/rules";
import { finishedBy } from "./metrics/stats";
import { MINUTE_MS, dayStart } from "./sim/time";
import { Overview } from "./ui/views/Overview";
import { Jobs } from "./ui/views/Jobs";
import { Failures } from "./ui/views/Failures";
import { Costs } from "./ui/views/Costs";
import { Alerts } from "./ui/views/Alerts";
import type { ViewModel } from "./ui/model";

function viewModelAt(now: number): ViewModel {
  const dataset = generateDataset(DEFAULT_SEED);
  const index = buildIndex(dataset.runs);
  const ctx = { observedFromMs: dataset.startMs };
  const rules = [...DEFAULT_RULES];
  const history = computeAlertHistory(index, rules, dataset.startMs, dataset.endMs, 15 * MINUTE_MS, ctx);
  return {
    dataset,
    index,
    now,
    visibleRuns: finishedBy(dataset.runs, now),
    rules,
    evaluations: evaluateRules(index, rules, now, ctx),
    episodes: episodesUpTo(history, now),
    budgetCents: 1200,
    jumpTo: () => {},
  };
}

describe("rendering", () => {
  it("shows the required demo notice and author link", () => {
    const html = renderToString(<App />);
    expect(html).toContain("Demo with fictional data");
    expect(html).toContain("Built by Ethan Chacko");
    expect(html).toContain('href="https://ethanchacko.com"');
  });

  it("renders every view mid-incident, with the stale backup alert visible on day 12", () => {
    const vm = viewModelAt(dayStart(12) + 12 * 60 * MINUTE_MS);
    const overview = renderToString(<Overview vm={vm} />);
    expect(overview).toContain("nightly-backup");
    expect(overview).toContain("Firing");
    expect(renderToString(<Jobs vm={vm} />)).toContain("overdue by");
    expect(renderToString(<Failures vm={vm} />)).toContain("enrich-api.http-429-rate-limit");
    expect(renderToString(<Costs vm={vm} />)).toContain("Over budget");
    expect(renderToString(<Alerts vm={vm} onRulesChange={() => {}} onResetRules={() => {}} />)).toContain("stale after");
  });

  it("renders empty states at the very start of the replay", () => {
    const vm = viewModelAt(generateDataset(DEFAULT_SEED).startMs);
    expect(renderToString(<Failures vm={vm} />)).toContain("No errors up to this point");
    expect(renderToString(<Overview vm={vm} />)).toContain("no data");
  });
});

describe("mobile layout", () => {
  it("keeps sr-only spans inside their table scroll boxes so the page cannot scroll sideways", () => {
    const vm = viewModelAt(dayStart(12) + 12 * 60 * MINUTE_MS);
    const failures = renderToString(<Failures vm={vm} />);
    const alerts = renderToString(<Alerts vm={vm} onRulesChange={() => {}} onResetRules={() => {}} />);
    for (const html of [failures, alerts]) {
      const at = html.indexOf("sr-only");
      expect(at).toBeGreaterThan(-1);
      // The nearest scroll-box wrapper before the sr-only span must be a positioned one.
      const wrapper = html.lastIndexOf('overflow-x-auto">', at);
      expect(html.slice(wrapper - 9, wrapper)).toBe("relative ");
    }
  });
});
