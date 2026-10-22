import { ArrowRight, BookOpen, Clock, MapPin } from "lucide-react";
import { Link } from "react-router";
import { useDashboard } from "../api/hooks";
import { prettyClassName } from "../components/ClassBits";
import { EmptyState, ErrorState, Freshness, PageHeader, SkeletonCard } from "../components/ui";
import { classColorVars } from "../lib/colors";
import { formatDate } from "../lib/format";
import { DAYS, SHIFTS } from "../lib/schedule";
import type { ClassSummary } from "../api/types";

/** "Terça · Noite" from the slots. */
function describeSchedule(c: ClassSummary): string {
  const pairs = new Map<string, true>();
  for (const s of c.slots) {
    const day = DAYS.find((d) => d.code === s.day)?.long ?? "";
    const shift = SHIFTS.find((x) => x.key === s.shift)?.label ?? "";
    pairs.set(`${day} · ${shift}`, true);
  }
  return [...pairs.keys()].join(", ") || c.schedule;
}

export default function ClassesPage() {
  const q = useDashboard();
  if (q.isPending)
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} lines={3} />
        ))}
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { classes, profile } = q.data.data;

  return (
    <div className="animate-in">
      <PageHeader
        title="Turmas virtuais"
        subtitle={`Semestre ${profile.currentPeriod}`}
        crumbs={[{ label: "Portal do Discente", to: "/" }, { label: "Turmas virtuais" }]}
        actions={<Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />}
      />
      {classes.length === 0 ? (
        <div className="card">
          <EmptyState icon={BookOpen} title="Nenhuma turma neste semestre" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <Link
              key={c.id}
              to={`/turmas/${c.id}`}
              style={classColorVars(c.name)}
              className="card group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <span aria-hidden className="class-bar absolute inset-y-0 left-0 w-1.5" />
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg leading-snug font-semibold tracking-tight group-hover:text-brand-strong">{prettyClassName(c.name)}</h2>
                <ArrowRight className="mt-1 size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-strong" />
              </div>
              <dl className="mt-4 space-y-1.5 text-sm text-muted">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0" />
                  <dt className="sr-only">Horário</dt>
                  <dd>
                    {describeSchedule(c)} <span className="class-chip ml-1 rounded px-1.5 py-0.5 font-mono text-[0.7rem] font-bold">{c.schedule}</span>
                  </dd>
                </div>
                {c.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0" />
                    <dt className="sr-only">Local</dt>
                    <dd>{c.location}</dd>
                  </div>
                )}
              </dl>
              {c.startDate && (
                <p className="mt-4 text-xs text-subtle">
                  {formatDate(c.startDate)} – {formatDate(c.endDate)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
