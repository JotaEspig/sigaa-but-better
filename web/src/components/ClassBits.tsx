import clsx from "clsx";
import { classColorVars } from "../lib/colors";
import { titleCase } from "../lib/format";

/** Small colored dot identifying a class consistently across pages. */
export function ClassDot({ name, className }: { name: string; className?: string }) {
  return <span aria-hidden className={clsx("class-dot inline-block size-2.5 shrink-0 rounded-full", className)} style={classColorVars(name)} />;
}

/** SIGAA names come in caps ("COMPUTAÇÃO GRÁFICA (2026.2)"); show them in title case without the period suffix. */
export function prettyClassName(name: string): string {
  return titleCase(name.replace(/\s*\(\d{4}\.\d\)\s*$/, ""));
}

/** Two-letter tile label: "Computação Gráfica" → "CG", "Compiladores" → "CO". */
export function classInitials(name: string): string {
  const words = prettyClassName(name)
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}
