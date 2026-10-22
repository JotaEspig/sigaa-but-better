import type { ClassSummary, Slot } from "../api/types";

export type Shift = Slot["shift"];

export const SHIFTS: { key: Shift; label: string }[] = [
  { key: "M", label: "Manhã" },
  { key: "T", label: "Tarde" },
  { key: "N", label: "Noite" },
];

/** SIGAA day codes: 2 = segunda … 7 = sábado. */
export const DAYS: { code: number; short: string; long: string }[] = [
  { code: 2, short: "Seg", long: "Segunda" },
  { code: 3, short: "Ter", long: "Terça" },
  { code: 4, short: "Qua", long: "Quarta" },
  { code: 5, short: "Qui", long: "Quinta" },
  { code: 6, short: "Sex", long: "Sexta" },
  { code: 7, short: "Sáb", long: "Sábado" },
];

/**
 * Horários aproximados de início de cada aula (50 min). O SIGAA não informa
 * horários de relógio no portal; ajuste aqui se o seu campus usar outra grade.
 */
export const APPROX_START_TIMES: Record<Shift, string[]> = {
  M: ["07:30", "08:20", "09:20", "10:10", "11:00", "11:50"],
  T: ["13:30", "14:20", "15:20", "16:10", "17:00", "17:50"],
  N: ["18:30", "19:20", "20:20", "21:10", "22:00"],
};

export function approxTime(shift: Shift, index: number): string | undefined {
  return APPROX_START_TIMES[shift][index - 1];
}

/** JS Date → SIGAA day code (domingo = 1). */
export function sigaaDay(d: Date): number {
  return d.getDay() + 1;
}

export interface ScheduledBlock {
  cls: ClassSummary;
  shift: Shift;
  indexes: number[];
}

/** Groups a class's slots on a given day into contiguous shift blocks. */
export function blocksForDay(classes: ClassSummary[], day: number): ScheduledBlock[] {
  const blocks: ScheduledBlock[] = [];
  for (const cls of classes) {
    for (const shift of SHIFTS.map((s) => s.key)) {
      const indexes = cls.slots
        .filter((s) => s.day === day && s.shift === shift)
        .map((s) => s.index)
        .sort((a, b) => a - b);
      if (indexes.length) blocks.push({ cls, shift, indexes });
    }
  }
  const order: Record<Shift, number> = { M: 0, T: 1, N: 2 };
  return blocks.sort((a, b) => order[a.shift] - order[b.shift] || (a.indexes[0] ?? 0) - (b.indexes[0] ?? 0));
}

/** "18:30 – 21:50" using the approximate table (end = last start + 50 min). */
export function blockTimeRange(shift: Shift, indexes: number[]): string | undefined {
  const first = indexes[0];
  const last = indexes[indexes.length - 1];
  if (first === undefined || last === undefined) return undefined;
  const start = approxTime(shift, first);
  const lastStart = approxTime(shift, last);
  if (!start || !lastStart) return undefined;
  const [h, m] = lastStart.split(":").map(Number) as [number, number];
  const end = h * 60 + m + 50;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${start} – ${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
}

/** Is the class running on `date` (inside its start/end period)? */
export function isWithinPeriod(cls: ClassSummary, isoDay: string): boolean {
  if (!cls.startDate || !cls.endDate) return true;
  return isoDay >= cls.startDate && isoDay <= cls.endDate;
}

export function toISODay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
