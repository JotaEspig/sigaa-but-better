import clsx from "clsx";
import { ArrowRight, BookOpen, ChevronRight, Clock, History, MapPin } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useDashboard, usePastClasses } from "../api/hooks";
import { ClassDot, prettyClassName } from "../components/ClassBits";
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

/** "Este semestre" / "Anteriores": both are routes so the browser back button works. */
function ClassTabs() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/turmas", label: "Este semestre", icon: BookOpen },
    { to: "/turmas/anteriores", label: "Anteriores", icon: History },
  ];
  return (
    <nav aria-label="Turmas" className="mb-5 flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          aria-current={pathname === t.to ? "page" : undefined}
          className={clsx(
            "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === t.to ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          <t.icon className="size-4" />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function PastClassesPage() {
  const q = usePastClasses();
  const [filter, setFilter] = useState("");
  const crumbs = [{ label: "Portal do Discente", to: "/" }, { label: "Turmas virtuais", to: "/turmas" }];
  const header = (
    <PageHeader
      title="Turmas anteriores"
      subtitle="Todas as turmas que você já cursou"
      crumbs={crumbs}
      actions={q.data && <Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />}
    />
  );
  if (q.isPending)
    return (
      <div>
        {header}
        <ClassTabs />
        <SkeletonCard lines={8} />
      </div>
    );
  if (q.isError)
    return (
      <div>
        {header}
        <ClassTabs />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </div>
    );

  const f = filter.trim().toLocaleLowerCase("pt-BR");
  const rows = q.data.data.filter((c) => !f || `${c.code} ${c.name}`.toLocaleLowerCase("pt-BR").includes(f));
  const byPeriod = new Map<string, typeof rows>();
  for (const c of rows) byPeriod.set(c.period, [...(byPeriod.get(c.period) ?? []), c]);

  return (
    <div className="animate-in">
      {header}
      <ClassTabs />
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar por código ou nome"
        aria-label="Filtrar turmas"
        className="mb-5 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand sm:max-w-sm"
      />
      {rows.length === 0 && <EmptyState icon={History} title="Nenhuma turma encontrada" className="card" />}
      <div className="space-y-6">
        {[...byPeriod.entries()].map(([period, classes]) => (
          <section key={period} aria-labelledby={`p-${period}`}>
            <h2 id={`p-${period}`} className="mb-2 text-sm font-semibold text-muted tabular">
              {period} <span className="font-normal text-subtle">· {classes.length} {classes.length === 1 ? "turma" : "turmas"}</span>
            </h2>
            <ul className="card divide-y divide-line">
              {classes.map((c) => (
                <li key={c.id}>
                  <Link to={`/turmas/${c.id}`} style={classColorVars(c.name)} className="group flex items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                    <span className="class-chip shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[0.7rem] font-bold">{c.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium group-hover:text-brand-strong">{prettyClassName(c.name)}</span>
                      <span className="block text-xs text-muted">
                        Turma {c.group} · {c.workloadHours}h{c.schedule && ` · ${c.schedule}`}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-subtle group-hover:text-brand-strong" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
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
      <ClassTabs />
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
              className="card group p-5 transition-colors hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ClassDot name={c.name} className="size-2.5!" />
                  <h2 className="text-base leading-snug font-semibold tracking-tight">{prettyClassName(c.name)}</h2>
                </div>
                <ArrowRight className="mt-1 size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
              </div>
              <dl className="mt-4 space-y-1.5 text-sm text-muted">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0" />
                  <dt className="sr-only">Horário</dt>
                  <dd>
                    {describeSchedule(c)} <span className="class-tile ml-1 rounded px-1.5 py-0.5 font-mono text-[0.7rem] font-bold">{c.schedule}</span>
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
