import { useQueries, useQueryClient } from "@tanstack/react-query";
import { request } from "../api/client";
import { keys, useGrades } from "../api/hooks";
import type { Activity, ClassGrades, ClassStatus, ClassSummary, Envelope, GradeRow } from "../api/types";
import { prettyClassName } from "../components/ClassBits";
import { parseLocal } from "./format";
import { toISODay } from "./schedule";

/** "COMPILADORES (2026.2)" and "COMPILADORES" match. */
export const normalizeClassName = (name: string) => prettyClassName(name).toLocaleLowerCase("pt-BR");

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** From the grades report: the final result, else the mean of the unit totals so far. */
function reportAverage(row: GradeRow | undefined): number | null {
  if (!row) return null;
  if (row.result !== null) return row.result;
  return mean(row.units.filter((u): u is number => u !== null));
}

/**
 * From the class's own grades page, which has every assessment: the final
 * result, else per unit the published total or, while the unit is open, the
 * weighted mean of the assessments released so far.
 */
export function classAverage(g: ClassGrades): number | null {
  if (!g.published) return null;
  if (g.result !== null) return g.result;
  const groups = new Map<string, ClassGrades["assessments"]>();
  for (const a of g.assessments) groups.set(a.group, [...(groups.get(a.group) ?? []), a]);
  const units: number[] = [];
  for (const items of groups.values()) {
    const total = items.find((a) => a.isUnitTotal && a.value !== null);
    if (total?.value != null) {
      units.push(total.value);
      continue;
    }
    const released = items.filter((a) => !a.isUnitTotal && a.value !== null);
    const weights = released.map((a) => Number((a.weight ?? "").replace(",", ".")));
    const weighted = weights.every((w) => w > 0);
    const sumW = weighted ? weights.reduce((a, b) => a + b, 0) : released.length;
    if (sumW > 0) units.push(released.reduce((s, a, i) => s + (a.value ?? 0) * (weighted ? (weights[i] ?? 1) : 1), 0) / sumW);
  }
  return mean(units);
}

export interface AbsenceLimit {
  max: number;
  exact: boolean;
}

/**
 * Absence limit (25% of the workload). The exact number comes from the class's
 * attendance page; until it loads (or if it fails) it is estimated from the
 * weekly slots × weeks in the period.
 */
function absenceLimit(c: ClassSummary, status: ClassStatus | undefined): AbsenceLimit | null {
  if (status) return { max: status.attendance.maxAbsences, exact: true };
  const start = parseLocal(c.startDate);
  const end = parseLocal(c.endDate);
  if (!start || !end || !c.slots.length) return null;
  const weeks = Math.round((end.getTime() - start.getTime()) / (7 * 864e5));
  return weeks > 0 ? { max: Math.floor(c.slots.length * weeks * 0.25), exact: false } : null;
}

export interface ClassStats {
  average: number | null;
  absences: number | null;
  limit: AbsenceLimit | null;
  /** At or past 75% of the absence limit. */
  atRisk: boolean;
  /** The class page data is still loading. */
  loading: boolean;
  /** Upcoming assessments from the class's Avaliações page, as activities. */
  upcoming: Activity[];
}

/** Share of the absence limit at which a class is flagged. */
export const RISK_RATIO = 0.75;

const statusKey = (id: string) => keys.classPart(id, "status");

/**
 * One /status request per class (attendance, grades and assessments in a
 * single turma visit), one class at a time: turma requests serialize on the
 * server, so firing them all at once would make a click into a class wait
 * behind the whole batch. Each response also seeds the class page's own
 * queries, so opening a class afterwards is instant.
 *
 * The portal alone is not enough: the grades report only fills absences and
 * averages once a unit is closed, and "Minhas atividades" only lists the next
 * couple of weeks.
 */
function useStatuses(classes: ClassSummary[]) {
  const qc = useQueryClient();
  // useQueries re-renders when any of these settles, which enables the next one.
  const settled = (c: ClassSummary) => {
    const status = qc.getQueryState(statusKey(c.id))?.status;
    return status === "success" || status === "error";
  };
  return useQueries({
    queries: classes.map((c, i) => ({
      queryKey: statusKey(c.id),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const env = await request<ClassStatus>(`/api/classes/${encodeURIComponent(c.id)}/status`, { signal });
        const seed = <T,>(part: string, data: T) => qc.setQueryData<Envelope<T>>(keys.classPart(c.id, part), { data, fetchedAt: env.fetchedAt });
        seed("attendance", env.data.attendance);
        seed("grades", env.data.grades);
        seed("evaluations", env.data.evaluations);
        return env;
      },
      enabled: classes.slice(0, i).every(settled),
      staleTime: 5 * 60_000,
      retry: 1,
    })),
  });
}

export function useClassStats(classes: ClassSummary[]): Map<string, ClassStats> {
  const grades = useGrades();
  const statuses = useStatuses(classes);
  const current = grades.data?.data.semesters[0];
  const rows = new Map((current?.rows ?? []).map((r) => [normalizeClassName(r.name), r]));
  const today = toISODay(new Date());
  return new Map(
    classes.map((c, i) => {
      const row = rows.get(normalizeClassName(c.name));
      const q = statuses[i];
      const status = q?.data?.data;
      // While loading, show nothing rather than the report's misleading zeros.
      const loading = !!q?.isPending;
      const absences = status ? status.attendance.totalAbsences : loading ? null : (row?.absences ?? null);
      const limit = absenceLimit(c, status);
      const atRisk = !!limit && absences !== null && limit.max > 0 && absences / limit.max >= RISK_RATIO;
      const average = status ? (classAverage(status.grades) ?? reportAverage(row)) : reportAverage(row);
      const upcoming = (status?.evaluations ?? [])
        .filter((e) => e.date >= today)
        .map((e): Activity => ({ date: e.date, className: c.name, kind: "Avaliação", title: e.description, past: false }));
      return [c.id, { average, absences, limit, atRisk, loading, upcoming }];
    }),
  );
}

/**
 * Portal activities plus each class's assessments, soonest first. The same
 * assessment often shows up in both (same class and day): keep the portal's.
 */
export function mergeUpcoming(portal: Activity[], stats: Map<string, ClassStats>): Activity[] {
  const seen = new Set<string>();
  const out: Activity[] = [];
  const key = (a: Activity) => `${normalizeClassName(a.className)}|${a.date.slice(0, 10)}`;
  for (const a of [...portal.filter((a) => !a.past), ...[...stats.values()].flatMap((s) => s.upcoming)]) {
    if (seen.has(key(a))) continue;
    seen.add(key(a));
    out.push(a);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
