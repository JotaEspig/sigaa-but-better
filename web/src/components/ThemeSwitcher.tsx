import clsx from "clsx";
import { Check, Monitor, Moon, Palette as PaletteIcon, Sun } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { PALETTES, useTheme, type Palette, type ThemeChoice } from "../lib/theme";
import { Dialog } from "./Dialog";

const THEMES: { key: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { key: "system", label: "Sistema", icon: Monitor },
  { key: "light", label: "Claro", icon: Sun },
  { key: "dark", label: "Escuro", icon: Moon },
];

/** Sistema · Claro · Escuro, plus a button that opens the extra palettes. */
export function ThemeSwitcher({ compact, onBar }: { compact?: boolean; onBar?: boolean }) {
  const { choice, palette, setChoice } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const itemClass = (active: boolean) =>
    clsx(
      "flex flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
      compact ? "size-7" : "h-7 px-2",
      onBar
        ? active
          ? "bg-bar-active text-bar-fg"
          : "text-bar-fg/70 hover:text-bar-fg"
        : active
          ? "bg-surface text-fg shadow-soft"
          : "text-muted hover:text-fg",
    );

  return (
    <div className={clsx("flex rounded-lg p-0.5", onBar ? "bg-bar-tint" : "border border-line bg-surface-2")}>
      <div role="radiogroup" aria-label="Tema" className="flex flex-[3]">
        {THEMES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={choice === key}
            aria-label={`Tema ${label.toLowerCase()}`}
            title={label}
            onClick={() => setChoice(key)}
            className={itemClass(choice === key)}
          >
            <Icon className="size-3.5" />
            {!compact && <span>{label}</span>}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={palette ? `Mais temas (atual: ${palette.label})` : "Mais temas"}
        title={palette ? `Mais temas · ${palette.label}` : "Mais temas"}
        onClick={() => setPickerOpen(true)}
        className={clsx(itemClass(!!palette), "flex-[1]")}
      >
        <PaletteIcon className="size-3.5" />
        {!compact && <span>Mais</span>}
      </button>
      {/* Portal: keep the dialog out of the top bar's text color and font size. */}
      {createPortal(<ThemePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />, document.body)}
    </div>
  );
}

const GROUPS: { label: string; scheme: Palette["scheme"] }[] = [
  { label: "Escuros", scheme: "dark" },
  { label: "Claros", scheme: "light" },
];

function ThemePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { palette, setChoice } = useTheme();
  return (
    <Dialog open={open} onClose={onClose} title="Mais temas">
      <p className="text-sm text-muted">
        Paletas inspiradas em temas populares. Para voltar ao visual padrão, escolha Sistema, Claro ou Escuro.
      </p>
      {GROUPS.map((g) => (
        <section key={g.scheme} className="mt-5">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{g.label}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PALETTES.filter((p) => p.scheme === g.scheme).map((p) => (
              <li key={p.id}>
                <PaletteCard
                  palette={p}
                  active={palette?.id === p.id}
                  onSelect={() => {
                    setChoice(p.id);
                    onClose();
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Dialog>
  );
}

/** A miniature of the app, painted with the palette's own tokens via data-palette. */
function PaletteCard({ palette, active, onSelect }: { palette: Palette; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={clsx(
        "group w-full rounded-xl border p-1.5 text-left transition-colors",
        active ? "border-brand ring-2 ring-brand/40" : "border-line hover:border-line-strong",
      )}
    >
      <span data-palette={palette.id} className="block overflow-hidden rounded-lg border border-line bg-bg" aria-hidden>
        <span className="flex h-3.5 items-center gap-1 bg-bar px-1.5">
          <span className="size-1.5 rounded-full bg-bar-fg" />
          <span className="h-1 w-6 rounded-full bg-bar-fg/60" />
        </span>
        <span className="block p-1.5">
          <span className="block rounded-md border border-line bg-surface p-1.5">
            <span className="block h-1.5 w-3/4 rounded-full bg-fg" />
            <span className="mt-1 block h-1 w-1/2 rounded-full bg-muted" />
            <span className="mt-1.5 flex items-center gap-1">
              <span className="h-2.5 w-7 rounded bg-brand" />
              <span className="size-2 rounded-full bg-success" />
              <span className="size-2 rounded-full bg-warning" />
              <span className="size-2 rounded-full bg-danger" />
              <span className="size-2 rounded-full bg-info" />
            </span>
          </span>
        </span>
      </span>
      <span className="mt-1.5 flex items-start justify-between gap-1 px-0.5">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{palette.label}</span>
          <span className="block truncate text-xs text-muted">{palette.hint}</span>
        </span>
        {active && <Check className="mt-0.5 size-4 shrink-0 text-brand" />}
      </span>
    </button>
  );
}
