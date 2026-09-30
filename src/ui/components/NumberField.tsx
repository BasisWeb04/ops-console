import { useEffect, useId, useState } from "react";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onCommit: (value: number) => void;
}

/** Keeps the typed text locally and only commits values in range, so a half-typed number never reaches the rules. */
export function NumberField({ label, value, min, max, step = 1, suffix, onCommit }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(String(value));
    setError(null);
  }, [value]);

  function handle(text: string) {
    setDraft(text);
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n) || n < min || n > max) {
      setError(`Enter a number from ${min} to ${max}`);
      return;
    }
    setError(null);
    onCommit(n);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-stone-700 dark:text-stone-300">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft}
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => handle(e.target.value)}
          className="tabular w-28 rounded border border-stone-300 bg-white px-2 py-1 text-sm aria-invalid:border-red-700 dark:border-stone-700 dark:bg-stone-950 dark:aria-invalid:border-red-400"
        />
        {suffix && <span className="text-xs text-stone-600 dark:text-stone-400">{suffix}</span>}
      </div>
      {error && (
        <span id={`${id}-err`} className="text-xs text-red-700 dark:text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}
