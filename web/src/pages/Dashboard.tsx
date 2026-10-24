import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useDashboard } from "../api/hooks";
import type { ClassSummary, Dashboard } from "../api/types";
import { ClassDot, prettyClassName } from "../components/ClassBits";
import { ErrorState, Freshness, PageHeader, ProgressBar, Skeleton } from "../components/ui";
import { useUpdatesMenu } from "../components/Updates";
import { mergeUpcoming, normalizeClassName, useClassStats, type ClassStats } from "../lib/classStats";
import { LOW_GRADE, classColorVars } from "../lib/colors";
import { daysUntil, formatGrade, formatShortDate, initials, parseLocal, relativeDays, titleCase, updateMessage } from "../lib/format";
import { DAYS, SHIFTS, blockTimeRange, blocksForDay, isWithinPeriod, sigaaDay, toISODay, type Shift } from "../lib/schedule";

/** Bordered white panel with a fixed-height header; the dashboard's only container. */
function Panel({ title, count, action, children, className }: { title: string; count?: number; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={clsx("card flex min-w-0 flex-col overflow-hidden", className)}>
      <header className="flex h-13 shrink-0 items-center gap-2 border-b border-line-soft px-5">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">{title}</h2>
        {count !== undefined && <span className="text-sm text-subtle tabular">{count}</span>}
        {action && <div className="ml-auto flex items-center gap-3 text-[0.8125rem] text-muted">{action}</div>}
      </header>
      {children}
    </section>
  );
}

function HeaderLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="transition-colors hover:text-fg">
      {children}
    </Link>
  );
}

/** Due within two days: worth a second look. */
const isUrgent = (date: string) => {
  const d = parseLocal(date);
  return !!d && daysUntil(d) <= 2;
};

/** "Ter 18:30 · Lab D06": first weekly meeting plus room. */
function shortWhen(c: ClassSummary): string {
  const day = DAYS.find((d) => c.slots.some((s) => s.day === d.code));
  const first = day && blocksForDay([c], day.code)[0];
  const time = first ? blockTimeRange(first.shift, first.indexes)?.split(" – ")[0] : undefined;
  return [[day?.short, time].filter(Boolean).join(" "), c.location].filter(Boolean).join(" · ");
}

/** Aulas per meeting day: 3N1234 is 4 aulas every Tuesday night. */
function aulasPerMeeting(c: ClassSummary): number {
  const days = new Set(c.slots.map((s) => s.day)).size;
  return days ? Math.max(1, Math.round(c.slots.length / days)) : 1;
}

/**
 * One square per class meeting the limit allows (18 aulas at 4 per meeting is
 * 4,5 squares, the last one half wide), filled by the meetings missed, so 6
 * absences read as one and a half classes.
 */
function AbsenceMeter({ used, max, perMeeting, risk }: { used: number; max: number; perMeeting: number; risk: boolean }) {
  const total = max / perMeeting;
  const missed = used / perMeeting;
  return (
    <span aria-hidden className="flex h-3 w-full max-w-[9rem] items-center gap-[3px]">
      {Array.from({ length: Math.ceil(total) }, (_, i) => {
        const size = Math.min(1, total - i);
        const fill = Math.max(0, Math.min(size, missed - i)) / size;
        return (
          <span key={i} className="relative h-full overflow-hidden rounded-[2px] bg-tick-empty" style={{ flex: `${size} 1 0`, maxWidth: `${size * 0.75}rem` }}>
            {fill > 0 && <span className={clsx("absolute inset-y-0 left-0", risk ? "bg-danger" : "bg-tick")} style={{ width: `${fill * 100}%` }} />}
          </span>
        );
      })}
    </span>
  );
}

function Attendance({ stats, perMeeting }: { stats: ClassStats | undefined; perMeeting: number }) {
  const { absences = null, limit = null, atRisk = false, loading = false } = stats ?? {};
  if (loading)
    return (
      <div className="flex flex-col gap-1.5" aria-busy="true" aria-label="Carregando frequência">
        <Skeleton className="h-3 w-full max-w-[9rem] rounded-[2px]" />
        <Skeleton className="h-3 w-14 rounded-[2px]" />
      </div>
    );
  if (absences === null) return <span className="text-[0.8125rem] text-subtle">Sem registro</span>;
  if (!limit || limit.max <= 0)
    return (
      <span className="text-xs text-muted tabular">
        {absences} {absences === 1 ? "falta" : "faltas"}
      </span>
    );
  const left = limit.max - absences;
  const approx = limit.exact ? "" : "~";
  return (
    <div className="flex flex-col gap-1.5">
      <AbsenceMeter used={Math.min(absences, limit.max)} max={limit.max} perMeeting={perMeeting} risk={atRisk} />
      <span className={clsx("text-xs tabular", atRisk ? "text-danger" : "text-muted")} title={limit.exact ? undefined : "Limite estimado pela carga semanal"}>
        <span className="sr-only">Faltas: </span>
        {absences} de {approx}
        {limit.max}
        {atRisk && (left > 0 ? ` · faltam ${left}` : " · limite atingido")}
      </span>
    </div>
  );
}

