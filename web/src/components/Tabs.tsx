import clsx from "clsx";
import { useRef, type ComponentType, type KeyboardEvent } from "react";

export interface TabDef<K extends string> {
  key: K;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

/** WAI-ARIA tablist with arrow/Home/End navigation. Panels are rendered by the caller. */
export function Tabs<K extends string>({ tabs, value, onChange, idPrefix }: { tabs: TabDef<K>[]; value: K; onChange: (k: K) => void; idPrefix: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    let next: number;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    const t = tabs[next];
    if (t) {
      onChange(t.key);
      refs.current[next]?.focus();
    }
  };

  return (
    <div role="tablist" aria-label="Seções da turma" className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {tabs.map((t, i) => {
        const active = t.key === value;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${idPrefix}-tab-${t.key}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${t.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={clsx(
              "relative -mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {Icon && <Icon className="size-4" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
