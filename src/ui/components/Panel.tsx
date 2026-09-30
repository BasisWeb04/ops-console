import type { ReactNode } from "react";

export function Panel({ title, action, children, id }: { title: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-md border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-2.5 dark:border-stone-800">
        <h2 id={id} className="text-sm font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail?: ReactNode; tone?: "neutral" | "bad" }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">{label}</div>
      <div className={`tabular mt-1 text-2xl font-semibold ${tone === "bad" ? "text-red-700 dark:text-red-300" : ""}`}>{value}</div>
      {detail && <div className="tabular mt-1 text-xs text-stone-600 dark:text-stone-400">{detail}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-600 dark:border-stone-700 dark:text-stone-400">{children}</p>;
}

export const TABLE = "w-full min-w-[640px] border-collapse text-left text-sm";
export const TH = "border-b border-stone-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-stone-600 dark:border-stone-800 dark:text-stone-400";
export const TD = "border-b border-stone-100 px-3 py-2 align-top dark:border-stone-800/60";