const ROW_COLS = "md:grid-cols-[minmax(0,1fr)_4rem_11rem_10rem]";

function ClassesPanel({ data, stats }: { data: Dashboard; stats: Map<string, ClassStats> }) {
  const next = mergeUpcoming(data.activities, stats);
  const nextFor = (c: ClassSummary) => next.find((a) => normalizeClassName(a.className) === normalizeClassName(c.name));
  return (
    <Panel title="Turmas do semestre" count={data.classes.length} action={<HeaderLink to="/turmas">Ver todas</HeaderLink>}>
      {data.classes.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">Nenhuma turma neste semestre.</p>
      ) : (
        <>
          <div aria-hidden className={clsx("hidden h-9 items-center gap-5 border-b border-line-soft px-5 text-xs text-subtle md:grid", ROW_COLS)}>
            <span>Turma</span>
            <span className="text-right">Média</span>
            <span>Frequência</span>
            <span>Próxima avaliação</span>
          </div>
          <ul className="divide-y divide-line-soft">
            {data.classes.map((c) => {
              const s = stats.get(c.id);
              const avg = s?.average ?? null;
              const ev = nextFor(c);
              return (
                <li key={c.id}>
                  <Link
                    to={`/turmas/${c.id}`}
                    className={clsx(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 px-5 py-3.5 transition-colors md:min-h-16 md:py-2.5",
                      ROW_COLS,
                      s?.atRisk ? "bg-danger/[0.035] hover:bg-danger/[0.06]" : "hover:bg-surface-2",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ClassDot name={c.name} className="rounded-[2px]! size-2!" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{prettyClassName(c.name)}</p>
                        <p className="truncate text-[0.8125rem] text-muted tabular">{shortWhen(c)}</p>
                      </div>
                    </div>
                    <p
                      className={clsx("text-right text-[0.9375rem] font-semibold tabular", avg === null ? "text-subtle" : avg < LOW_GRADE ? "text-danger" : "text-fg")}
                      title={avg === null ? undefined : "Média parcial: resultado final ou média das unidades e avaliações já lançadas"}
                    >
                      <span className="sr-only">Média: </span>
                      {formatGrade(avg)}
                    </p>
                    <div className="min-w-0 pl-5 md:pl-0">
                      <Attendance stats={s} perMeeting={aulasPerMeeting(c)} />
                    </div>
                    <div className="min-w-0 text-right text-[0.8125rem] md:text-left">
                      {ev ? (
                        <>
                          <p className="truncate">
                            <span className="sr-only">Próxima avaliação: </span>
                            {ev.title}
                          </p>
                          <p className={clsx("text-xs", isUrgent(ev.date) ? "text-warning" : "text-muted")}>{relativeDays(ev.date)}</p>
                        </>
                      ) : (
                        <p className="text-subtle">Nada marcado</p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}

const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const month = (d: Date) => monthShort.format(d).replace(".", "");

/** "19 – 24 out", or "29 set – 4 out" across months. */
function weekRange(a: Date, b: Date): string {
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${month(b)}` : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

/** Mon–Sat (Saturday only if some class meets then); afternoon and night always, morning only if used. */
function WeekPanel({ classes }: { classes: ClassSummary[] }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  const dateOf = (code: number) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + code - 2);
  const today = offset === 0 ? sigaaDay(now) : -1;
  const days = DAYS.filter((d) => d.code !== 7 || classes.some((c) => c.slots.some((s) => s.day === 7)));
  const shifts = SHIFTS.filter((s) => s.key !== "M" || classes.some((c) => c.slots.some((sl) => sl.shift === s.key)));
  const first = days[0];
  const last = days[days.length - 1];
  const cols = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };

  const cell = (day: number, shift: Shift) => {
    const iso = toISODay(dateOf(day));
    return blocksForDay(
      classes.filter((c) => isWithinPeriod(c, iso)),
      day,
    ).filter((b) => b.shift === shift);
  };

  const navBtn = "grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg";
  return (
    <Panel
      title="Esta semana"
      action={
        <>
          <button type="button" className={navBtn} onClick={() => setOffset(offset - 1)} aria-label="Semana anterior">
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setOffset(0)}
            disabled={offset === 0}
            title={offset === 0 ? undefined : "Voltar para esta semana"}
            className="min-w-[5.5rem] text-center tabular enabled:hover:text-fg"
          >
            {first && last && weekRange(dateOf(first.code), dateOf(last.code))}
          </button>
          <button type="button" className={navBtn} onClick={() => setOffset(offset + 1)} aria-label="Próxima semana">
            <ChevronRight className="size-4" />
          </button>
        </>
      }
    >
      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div className="grid h-10 items-center border-b border-line-soft" style={cols}>
            <span />
            {days.map((d) => (
              <div key={d.code} className="px-1.5">
                <span
                  className={clsx("inline-flex h-6 items-center rounded-md px-2 text-xs tabular", d.code === today ? "bg-fg font-semibold text-surface" : "text-muted")}
                  aria-current={d.code === today ? "date" : undefined}
                >
                  {d.short} {dateOf(d.code).getDate()}
                </span>
              </div>
            ))}
          </div>
          {shifts.map((s, i) => (
            <div key={s.key} className={clsx("grid min-h-19", i < shifts.length - 1 && "border-b border-line-soft")} style={cols}>
              <div className="pt-3 pl-5 text-xs text-subtle">{s.label}</div>
              {days.map((d) => (
                <div key={d.code} className="flex flex-col gap-1.5 p-1.5">
                  {cell(d.code, s.key).map((b) => (
                    <Link
                      key={b.cls.id}
                      to={`/turmas/${b.cls.id}`}
                      style={classColorVars(b.cls.name)}
                      className="class-fill flex min-w-0 flex-1 flex-col gap-0.5 rounded-[7px] px-2.5 py-2 transition-[filter] hover:brightness-[0.97]"
                    >
                      <span className="truncate text-xs font-medium">{prettyClassName(b.cls.name)}</span>
                      <span className="truncate text-[0.7188rem] text-muted tabular">
                        {[blockTimeRange(b.shift, b.indexes)?.split(" – ")[0], b.cls.location].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-2.5 text-xs text-subtle">
        <span>Horários de relógio aproximados.</span>
        <HeaderLink to="/horarios">Ver horários</HeaderLink>
      </p>
    </Panel>
  );
}

/** "CIÊNCIA DA COMPUTAÇÃO/CAMP/BLUM - BLUMENAU - BACHARELADO - MTN" → "Ciência da Computação · Bacharelado". */
function courseLine(course: string, level: string): string {
  const parts = course.split(" - ").map((p) => p.trim());
  const name = parts[0]?.split("/")[0] ?? course;
  const degree = parts.find((p) => /BACHAREL|LICENCIAT|TECNOL|TÉCNICO/i.test(p)) ?? level;
  return [name, degree].filter(Boolean).map(titleCase).join(" · ");
}

// Indices always with two decimals ("9,20"), like SIGAA's own table.
const index2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const weekdayShort = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

function YouPanel({ data, stats }: { data: Dashboard; stats: Map<string, ClassStats> }) {
  const { profile: pr, progress: p } = data;
  const index = (code: string) => data.indices.find((i) => i.code === code);
  const active = pr.status.trim().toUpperCase() === "ATIVO";
  const next = mergeUpcoming(data.activities, stats).slice(0, 3);
  const news = [...data.updates].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const { setOpen } = useUpdatesMenu();

  const stat = (label: string, value: string, title?: string) => (
    <div className="min-w-0" title={title}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-[1.375rem] leading-tight font-semibold tracking-[-0.03em] tabular">{value}</dd>
    </div>
  );
  const ira = index("IRA");
  const mc = index("MC");

  return (
    <Panel title="Você" action={<HeaderLink to="/progresso">Ver perfil</HeaderLink>}>
      <div className="flex flex-col gap-4.5 border-b border-line-soft px-5 pt-4.5 pb-5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-tick-empty text-sm font-semibold">
            {initials(pr.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{titleCase(pr.name)}</p>
            <p className="line-clamp-2 text-[0.8125rem] leading-snug text-muted">{courseLine(pr.course, pr.level)}</p>
          </div>
          <span
            className={clsx(
              "inline-flex h-5.5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[0.7188rem] font-semibold",
              active ? "bg-success-soft text-success" : "bg-surface-3 text-muted",
            )}
          >
            <span aria-hidden className={clsx("size-1.5 rounded-full", active ? "bg-success" : "bg-subtle")} />
            {titleCase(pr.status)}
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {stat("IRA", ira ? index2.format(ira.value) : "–", ira?.description)}
          {stat("MC", mc ? index2.format(mc.value) : "–", mc?.description)}
          {stat("Concluído", `${Math.floor(p.percent)}%`, "Integralização do curso")}
        </dl>
        <ProgressBar value={p.percent} className="h-1!" label={`${Math.floor(p.percent)}% do curso integralizado`} />
      </div>

      <div className="border-b border-line-soft pt-3.5 pb-2.5">
        <h3 className="px-5 pb-1 text-[0.8125rem] font-semibold">Próximas atividades</h3>
        {next.length ? (
          <ul>
            {next.map((a, i) => {
              const d = parseLocal(a.date);
              return (
                <li key={i} className="flex items-center gap-3.5 px-5 py-2.5">
                  <span className="flex w-9 shrink-0 flex-col items-center leading-tight">
                    <span className="text-[0.6563rem] font-semibold tracking-[0.04em] text-subtle uppercase">{d ? weekdayShort.format(d).replace(".", "") : ""}</span>
                    <span className="text-[1.0625rem] font-semibold tabular">{d ? String(d.getDate()).padStart(2, "0") : formatShortDate(a.date)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="truncate text-xs text-muted">{prettyClassName(a.className)}</p>
                  </div>
                  <span className={clsx("shrink-0 text-xs whitespace-nowrap", isUrgent(a.date) ? "text-warning" : "text-subtle")}>{relativeDays(a.date)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-2.5 text-[0.8125rem] text-subtle">Nenhuma avaliação futura cadastrada.</p>
        )}
      </div>

      <div className="pt-3.5 pb-2">
        <div className="flex items-center justify-between px-5 pb-1">
          <h3 className="text-[0.8125rem] font-semibold">Novidades nas turmas</h3>
          {data.updates.length > 0 && (
            <button type="button" onClick={() => setOpen(true)} className="text-[0.8125rem] text-muted transition-colors hover:text-fg">
              Ver todas
            </button>
          )}
        </div>
        {news.length ? (
          <ul>
            {news.map((u, i) => (
              <li key={i} className="flex gap-3 px-5 py-2">
                <ClassDot name={u.className} className="mt-1.5 rounded-[2px]! size-[7px]!" />
                <div className="min-w-0 text-sm">
                  <p className="line-clamp-2" title={u.description}>{updateMessage(u.description)}</p>
                  <p className="truncate text-xs text-subtle">
                    {prettyClassName(u.className)} · {formatShortDate(u.date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-2 text-[0.8125rem] text-subtle">Sem novidades.</p>
        )}
      </div>
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21.5rem]" aria-busy="true" aria-label="Carregando">
      <div className="space-y-5">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
      <Skeleton className="h-[34rem] rounded-xl" />
    </div>
  );
}

export default function DashboardPage() {
  const q = useDashboard();
  const stats = useClassStats(q.data?.data.classes ?? []);
  const header = (
    <PageHeader
      title="Portal do discente"
      actions={
        <>
          {q.data && (
            <span className="hidden h-7 items-center rounded-md border border-line bg-surface px-2.5 text-[0.8125rem] font-medium tabular sm:inline-flex" title="Semestre atual">
              {q.data.data.profile.currentPeriod}
            </span>
          )}
          <Freshness fetchedAt={q.data?.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />
        </>
      }
    />
  );
  if (q.isPending)
    return (
      <>
        {header}
        <DashboardSkeleton />
      </>
    );
  if (q.isError)
    return (
      <>
        {header}
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </>
    );
  const data = q.data.data;

  return (
    <div className="animate-in grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21.5rem]">
      {header}
      <div className="flex min-w-0 flex-col gap-5">
        <ClassesPanel data={data} stats={stats} />
        <WeekPanel classes={data.classes} />
      </div>
      <YouPanel data={data} stats={stats} />
    </div>
  );
}
