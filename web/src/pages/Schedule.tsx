import clsx from "clsx";
import { CalendarX, Clock, Info, MapPin } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useDashboard } from "../api/hooks";
import type { ClassSummary } from "../api/types";
import { prettyClassName } from "../components/ClassBits";
import { EmptyState, ErrorState, Freshness, PageHeader, SkeletonCard } from "../components/ui";
import { classColorVars } from "../lib/colors";
import { formatDate } from "../lib/format";
import { APPROX_START_TIMES, DAYS, SHIFTS, blockTimeRange, blocksForDay, sigaaDay, type ScheduledBlock } from "../lib/schedule";

function BlockChip({ block, showLocation = true }: { block: ScheduledBlock; showLocation?: boolean }) {
  return (
    <Link
      to={`/turmas/${block.cls.id}`}
      style={classColorVars(block.cls.name)}
      className="class-fill block rounded-md px-2.5 py-2 transition-[filter] hover:brightness-[0.97]"
    >
      <p className="line-clamp-2 text-[0.8rem] leading-snug font-semibold">{prettyClassName(block.cls.name)}</p>
      <p className="mt-1 flex items-center gap-1 text-[0.7rem] opacity-80 tabular">
        <Clock className="size-3" />
        {blockTimeRange(block.shift, block.indexes) ?? `${block.indexes.join("ª, ")}ª aula`}
      </p>
      {showLocation && block.cls.location && (
        <p className="mt-0.5 flex items-center gap-1 truncate text-[0.7rem] opacity-80">
          <MapPin className="size-3 shrink-0" />
          {block.cls.location}
        </p>
      )}
    </Link>
  );
}

function WeekGrid({ classes }: { classes: ClassSummary[] }) {
  const today = sigaaDay(new Date());
  const usedShifts = SHIFTS.filter((s) => classes.some((c) => c.slots.some((sl) => sl.shift === s.key)));
  const days = DAYS.filter((d) => d.code !== 7 || classes.some((c) => c.slots.some((s) => s.day === 7)));

  return (
    <div className="card hidden p-1.5 md:block">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `6.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d.code} className="px-1.5 py-1.5 text-sm">
            <span className={clsx("inline-flex h-7 items-center rounded-md px-2", d.code === today ? "bg-fg font-semibold text-surface" : "font-medium text-muted")}>
              {d.long}
              {d.code === today && <span className="sr-only"> (hoje)</span>}
            </span>
          </div>
        ))}
        {usedShifts.map((s) => (
          <div key={s.key} className="contents">
            <div className="px-3 py-3">
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-[0.7rem] text-subtle tabular">a partir de {APPROX_START_TIMES[s.key][0]}</p>
            </div>
            {days.map((d) => {
              const blocks = blocksForDay(classes, d.code).filter((b) => b.shift === s.key);
              return (
                <div key={d.code} className="min-h-24 space-y-1.5 rounded-md bg-surface-2 p-1">
                  {blocks.map((b) => (
                    <BlockChip key={b.cls.id} block={b} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayList({ classes }: { classes: ClassSummary[] }) {
  const todayCode = sigaaDay(new Date());
  const [day, setDay] = useState(todayCode >= 2 && todayCode <= 7 ? todayCode : 2);
  const blocks = blocksForDay(classes, day);
  return (
    <div className="md:hidden">
      <div role="tablist" aria-label="Dia da semana" className="mb-4 grid grid-cols-6 gap-1 rounded-[0.625rem] bg-surface-2 p-1">
        {DAYS.map((d) => {
          const has = blocksForDay(classes, d.code).length > 0;
          return (
            <button
              key={d.code}
              role="tab"
              aria-selected={day === d.code}
              onClick={() => setDay(d.code)}
              className={clsx(
                "relative flex flex-col items-center rounded-lg py-2 text-xs font-semibold transition-colors",
                day === d.code ? "bg-surface text-fg shadow-soft" : "text-muted hover:text-fg",
              )}
            >
              {d.short}
              <span className={clsx("mt-1 size-1 rounded-full", has ? "bg-brand" : "bg-transparent")} />
              {d.code === todayCode && <span className="sr-only">(hoje)</span>}
            </button>
          );
        })}
      </div>
      {blocks.length ? (
        <div className="space-y-3">
          {blocks.map((b) => (
            <div key={`${b.cls.id}-${b.shift}`}>
              <p className="mb-1.5 text-xs font-semibold text-muted">{SHIFTS.find((s) => s.key === b.shift)?.label}</p>
              <BlockChip block={b} />
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState icon={CalendarX} title="Sem aulas neste dia" />
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const q = useDashboard();
  if (q.isPending) return <SkeletonCard lines={8} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const classes = q.data.data.classes;

  return (
    <div className="animate-in">
      <PageHeader
        title="Horários"
        subtitle={`Semestre ${q.data.data.profile.currentPeriod}`}
        crumbs={[{ label: "Portal do Discente", to: "/" }, { label: "Ensino" }, { label: "Horários" }]}
        actions={<Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />}
      />
      {classes.length === 0 ? (
        <div className="card">
          <EmptyState icon={CalendarX} title="Nenhuma turma neste semestre" />
        </div>
      ) : (
        <>
          <WeekGrid classes={classes} />
          <DayList classes={classes} />

          <section className="mt-6 grid gap-3 sm:grid-cols-2">
            {classes.map((c) => (
              <Link key={c.id} to={`/turmas/${c.id}`} className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-2" style={classColorVars(c.name)}>
                <span className="class-tile shrink-0 rounded-md px-2 py-1 font-mono text-xs font-bold">{c.schedule}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{prettyClassName(c.name)}</p>
                  <p className="truncate text-xs text-muted">
                    {c.location}
                    {c.startDate && ` · ${formatDate(c.startDate)} a ${formatDate(c.endDate)}`}
                  </p>
                </div>
              </Link>
            ))}
          </section>

          <p className="mt-5 flex items-start gap-2 text-xs text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Horários aproximados: o SIGAA informa só o código (ex.: <code className="font-mono">3N1234</code> = terça, noite, 1ª a 4ª aula). Os horários de relógio são
              uma estimativa com aulas de 50 minutos.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
