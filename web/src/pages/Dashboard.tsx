import { Bell, CalendarCheck, Clock, MapPin, MessagesSquare, Sparkles, Sun, Target } from "lucide-react";
import { Link } from "react-router";
import { useDashboard } from "../api/hooks";
import type { ClassSummary, Dashboard } from "../api/types";
import { ClassDot, prettyClassName } from "../components/ClassBits";
import { Badge, Card, CardHeader, EmptyState, ErrorState, Freshness, PageHeader, ProgressBar, Skeleton, SkeletonCard } from "../components/ui";
import { classColorVars } from "../lib/colors";
import { daysUntil, formatLongDate, formatNumber, formatShortDate, parseLocal, relativeDays, titleCase } from "../lib/format";
import { DAYS, SHIFTS, blockTimeRange, blocksForDay, isWithinPeriod, sigaaDay, toISODay } from "../lib/schedule";

/** Finds the next weekday (after today) that has any class. */
function nextClassDay(classes: ClassSummary[], from: Date): { date: Date; day: number } | null {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const code = sigaaDay(d);
    const active = classes.filter((c) => isWithinPeriod(c, toISODay(d)));
    if (blocksForDay(active, code).length) return { date: d, day: code };
  }
  return null;
}

function TodayCard({ classes }: { classes: ClassSummary[] }) {
  const now = new Date();
  const today = sigaaDay(now);
  const active = classes.filter((c) => isWithinPeriod(c, toISODay(now)));
  const blocks = blocksForDay(active, today);
  const next = blocks.length ? null : nextClassDay(classes, now);

  return (
    <Card>
      <CardHeader
        title="Hoje"
        subtitle={formatLongDate(now)}
        icon={Sun}
        action={
          <Link to="/horarios" className="text-xs font-medium text-brand-strong hover:underline">
            Ver semana
          </Link>
        }
      />
      <div className="px-5 pb-5">
        {blocks.length ? (
          <ol className="space-y-2.5">
            {blocks.map((b) => (
              <li key={`${b.cls.id}-${b.shift}`}>
                <Link
                  to={`/turmas/${b.cls.id}`}
                  className="group flex items-stretch gap-3 rounded-xl border border-line bg-surface-2/60 p-3 transition-colors hover:border-line-strong hover:bg-surface-2"
                  style={classColorVars(b.cls.name)}
                >
                  <span className="class-bar w-1 shrink-0 rounded-full" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold group-hover:text-brand-strong">{prettyClassName(b.cls.name)}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {blockTimeRange(b.shift, b.indexes) ?? SHIFTS.find((s) => s.key === b.shift)?.label}
                        <span className="text-subtle">· {b.indexes.length} aulas</span>
                      </span>
                      {b.cls.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" />
                          {b.cls.location}
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex items-center gap-4 rounded-xl bg-surface-2/60 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
              <Sparkles className="size-5" />
            </span>
            <div className="text-sm">
              <p className="font-semibold">Sem aulas hoje</p>
              <p className="text-muted">
                {next
                  ? `Próximas aulas ${relativeDays(toISODay(next.date))}, ${DAYS.find((d) => d.code === next.day)?.long.toLowerCase()}.`
                  : "Aproveite o descanso."}
              </p>
            </div>
          </div>
        )}
        <p className="mt-3 text-[0.7rem] text-subtle">Horários de relógio aproximados.</p>
      </div>
    </Card>
  );
}

/** Left column of the portal, like SIGAA: who you are, your indices and progress. */
function ProfileCard({ data }: { data: Dashboard }) {
  const { profile: pr, progress: p } = data;
  const pending = p.mandatoryPendingHours + p.optionalPendingHours + p.complementaryPendingHours;
  const main = data.indices.filter((i) => i.code === "IRA" || i.code === "MC");
  const rest = data.indices.filter((i) => i.code !== "IRA" && i.code !== "MC");
  return (
    <Card as="aside" className="self-start">
      <div className="flex items-center gap-3 border-b border-line p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft text-lg font-bold text-brand-strong" aria-hidden>
          {pr.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{titleCase(pr.name)}</p>
          <p className="truncate text-xs text-muted">{titleCase(pr.course.split(" - ")[0]?.split("/")[0] ?? pr.course)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-b border-line p-5 text-sm">
        {(
          [
            ["Matrícula", pr.matricula],
            ["Nível", titleCase(pr.level)],
            ["Status", titleCase(pr.status)],
            ["Entrada", pr.entryPeriod],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="truncate text-right font-medium tabular">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="border-b border-line p-5">
        <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Índices acadêmicos</h2>
        <div className="mb-3 grid grid-cols-2 gap-3">
          {main.map((i) => (
            <div key={i.code} title={i.description} className="rounded-xl bg-brand-soft px-3 py-2">
              <p className="text-xs font-semibold text-brand-strong">{i.code}</p>
              <p className="text-xl font-bold tracking-tight tabular">{i.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {rest.map((i) => (
            <div key={i.code} className="flex justify-between gap-2" title={i.description}>
              <dt className="text-muted">{i.code}</dt>
              <dd className="font-medium tabular">{formatNumber(i.value, i.value >= 100 ? 1 : 2)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Integralização</h2>
          <span className="text-sm font-bold tabular">{Math.floor(p.percent)}%</span>
        </div>
        <ProgressBar value={p.percent} label={`${Math.round(p.percent)}% do curso integralizado`} />
        <p className="mt-2 text-xs text-muted">
          Faltam <span className="font-medium text-fg tabular">{pending} h</span> ({p.mandatoryPendingHours} h obrigatórias, {p.optionalPendingHours} h optativas)
        </p>
        <Link to="/progresso" className="mt-3 inline-block text-xs font-medium text-brand-strong hover:underline">
          Detalhar índices
        </Link>
      </div>
    </Card>
  );
}

/** "ter 18:30 – 22:00" for each meeting day. */
function when(c: ClassSummary): string {
  return DAYS.flatMap((d) =>
    blocksForDay([c], d.code).map((b) => `${d.short} ${blockTimeRange(b.shift, b.indexes) ?? SHIFTS.find((s) => s.key === b.shift)?.label ?? ""}`),
  ).join(", ");
}

/** "Turmas do Semestre" table from SIGAA's portal, linking to each turma virtual. */
function ClassesCard({ data }: { data: Dashboard }) {
  return (
    <Card>
      <CardHeader title="Turmas do semestre" action={<Link to="/horarios" className="text-xs font-medium text-brand-strong hover:underline">Ver grade</Link>} />
      {data.classes.length === 0 ? (
        <EmptyState title="Nenhuma turma neste semestre" className="py-6" />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {data.classes.map((c) => (
            <li key={c.id}>
              <Link to={`/turmas/${c.id}`} className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2/60 sm:flex-nowrap">
                <ClassDot name={c.name} />
                <span className="min-w-0 flex-1 font-medium group-hover:text-brand-strong">{prettyClassName(c.name)}</span>
                <span className="w-full pl-6 text-xs text-muted sm:w-auto sm:pl-0 sm:text-right">
                  <span className="tabular">{when(c)}</span>
                  {c.location && <span className="text-subtle"> · {c.location}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActivitiesCard({ data }: { data: Dashboard }) {
  const upcoming = data.activities.filter((a) => !a.past).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Card>
      <CardHeader title="Minhas atividades" icon={Target} />
      {upcoming.length ? (
        <ul className="divide-y divide-line px-5 pb-3">
          {upcoming.map((a, i) => {
            const d = parseLocal(a.date);
            const n = d ? daysUntil(d) : 99;
            return (
              <li key={i} className="flex items-center gap-3 py-3">
                <div className="grid w-12 shrink-0 place-items-center rounded-xl border border-line py-1.5 text-center">
                  <span className="text-[0.65rem] font-semibold text-muted uppercase">{d ? d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") : ""}</span>
                  <span className="text-lg leading-none font-bold tabular">{d?.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.title}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                    <ClassDot name={a.className} />
                    {prettyClassName(a.className)} · {a.kind}
                  </p>
                </div>
                <Badge tone={n <= 2 ? "danger" : n <= 7 ? "warning" : "neutral"}>{relativeDays(a.date)}</Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={CalendarCheck} title="Nada marcado" description="Nenhuma avaliação futura cadastrada nas suas turmas." className="py-6" />
      )}
    </Card>
  );
}

function UpdatesCard({ data }: { data: Dashboard }) {
  const idByName = new Map(data.classes.map((c) => [prettyClassName(c.name), c.id]));
  return (
    <Card>
      <CardHeader title="Últimas atualizações" icon={Bell} />
      {data.updates.length ? (
        <ol className="relative px-5 pb-4">
          {data.updates.slice(0, 6).map((u, i) => {
            const pretty = prettyClassName(u.className);
            const id = idByName.get(pretty);
            const [kind, ...rest] = u.description.split(":");
            const hasKind = rest.length > 0;
            return (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                <span className="relative flex flex-col items-center" aria-hidden>
                  <ClassDot name={u.className} className="mt-1.5" />
                  {i < Math.min(data.updates.length, 6) - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {hasKind ? (
                      <>
                        <span className="text-muted">{kind}:</span> <span className="font-medium">{rest.join(":").trim()}</span>
                      </>
                    ) : (
                      <span className="font-medium">{u.description}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {id ? (
                      <Link to={`/turmas/${id}`} className="hover:text-brand-strong hover:underline">
                        {pretty}
                      </Link>
                    ) : (
                      pretty
                    )}{" "}
                    · {formatShortDate(u.date)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState title="Sem novidades" className="py-6" />
      )}
    </Card>
  );
}

function ForumCard({ data }: { data: Dashboard }) {
  return (
    <Card>
      <CardHeader title="Fórum do curso" icon={MessagesSquare} />
      {data.forum.length ? (
        <ul className="divide-y divide-line px-5 pb-3">
          {data.forum.slice(0, 5).map((t, i) => (
            <li key={i} className="py-3">
              <p className="text-sm font-medium">{t.title}</p>
              <p className="mt-0.5 text-xs text-muted">
                {t.author} · {formatShortDate(t.date.slice(0, 10))}
                {t.replies > 0 && ` · ${t.replies} ${t.replies === 1 ? "resposta" : "respostas"}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nenhum tópico" className="py-6" />
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[18rem_1fr]">
        <SkeletonCard lines={8} />
        <div className="space-y-5">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const q = useDashboard();
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const data = q.data.data;

  return (
    <div className="animate-in">
      <PageHeader
        title="Portal do Discente"
        subtitle={`${formatLongDate(new Date())} · semestre ${data.profile.currentPeriod}`}
        actions={<Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <ProfileCard data={data} />
        <div className="min-w-0 space-y-5">
          <TodayCard classes={data.classes} />
          <ClassesCard data={data} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ActivitiesCard data={data} />
            <UpdatesCard data={data} />
          </div>
          <ForumCard data={data} />
        </div>
      </div>
    </div>
  );
}
