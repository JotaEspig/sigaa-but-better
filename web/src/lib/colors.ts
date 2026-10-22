import type { CSSProperties } from "react";

// A stable color per class, derived from its name so it is the same on every
// page (dashboard, schedule grid, class header). Hues avoid pure red, which is
// reserved for danger states.

const HUES = [152, 205, 262, 32, 330, 184, 48, 228, 290, 95];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function classHue(name: string): number {
  return HUES[hash(name) % HUES.length] ?? 152;
}

/** Inline style setting `--c-h`, consumed by the `class-*` utilities in index.css. */
export function classColorVars(name: string): CSSProperties {
  return { "--c-h": String(classHue(name)) } as CSSProperties;
}

export type Tone = "success" | "danger" | "warning" | "neutral" | "info";

/** Maps SIGAA's situação text to a semantic tone. */
export function situationTone(situation: string): Tone {
  const s = situation.trim().toUpperCase();
  if (!s || s === "--" || s === "-") return "neutral";
  if (s.startsWith("APR") || s === "APROVADO POR NOTA" || s.includes("DISPENS") || s.includes("APROVEIT")) return "success";
  if (s.startsWith("REP") || s.includes("REPROV") || s.includes("TRANC") || s.includes("CANCEL")) return "danger";
  if (s === "REC" || s.includes("RECUP")) return "warning";
  if (s.includes("MATRICULADO") || s.includes("CURSANDO")) return "info";
  return "neutral";
}

/**
 * Grades below this are highlighted in red. It is only a visual hint: the
 * official approval rule depends on the course's Organização Didática.
 */
export const LOW_GRADE = 6;
