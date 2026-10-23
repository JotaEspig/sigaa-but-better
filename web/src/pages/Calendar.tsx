import clsx from "clsx";
import { CalendarDays, CalendarRange } from "lucide-react";
import { useSearchParams } from "react-router";
import { useCalendar, useCalendars } from "../api/hooks";
import type { AcademicCalendar, CalendarEvent } from "../api/types";
import { Badge, Card, CardHeader, EmptyState, ErrorState, Freshness, PageHeader, ProgressBar, SkeletonCard } from "../components/ui";
import type { Tone } from "../lib/colors";
import { formatDate, formatShortDate, parseLocal, relativeDays } from "../lib/format";
import { toISODay } from "../lib/schedule";
import { useNow } from "../lib/useNow";

type Status = "past" | "now" | "soon" | "future";

function statusOf(ev: CalendarEvent, now: number): Status {
  const today = toISODay(new Date(now));
  if (ev.end < today) return "past";
  if (ev.start <= today) return "now";
  const d = parseLocal(ev.start);
  const days = d ? (d.getTime() - now) / 86_400_000 : Infinity;
  return days <= 30 ? "soon" : "future";
}

function StatusBadge({ ev, status }: { ev: CalendarEvent; status: Status }) {
  const map: Record<Status, [Tone, string]> = {
    past: ["neutral", "encerrado"],
    now: ["success", ev.start === ev.end ? "hoje" : `até ${formatShortDate(ev.end)}`],
    soon: ["warning", relativeDays(ev.start)],
    future: ["info", relativeDays(ev.start)],
  };
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

function range(ev: CalendarEvent): string {
  return ev.start === ev.end ? formatDate(ev.start) : `${formatDate(ev.start)} – ${formatDate(ev.end)}`;
}

/** "Em andamento" and the next dates: what a student actually opens the calendar for. */
function NowCard({ cal, now: nowMs }: { cal: AcademicCalendar; now: number }) {
  const today = toISODay(new Date(nowMs));
  const events = cal.sections.flatMap((s) => s.events.filter((e) => e.label !== "Período Letivo"));
  const now = events.filter((e) => statusOf(e, nowMs) === "now");
  const next = events
    .filter((e) => e.start > today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 3);
  const total = (parseLocal(cal.end)?.getTime() ?? 0) - (parseLocal(cal.start)?.getTime() ?? 0);
  const elapsed = nowMs - (parseLocal(cal.start)?.getTime() ?? 0);
  const pct = total > 0 ? (elapsed / total) * 100 : 0;
  const inTerm = cal.start <= today && today <= cal.end;

  return (
    <Card className="mb-5">
      <CardHeader title={`Semestre ${cal.period}`} icon={CalendarRange} subtitle={cal.start ? `Período letivo: ${range({ label: "", start: cal.start, end: cal.end })}` : undefined} />
      <div className="space-y-5 px-5 pb-5">
        {inTerm && (
          <div className="flex items-center gap-3 text-xs text-muted">
            <ProgressBar value={pct} label="Semestre decorrido" className="h-1.5" />
            <span className="shrink-0 tabular">{Math.round(pct)}% do semestre</span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">Em andamento</h3>
            {now.length ? (
              <ul className="space-y-2">
                {now.map((e) => (
                  <li key={e.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{e.label}</span>
                    <StatusBadge ev={e} status="now" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nenhum prazo aberto hoje.</p>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">Próximos prazos</h3>
            {next.length ? (
              <ul className="space-y-2">
                {next.map((e) => (
                  <li key={e.label} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{e.label}</span>
                      <span className="block text-xs text-muted tabular">{range(e)}</span>
                    </span>
                    <StatusBadge ev={e} status={statusOf(e, nowMs)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nada mais previsto neste calendário.</p>
            )}
          </section>
        </div>
      </div>
    </Card>
  );
}

export default function CalendarPage() {
  const list = useCalendars();
  const [params, setParams] = useSearchParams();
  const refs = list.data?.data ?? [];
  const selected = refs.find((r) => r.period === params.get("semestre")) ?? refs[0];
  const q = useCalendar(selected?.id);
  const now = useNow();

  const crumbs = [{ label: "Portal do Discente", to: "/" }, { label: "Ensino" }, { label: "Calendário acadêmico" }];
  if (list.isPending)
    return (
      <div className="space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={6} />
      </div>
    );
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;

  const periods = [...new Set(refs.map((r) => r.period))];
  return (
    <div className="animate-in">
      <PageHeader
        title="Calendário acadêmico"
        subtitle="Prazos oficiais do IFC para a graduação"
        crumbs={crumbs}
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-muted">
              Semestre
              <select
                value={selected?.period ?? ""}
                onChange={(e) => setParams({ semestre: e.target.value }, { replace: true })}
                className="h-8 rounded-lg border border-line bg-surface px-2 text-sm text-fg"
              >
                {periods.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {q.data && <Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />}
          </>
        }
      />
      {!selected ? (
        <EmptyState icon={CalendarDays} title="Nenhum calendário publicado" className="card" />
      ) : q.isPending ? (
        <SkeletonCard lines={6} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          {q.data.data.current && <NowCard cal={q.data.data} now={now} />}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {q.data.data.sections.map((s) => (
              <Card key={s.title}>
                <CardHeader title={s.title.replace(/^Datas para /, "")} icon={CalendarDays} />
                <ul className="divide-y divide-line px-5 pb-3">
                  {s.events.map((e) => {
                    const st = statusOf(e, now);
                    return (
                      <li key={e.label} className={clsx("flex items-center justify-between gap-3 py-2.5 text-sm", st === "past" && "opacity-60")}>
                        <span className="min-w-0">
                          <span className="block font-medium">{e.label}</span>
                          <span className="block text-xs text-muted tabular">{range(e)}</span>
                        </span>
                        <StatusBadge ev={e} status={st} />
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Datas que o SIGAA marca como “Não definido” não aparecem.</p>
        </>
      )}
    </div>
  );
}
