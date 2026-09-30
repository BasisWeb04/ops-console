import type { AlertEpisode } from "../alerts/history";
import type { Evaluation } from "../alerts/evaluate";
import type { AlertRule } from "../alerts/rules";
import type { RunIndex } from "../alerts/runIndex";
import type { Dataset, Run } from "../sim/types";

/** Everything a view needs, computed once per replay position in App. */
export interface ViewModel {
  dataset: Dataset;
  index: RunIndex;
  now: number;
  /** Runs finished by `now`; the replay never shows the future. */
  visibleRuns: Run[];
  rules: AlertRule[];
  evaluations: Evaluation[];
  /** Episodes that started at or before `now`, with later ends clipped to "ongoing". */
  episodes: AlertEpisode[];
  budgetCents: number | null;
  jumpTo: (ms: number) => void;
}
