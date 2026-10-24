import clsx from "clsx";
import { ChevronDown, GraduationCap } from "lucide-react";
import { useState } from "react";
import { useDashboard, useGrades } from "../api/hooks";
import type { GradeRow, GradeSemester } from "../api/types";
import { prettyClassName } from "../components/ClassBits";
import { Badge, EmptyState, ErrorState, Freshness, PageHeader, SkeletonCard } from "../components/ui";
import { normalizeClassName, useClassStats, type ClassStats } from "../lib/classStats";
import { LOW_GRADE, situationTone } from "../lib/colors";
import { formatGrade } from "../lib/format";

function semesterAverage(s: GradeSemester): number | null {
  const results = s.rows.map((r) => r.result).filter((v): v is number => v !== null);
  return results.length ? results.reduce((a, b) => a + b, 0) / results.length : null;
}

/** Bar chart of the average final grade per semester (pure SVG). */
function AverageChart({ semesters }: { semesters: GradeSemester[] }) {
  const points = [...semesters]
    .reverse()
    .map((s) => ({ period: s.period, avg: semesterAverage(s) }))
    .filter((p): p is { period: string; avg: number } => p.avg !== null);
  if (points.length < 2) return null;

  const W = 640;
  const H = 150;
  const pad = { l: 8, r: 8, t: 22, b: 24 };
  const bw = (W - pad.l - pad.r) / points.length;
  const min = 5;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (Math.max(v, min) - min) / (10 - min));
  const overall = points.reduce((a, p) => a + p.avg, 0) / points.length;

  return (
    <section className="card mb-6 p-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Média por semestre</h2>
        <p className="text-xs text-muted">
          Média geral <span className="font-semibold text-fg tabular">{formatGrade(overall)}</span>
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Médias: ${points.map((p) => `${p.period} ${formatGrade(p.avg)}`).join(", ")}`}>
        {[6, 8, 10].map((g) => (
          <line key={g} x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray="3 4" />
        ))}
        {points.map((p, i) => {
          const x = pad.l + i * bw + bw * 0.22;
          const w = bw * 0.56;
          const top = y(p.avg);
          return (
            <g key={p.period}>
              <rect x={x} y={top} width={w} height={H - pad.b - top} rx={6} fill={i === points.length - 1 ? "var(--brand)" : "var(--brand-soft)"} />
              <text x={x + w / 2} y={top - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--fg)">
                {formatGrade(p.avg)}
              </text>
              <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {p.period}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function GradeCell({ value, strong }: { value: number | null; strong?: boolean }) {
  return (
    <td className={clsx("px-3 py-3 text-right tabular", value === null && "text-subtle", strong && "font-semibold", value !== null && value < LOW_GRADE && "text-danger")}>
      {formatGrade(value)}
    </td>
  );
}

/** What the class pages know for this semester's open classes, keyed by normalized name. */
type Live = Map<string, ClassStats>;

function liveFor(live: Live | undefined, r: GradeRow) {
  const st = live?.get(normalizeClassName(r.name));
  return {
    absences: st ? (st.loading ? null : st.absences) : r.absences,
    // Only while SIGAA has no final result: the partial average from released assessments.
    partial: r.result === null && st && !st.loading ? st.average : null,
  };
}

function SemesterTable({ s, live }: { s: GradeSemester; live?: Live }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="px-3 py-2 text-left font-medium">Disciplina</th>
              {s.unitLabels.map((l) => (
                <th key={l} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  {l}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Rec.</th>
              <th className="px-3 py-2 text-right font-medium">Final</th>
              <th className="px-3 py-2 text-right font-medium">Faltas</th>
              <th className="px-3 py-2 text-right font-medium">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {s.rows.map((r) => (
              <tr key={r.code} className="hover:bg-surface-2">
                <td className="px-3 py-3">
                  <p className="font-medium">{prettyClassName(r.name)}</p>
                  <p className="font-mono text-xs text-subtle">{r.code}</p>
                </td>
                {s.unitLabels.map((l, i) => (
                  <GradeCell key={l} value={r.units[i] ?? null} />
                ))}
                <GradeCell value={r.recovery} />
                {liveFor(live, r).partial != null ? (
                  <td className="px-3 py-3 text-right text-muted tabular" title="Média parcial das avaliações já lançadas, ainda não é a nota final">
                    ~{formatGrade(liveFor(live, r).partial)}
                  </td>
                ) : (
                  <GradeCell value={r.result} strong />
                )}
                <td className="px-3 py-3 text-right text-muted tabular">{liveFor(live, r).absences ?? "–"}</td>
                <td className="px-3 py-3 text-right">
                  <Situation row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-line-soft md:hidden">
        {s.rows.map((r) => (
          <li key={r.code} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{prettyClassName(r.name)}</p>
                <p className="font-mono text-[0.7rem] text-subtle">{r.code}</p>
              </div>
              <span className={clsx("text-xl font-bold tracking-tight tabular", r.result === null && "text-subtle", r.result !== null && r.result < LOW_GRADE && "text-danger")}>
                {formatGrade(r.result)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {s.unitLabels.map((l, i) => (
                <span key={l}>
                  {l.replace("Unidade", "U")}: <span className="font-medium text-fg tabular">{formatGrade(r.units[i] ?? null)}</span>
                </span>
              ))}
              {r.recovery !== null && (
                <span>
                  Rec.: <span className="font-medium text-fg tabular">{formatGrade(r.recovery)}</span>
                </span>
              )}
              {liveFor(live, r).partial != null && (
                <span>
                  Parcial: <span className="font-medium text-fg tabular">~{formatGrade(liveFor(live, r).partial)}</span>
                </span>
              )}
              <span>{liveFor(live, r).absences ?? "–"} faltas</span>
              <span className="ml-auto">
                <Situation row={r} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Situation({ row }: { row: GradeRow }) {
  const s = row.situation.trim();
  const tone = situationTone(s);
  return <Badge tone={tone}>{!s || s === "--" ? "Em curso" : s === "REC" ? "Recuperação" : s.charAt(0) + s.slice(1).toLowerCase()}</Badge>;
}

export default function GradesPage() {
  const q = useGrades();
  // The report only fills absences and averages once a unit closes; the class pages have them now.
  const dashboard = useDashboard();
  const stats = useClassStats(dashboard.data?.data.classes ?? []);
  const live: Live = new Map(
    (dashboard.data?.data.classes ?? []).flatMap((c) => {
      const st = stats.get(c.id);
      return st ? [[normalizeClassName(c.name), st] as const] : [];
    }),
  );
  const currentPeriod = dashboard.data?.data.profile.currentPeriod;
  const [open, setOpen] = useState<Set<string> | null>(null);

  if (q.isPending)
    return (
      <div className="space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={6} />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const semesters = q.data.data.semesters;
  // First (most recent) semester open by default.
  const openSet = open ?? new Set(semesters.slice(0, 1).map((s) => s.period));
  const toggle = (p: string) => {
    const next = new Set(openSet);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setOpen(next);
  };

  return (
    <div className="animate-in">
      <PageHeader title="Minhas notas" subtitle="Boletim de todos os semestres" crumbs={[{ label: "Portal do Discente", to: "/" }, { label: "Ensino" }, { label: "Minhas notas" }]} actions={<Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />} />
      {semesters.length === 0 ? (
        <div className="card">
          <EmptyState icon={GraduationCap} title="Nenhuma nota ainda" />
        </div>
      ) : (
        <>
          <AverageChart semesters={semesters} />
          <div className="space-y-3">
            {semesters.map((s) => {
              const isOpen = openSet.has(s.period);
              const avg = semesterAverage(s);
              const panelId = `sem-${s.period}`;
              return (
                <section key={s.period} className="card overflow-hidden">
                  <h2>
                    <button
                      type="button"
                      onClick={() => toggle(s.period)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-surface-2"
                    >
                      <span className="text-base font-semibold tabular">{s.period}</span>
                      <span className="text-xs text-muted">
                        {s.rows.length} {s.rows.length === 1 ? "disciplina" : "disciplinas"}
                      </span>
                      {avg !== null && (
                        <span className="ml-auto text-xs text-muted">
                          média <span className="font-semibold text-fg tabular">{formatGrade(avg)}</span>
                        </span>
                      )}
                      <ChevronDown className={clsx("size-4 shrink-0 text-muted transition-transform", avg === null && "ml-auto", isOpen && "rotate-180")} />
                    </button>
                  </h2>
                  {isOpen && (
                    <div id={panelId} className="border-t border-line">
                      <SemesterTable s={s} live={s.period === currentPeriod ? live : undefined} />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
