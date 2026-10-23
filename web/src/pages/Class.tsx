import clsx from "clsx";
import {
  BookMarked,
  CalendarCheck,
  Clock,
  CircleCheck,
  CircleDashed,
  CircleX,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  Link as LinkIcon,
  Newspaper,
  NotebookText,
  TriangleAlert,
  UserCheck,
  Users,
} from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { OFFICIAL_SIGAA_URL, fileUrl } from "../api/client";
import {
  useClass,
  useDashboard,
  useClassAttendance,
  useClassEvaluations,
  useClassFiles,
  useClassGrades,
  useClassNews,
  useClassParticipants,
  useClassPlan,
  useClassReferences,
  useClassTasks,
  useNewsDetail,
} from "../api/hooks";
import type { Assessment, ClassOverview, Material, PlanReference, Task } from "../api/types";
import { prettyClassName } from "../components/ClassBits";
import { Dialog } from "../components/Dialog";
import { Badge, Breadcrumbs, EmptyState, ErrorState, Freshness, ProgressBar, Skeleton, SkeletonCard, type Crumb } from "../components/ui";
import { LOW_GRADE, classColorVars, situationTone } from "../lib/colors";
import { daysUntil, formatDate, formatDateTime, formatGrade, formatPercent, parseLocal, relativeDays, titleCase } from "../lib/format";
import { toISODay } from "../lib/schedule";
import { useNow } from "../lib/useNow";

type TabKey = "aulas" | "plano" | "participantes" | "frequencia" | "notas" | "tarefas" | "arquivos" | "referencias" | "noticias" | "avaliacoes";

interface SectionDef {
  key: TabKey;
  label: string;
  slug: string;
  icon: ComponentType<{ className?: string }>;
}

/** Same grouping as SIGAA's turma virtual menu (Turma / Alunos / Materiais / Atividades). */
const MENU: { group: string; items: SectionDef[] }[] = [
  {
    group: "Turma",
    items: [
      { key: "aulas", label: "Principal", slug: "", icon: Layers },
      { key: "plano", label: "Plano de ensino", slug: "plano", icon: NotebookText },
      { key: "participantes", label: "Participantes", slug: "participantes", icon: Users },
      { key: "noticias", label: "Notícias", slug: "noticias", icon: Newspaper },
    ],
  },
  {
    group: "Alunos",
    items: [
      { key: "frequencia", label: "Frequência", slug: "frequencia", icon: UserCheck },
      { key: "notas", label: "Ver notas", slug: "notas", icon: GraduationCap },
    ],
  },
  {
    group: "Materiais",
    items: [
      { key: "arquivos", label: "Arquivos", slug: "arquivos", icon: FolderOpen },
      { key: "referencias", label: "Referências", slug: "referencias", icon: BookMarked },
    ],
  },
  {
    group: "Atividades",
    items: [
      { key: "avaliacoes", label: "Avaliações", slug: "avaliacoes", icon: CalendarCheck },
      { key: "tarefas", label: "Tarefas", slug: "tarefas", icon: ClipboardList },
    ],
  },
];
const SECTIONS = MENU.flatMap((g) => g.items);

/** Shared shell for every tab panel: loading/error/freshness handling. */
function Panel<T>({
  q,
  children,
  lines = 4,
}: {
  q: { isPending: boolean; isError: boolean; error: unknown; data?: { data: T; fetchedAt: string }; refetch: () => unknown; refresh: () => void; refreshing: boolean };
  children: (data: T) => ReactNode;
  lines?: number;
}) {
  if (q.isPending) return <SkeletonCard lines={lines} />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="animate-in">
      <div className="-mt-11 mb-4 flex min-h-8 justify-end">
        <Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />
      </div>
      {children(q.data.data)}
    </div>
  );
}

// ---------------------------------------------------------------- Aulas

function MaterialItem({ m, classId, onTask }: { m: Material; classId: string; onTask: () => void }) {
  const base = "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm transition-colors hover:border-line-strong hover:bg-surface-2";
  if (m.kind === "file" && m.id)
    return (
      <a href={fileUrl(classId, m.id)} className={base} download>
        <FileText className="size-4 shrink-0 text-info" />
        <span className="truncate">{m.title}</span>
        <Download className="size-3.5 shrink-0 text-subtle" />
      </a>
    );
  if (m.kind === "link" && m.url)
    return (
      <a href={m.url} target="_blank" rel="noopener noreferrer" className={base}>
        <LinkIcon className="size-4 shrink-0 text-brand" />
        <span className="truncate">{m.title}</span>
        <ExternalLink className="size-3.5 shrink-0 text-subtle" />
      </a>
    );
  return (
    <button type="button" onClick={onTask} className={clsx(base, "text-left")}>
      <ClipboardList className="size-4 shrink-0 text-warning" />
      <span className="truncate">{m.title}</span>
      <Badge tone="warning" className="ml-0.5">
        tarefa
      </Badge>
    </button>
  );
}

function TopicsPanel({ overview, onTab }: { overview: ClassOverview; onTab: (t: TabKey) => void }) {
  const today = toISODay(new Date());
  const topics = [...overview.topics];
  if (!topics.length) return <EmptyState icon={Layers} title="Nenhum tópico de aula" description="O docente ainda não publicou tópicos nesta turma." className="card" />;

  return (
    <div className="space-y-6">
      {overview.lastNews && (
        <article className="rounded-2xl border border-info/25 bg-info-soft/60 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-info">
            <Newspaper className="size-3.5" /> Última notícia · {formatDateTime(overview.lastNews.date)}
          </p>
          <h3 className="mt-1.5 font-semibold">{overview.lastNews.title}</h3>
          {overview.lastNews.html && <div className="prose-sigaa mt-2 text-sm" dangerouslySetInnerHTML={{ __html: overview.lastNews.html }} />}
        </article>
      )}
      <ol className="relative space-y-4 border-l-2 border-line pl-5 sm:pl-7">
        {topics.map((t, i) => {
          const isFuture = t.startDate > today;
          return (
            <li key={i} className="relative">
              <span
                aria-hidden
                className={clsx(
                  "absolute top-5 -left-[1.69rem] size-3 rounded-full border-2 sm:-left-[2.19rem]",
                  isFuture ? "border-line-strong bg-surface" : "border-brand bg-brand",
                )}
              />
              <article className={clsx("card p-4 sm:p-5", isFuture && "opacity-75")}>
                <p className="text-xs font-medium text-muted tabular">
                  {t.startDate ? (t.startDate === t.endDate || !t.endDate ? formatDate(t.startDate) : `${formatDate(t.startDate)} – ${formatDate(t.endDate)}`) : "Sem data"}
                </p>
                <h3 className="mt-1 font-semibold">{t.title}</h3>
                {t.html && <div className="prose-sigaa mt-2" dangerouslySetInnerHTML={{ __html: t.html }} />}
                {t.materials.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.materials.map((m, j) => (
                      <MaterialItem key={j} m={m} classId={overview.id} onTask={() => onTab("tarefas")} />
                    ))}
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- Frequência

function AttendancePanel({ id }: { id: string }) {
  const q = useClassAttendance(id);
  return (
    <Panel q={q}>
      {(a) => {
        const used = a.maxAbsences ? (a.totalAbsences / a.maxAbsences) * 100 : 0;
        const tone = used >= 100 ? "danger" : used >= 75 ? "warning" : "brand";
        const left = Math.max(0, a.maxAbsences - a.totalAbsences);
        return (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-5">
              <section className="card p-5">
                <h3 className="text-sm font-semibold text-muted">Faltas</h3>
                <p className={clsx("mt-1 text-4xl font-bold tracking-tight tabular", used >= 100 && "text-danger")}>
                  {a.totalAbsences}
                  <span className="text-lg font-medium text-subtle"> / {a.maxAbsences}</span>
                </p>
                <ProgressBar value={used} tone={tone} label="Faltas usadas do limite" className="mt-3 h-2.5" />
                <p className="mt-2 text-sm text-muted">
                  {used >= 100 ? "Limite de faltas ultrapassado." : `Você ainda pode faltar ${left} ${left === 1 ? "aula" : "aulas"}.`}
                </p>
                {used >= 75 && (
                  <p role="alert" className={clsx("mt-3 flex gap-2 rounded-xl px-3 py-2.5 text-sm", used >= 100 ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    {used >= 100 ? "Você passou do limite de 25% de faltas e pode ser reprovado por frequência." : "Atenção: você já usou mais de 75% do limite de faltas."}
                  </p>
                )}
              </section>
              <section className="card grid grid-cols-2 gap-4 p-5 text-sm">
                <Stat label="Frequência (aulas registradas)" value={formatPercent(a.percentOfRecorded)} />
                <Stat label="Frequência (carga horária)" value={formatPercent(a.percentOfWorkload)} />
                <Stat label="Presenças registradas" value={String(a.presences)} />
                <Stat label="Aulas pela CH" value={String(a.lessonsByWorkload)} />
              </section>
              <p className="text-xs text-muted">Limite de faltas = 25% das aulas previstas pela carga horária (aulas de 50 minutos).</p>
            </div>
            <section className="card overflow-hidden">
              <h3 className="border-b border-line px-5 py-3 text-sm font-semibold">Registro por aula</h3>
              {a.records.length ? (
                <ul className="divide-y divide-line">
                  {[...a.records].reverse().map((r) => (
                    <li key={r.date} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <span className="tabular">{formatDate(r.date)}</span>
                      {r.status === "present" && (
                        <span className="inline-flex items-center gap-1.5 text-success">
                          <CircleCheck className="size-4" /> Presente
                        </span>
                      )}
                      {r.status === "absent" && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-danger">
                          <CircleX className="size-4" /> {r.absences} {r.absences === 1 ? "falta" : "faltas"}
                        </span>
                      )}
                      {r.status === "unregistered" && (
                        <span className="inline-flex items-center gap-1.5 text-subtle">
                          <CircleDashed className="size-4" /> Não registrada
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={UserCheck} title="Sem registros ainda" />
              )}
            </section>
          </div>
        );
      }}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Notas

function GradesPanel({ id }: { id: string }) {
  const q = useClassGrades(id);
  return (
    <Panel q={q}>
      {(g) => {
        const groups = new Map<string, Assessment[]>();
        for (const a of g.assessments) groups.set(a.group, [...(groups.get(a.group) ?? []), a]);
        const tone = situationTone(g.situation);
        if (!g.published)
          return (
            <EmptyState
              icon={GraduationCap}
              title="Notas ainda não lançadas"
              description="O professor ainda não lançou notas nesta turma. Assim que lançar, elas aparecem aqui."
              className="card"
            />
          );
        return (
          <div className="space-y-5">
            <section className="card flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
              <Stat label="Resultado" value={formatGrade(g.result)} />
              <Stat label="Reposição" value={formatGrade(g.makeup)} />
              <Stat label="Faltas" value={g.absences === null ? "–" : String(g.absences)} />
              <div className="ml-auto">
                <Badge tone={tone} className="px-3 py-1 text-sm">
                  {!g.situation || g.situation === "--" ? "Em curso" : g.situation === "REC" ? "Recuperação" : g.situation}
                </Badge>
              </div>
            </section>
            {groups.size === 0 ? (
              <EmptyState icon={GraduationCap} title="Nenhuma avaliação lançada" className="card" />
            ) : (
              [...groups.entries()].map(([group, items]) => (
                <section key={group} className="card p-5">
                  <h3 className="mb-3 text-sm font-semibold">{group}</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {items.map((a, i) => (
                      <div key={i} className={clsx("rounded-xl border p-3", a.isUnitTotal ? "border-brand/40 bg-brand-soft/60" : "border-line bg-surface-2/50")}>
                        <p className="text-xs font-medium text-muted">
                          {a.label}
                          {a.title && <span className="text-subtle"> · {a.title}</span>}
                        </p>
                        <p className={clsx("mt-1 text-2xl font-bold tracking-tight tabular", a.value === null && "text-subtle", a.value !== null && a.value < LOW_GRADE && "text-danger")}>
                          {formatGrade(a.value)}
                        </p>
                        {a.weight && !a.isUnitTotal && <p className="text-[0.7rem] text-subtle">peso {a.weight}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        );
      }}
    </Panel>
  );
}

// ---------------------------------------------------------------- Tarefas

function TaskCard({ t, now }: { t: Task; now: number }) {
  const end = parseLocal(t.end);
  const open = end ? end.getTime() > now : false;
  const n = end ? daysUntil(end) : 0;
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold">{t.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          {t.corrected && <Badge tone="success">Corrigida</Badge>}
          {t.graded && <Badge tone="info">Vale nota</Badge>}
          {open ? <Badge tone={n <= 2 ? "danger" : n <= 7 ? "warning" : "neutral"}>Entrega {relativeDays(t.end.slice(0, 10))}</Badge> : <Badge>Encerrada</Badge>}
        </div>
      </div>
      {t.description && <p className="mt-2 text-sm whitespace-pre-line text-muted">{t.description}</p>}
      <p className="mt-3 text-xs text-muted tabular">
        {formatDateTime(t.start)} → <span className="font-medium text-fg">{formatDateTime(t.end)}</span>
        <span className="text-subtle"> · {t.submissions} envios na turma</span>
      </p>
    </article>
  );
}

function TasksPanel({ id }: { id: string }) {
  const q = useClassTasks(id);
  const now = useNow();
  return (
    <Panel q={q}>
      {(tasks) => {
        const isOpen = (t: Task) => (parseLocal(t.end)?.getTime() ?? 0) > now;
        const open = tasks.filter(isOpen).sort((a, b) => a.end.localeCompare(b.end));
        const closed = tasks.filter((t) => !isOpen(t)).sort((a, b) => b.end.localeCompare(a.end));
        return (
          <div className="space-y-6">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-sm text-muted">
              <span>Este app é somente leitura: o envio de tarefas é feito no SIGAA oficial.</span>
              <a href={OFFICIAL_SIGAA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-strong underline underline-offset-2">
                Abrir SIGAA <ExternalLink className="size-3.5" />
              </a>
            </p>
            {tasks.length === 0 && <EmptyState icon={ClipboardList} title="Nenhuma tarefa" className="card" />}
            {open.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-semibold">Abertas</h3>
                <div className="space-y-3">
                  {open.map((t, i) => (
                    <TaskCard key={i} t={t} now={now} />
                  ))}
                </div>
              </section>
            )}
            {closed.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-muted">Encerradas</h3>
                <div className="space-y-3">
                  {closed.map((t, i) => (
                    <TaskCard key={i} t={t} now={now} />
                  ))}
                </div>
              </section>
            )}
          </div>
        );
      }}
    </Panel>
  );
}

// ---------------------------------------------------------------- Arquivos

function FilesPanel({ id }: { id: string }) {
  const q = useClassFiles(id);
  return (
    <Panel q={q}>
      {(files) =>
        files.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Nenhum arquivo" description="O docente ainda não publicou arquivos nos tópicos de aula." className="card" />
        ) : (
          <ul className="card divide-y divide-line">
            {files.map((f) => (
              <li key={f.id}>
                <a href={fileUrl(id, f.id)} download className="group flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2/50">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info-soft text-info">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium group-hover:text-brand-strong">{f.title}</p>
                    <p className="truncate text-xs text-muted">{f.description || f.topic}</p>
                  </div>
                  <Download className="size-4 shrink-0 text-subtle group-hover:text-brand-strong" aria-label="Baixar" />
                </a>
              </li>
            ))}
          </ul>
        )
      }
    </Panel>
  );
}

// ---------------------------------------------------------------- Notícias

function NewsPanel({ id }: { id: string }) {
  const q = useClassNews(id);
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useNewsDetail(id, openId);
  const selected = q.data?.data.find((n) => n.id === openId);

  return (
    <>
      <Panel q={q}>
        {(news) =>
          news.length === 0 ? (
            <EmptyState icon={Newspaper} title="Nenhuma notícia" className="card" />
          ) : (
            <ul className="card divide-y divide-line">
              {news.map((n, i) => (
                <li key={n.id ?? i}>
                  <button type="button" disabled={!n.id} onClick={() => setOpenId(n.id ?? null)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-2/50">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                      <Newspaper className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{n.title}</span>
                      <span className="block text-xs text-muted">{formatDate(n.date.slice(0, 10))}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </Panel>
      <Dialog open={!!openId} onClose={() => setOpenId(null)} title={detail.data?.data.title ?? selected?.title ?? "Notícia"}>
        {detail.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} compact />
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">{formatDateTime(detail.data.data.date)}</p>
            <div className="prose-sigaa" dangerouslySetInnerHTML={{ __html: detail.data.data.html ?? "" }} />
          </>
        )}
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------- Avaliações

function EvaluationsPanel({ id }: { id: string }) {
  const q = useClassEvaluations(id);
  return (
    <Panel q={q}>
      {(evs) =>
        evs.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Nenhuma avaliação agendada" className="card" />
        ) : (
          <ul className="card divide-y divide-line">
            {[...evs]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((e, i) => {
                const d = parseLocal(e.date);
                const n = d ? daysUntil(d) : -1;
                return (
                  <li key={e.id ?? i} className={clsx("flex items-center gap-4 px-5 py-3.5", n < 0 && "opacity-60")}>
                    <div className="grid w-12 shrink-0 place-items-center rounded-xl border border-line py-1.5 text-center">
                      <span className="text-[0.65rem] font-semibold text-muted uppercase">{d?.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                      <span className="text-lg leading-none font-bold tabular">{d?.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{e.description}</p>
                      <p className="text-xs text-muted tabular">
                        {formatDate(e.date)}
                        {e.time && ` às ${e.time}`}
                      </p>
                    </div>
                    {n >= 0 ? <Badge tone={n <= 2 ? "danger" : n <= 7 ? "warning" : "neutral"}>{relativeDays(e.date)}</Badge> : <Badge>realizada</Badge>}
                  </li>
                );
              })}
          </ul>
        )
      }
    </Panel>
  );
}

// ---------------------------------------------------------------- Plano de ensino

function ReferenceList({ title, refs }: { title: string; refs: PlanReference[] }) {
  if (!refs.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">{title}</h4>
      <ul className="space-y-2 text-sm">
        {refs.map((r, i) => (
          <li key={i} className="flex gap-2">
            <Badge className="mt-0.5 shrink-0">{r.type}</Badge>
            <span>{r.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanPanel({ id }: { id: string }) {
  const q = useClassPlan(id);
  const today = toISODay(new Date());
  return (
    <Panel q={q} lines={8}>
      {(p) => {
        const empty = !p.methodologyHtml && !p.assessmentHtml && !p.officeHours && !p.lessons.length;
        if (empty) return <EmptyState icon={NotebookText} title="Plano de ensino não publicado" description="O docente ainda não cadastrou o plano desta turma." className="card" />;
        const nextIdx = p.lessons.findIndex((l) => l.end >= today);
        return (
          <div className="space-y-5">
            {p.officeHours && (
              <section className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft/50 p-4">
                <Clock className="size-5 shrink-0 text-brand-strong" />
                <p className="text-sm">
                  <span className="block text-xs font-semibold text-brand-strong">Horário de atendimento</span>
                  {p.officeHours}
                </p>
              </section>
            )}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {p.methodologyHtml && (
                <section className="card p-5">
                  <h3 className="mb-2 text-sm font-semibold">Metodologia</h3>
                  <div className="prose-sigaa text-sm" dangerouslySetInnerHTML={{ __html: p.methodologyHtml }} />
                </section>
              )}
              {p.assessmentHtml && (
                <section className="card p-5">
                  <h3 className="mb-2 text-sm font-semibold">Avaliação da aprendizagem</h3>
                  <div className="prose-sigaa text-sm" dangerouslySetInnerHTML={{ __html: p.assessmentHtml }} />
                  {p.evaluations.length > 0 && (
                    <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
                      {p.evaluations.map((e, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span>{e.description}</span>
                          <span className="text-muted tabular">{formatDate(e.date)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
            {p.lessons.length > 0 && (
              <section className="card overflow-hidden">
                <h3 className="border-b border-line px-5 py-3 text-sm font-semibold">Cronograma de aulas</h3>
                <ol className="divide-y divide-line">
                  {p.lessons.map((l, i) => (
                    <li
                      key={i}
                      className={clsx("flex items-start gap-4 px-5 py-2.5 text-sm", l.end < today && "text-muted", i === nextIdx && "bg-brand-soft/50")}
                      aria-current={i === nextIdx ? "date" : undefined}
                    >
                      <span className="w-24 shrink-0 tabular">{l.start === l.end ? formatDate(l.start) : `${formatDate(l.start)} – ${formatDate(l.end)}`}</span>
                      <span className="min-w-0 flex-1">{l.description}</span>
                      {i === nextIdx && <Badge tone="info">{l.start <= today ? "hoje" : "próxima"}</Badge>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {(p.basicReferences.length > 0 || p.complementaryReferences.length > 0) && (
              <section className="card space-y-4 p-5">
                <h3 className="text-sm font-semibold">Referências</h3>
                <ReferenceList title="Básicas" refs={p.basicReferences} />
                <ReferenceList title="Complementares" refs={p.complementaryReferences} />
              </section>
            )}
          </div>
        );
      }}
    </Panel>
  );
}

// ---------------------------------------------------------------- Participantes

function ParticipantsPanel({ id }: { id: string }) {
  const q = useClassParticipants(id);
  return (
    <Panel q={q}>
      {(p) => (
        <div className="space-y-5">
          <section>
            <h3 className="mb-3 text-sm font-semibold">Docentes</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {p.teachers.map((t) => (
                <article key={t.name} className="card p-4">
                  <p className="font-semibold">{titleCase(t.name)}</p>
                  <p className="text-xs text-muted">{[titleCase(t.degree), titleCase(t.department)].filter(Boolean).join(" · ")}</p>
                  {t.email && (
                    <a href={`mailto:${t.email}`} className="mt-2 inline-block text-sm font-medium break-all text-brand-strong underline underline-offset-2">
                      {t.email}
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-1 text-sm font-semibold">
              Discentes <span className="font-normal text-muted">({p.students.length})</span>
            </h3>
            <p className="mb-3 text-xs text-muted">Por privacidade, mostramos só os nomes dos colegas.</p>
            {p.students.length ? (
              <ul className="card grid grid-cols-1 gap-x-6 p-2 sm:grid-cols-2">
                {p.students.map((n) => (
                  <li key={n} className="truncate rounded-lg px-3 py-2 text-sm">
                    {titleCase(n)}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Users} title="Nenhum discente" className="card" />
            )}
          </section>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- Referências

function ReferencesPanel({ id }: { id: string }) {
  const q = useClassReferences(id);
  return (
    <Panel q={q}>
      {(refs) =>
        refs.length === 0 ? (
          <EmptyState icon={BookMarked} title="Nenhuma referência" description="O docente ainda não indicou referências nesta turma." className="card" />
        ) : (
          <ul className="card divide-y divide-line">
            {refs.map((r, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info-soft text-info">
                  <BookMarked className="size-5" />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p>{r.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge>{r.type}</Badge>
                    {r.topic && <span>Tópico: {r.topic}</span>}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-strong underline underline-offset-2">
                        Abrir link <ExternalLink className="size-3" />
                      </a>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )
      }
    </Panel>
  );
}

// ---------------------------------------------------------------- Page

function sectionPath(id: string, key: TabKey): string {
  const slug = SECTIONS.find((x) => x.key === key)?.slug;
  return `/turmas/${id}${slug ? `/${slug}` : ""}`;
}

function ClassMenu({ id, active }: { id: string; active: TabKey }) {
  return (
    <nav aria-label="Menu da turma virtual">
      {/* Mobile: one scrollable row */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:hidden">
        {SECTIONS.map((s) => (
          <li key={s.key}>
            <Link
              to={sectionPath(id, s.key)}
              aria-current={s.key === active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                s.key === active ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-muted",
              )}
            >
              <s.icon className="size-4" />
              {s.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: grouped side menu */}
      <div className="card hidden p-2 lg:block">
        {MENU.map((g) => (
          <div key={g.group} className="mb-2 last:mb-0">
            <p className="px-3 pt-2 pb-1 text-[0.7rem] font-semibold tracking-wide text-subtle uppercase">{g.group}</p>
            <ul>
              {g.items.map((s) => (
                <li key={s.key}>
                  <Link
                    to={sectionPath(id, s.key)}
                    aria-current={s.key === active ? "page" : undefined}
                    className={clsx(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      s.key === active ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <s.icon className="size-4" />
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

/** SIGAA's "Trocar de turma", keeping the current section. */
function ClassSwitcher({ id, section }: { id: string; section: TabKey }) {
  const dashboard = useDashboard();
  const navigate = useNavigate();
  const classes = dashboard.data?.data.classes ?? [];
  // Old classes (from "turmas anteriores") are not in the current list.
  if (classes.length < 2 || !classes.some((c) => c.id === id)) return null;
  return (
    <label className="flex items-center gap-2 text-xs whitespace-nowrap text-muted">
      Trocar de turma
      <select
        value={id}
        onChange={(e) => navigate(sectionPath(e.target.value, section))}
        className="h-8 w-full min-w-0 rounded-lg border border-line bg-surface px-2 text-sm text-fg sm:w-auto sm:max-w-[14rem]"
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {prettyClassName(c.name)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ClassPage() {
  const { id = "", secao = "" } = useParams();
  const navigate = useNavigate();
  const tab = SECTIONS.find((x) => x.slug === secao)?.key ?? "aulas";
  const sectionLabel = SECTIONS.find((x) => x.key === tab)?.label ?? "";
  const q = useClass(id);

  const crumbs = (name: string): Crumb[] => [
    { label: "Portal do Discente", to: "/" },
    { label: "Turmas virtuais", to: "/turmas" },
    { label: name, to: sectionPath(id, "aulas") },
    ...(tab === "aulas" ? [] : [{ label: sectionLabel }]),
  ];

  if (q.isPending)
    return (
      <div className="space-y-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={6} />
      </div>
    );
  if (q.isError)
    return (
      <div className="space-y-4">
        <Breadcrumbs items={crumbs("Turma")} />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </div>
    );
  const c = q.data.data;
  const progress = c.lessonsTotal ? (c.lessonsTaught / c.lessonsTotal) * 100 : 0;

  return (
    <div className="animate-in">
      <Breadcrumbs items={crumbs(prettyClassName(c.name))} />
      <header className="card relative mb-5 overflow-hidden p-5" style={classColorVars(c.name)}>
        <span aria-hidden className="class-bar absolute inset-y-0 left-0 w-1.5" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
              <span className="class-chip rounded-md px-1.5 py-0.5 font-mono font-bold">{c.code}</span>
              {[c.period, c.workloadHours ? `${c.workloadHours}h` : "", c.schedule].filter(Boolean).join(" · ")}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{prettyClassName(c.name)}</h1>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <ClassSwitcher id={id} section={tab} />
            {tab === "aulas" && <Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />}
          </div>
        </div>
        {c.lessonsTotal > 0 && (
          <div className="mt-4 flex max-w-md items-center gap-3 text-xs text-muted">
            <ProgressBar value={progress} label="Aulas ministradas" className="h-1.5" />
            <span className="shrink-0 tabular">
              {c.lessonsTaught}/{c.lessonsTotal} aulas dadas
            </span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <ClassMenu id={id} active={tab} />
        <section aria-label={sectionLabel} className="min-w-0">
          {tab !== "aulas" && <h2 className="mb-3 flex h-8 items-center text-lg font-semibold">{sectionLabel}</h2>}
          {tab === "aulas" && <TopicsPanel overview={c} onTab={(t) => navigate(sectionPath(id, t))} />}
          {tab === "frequencia" && <AttendancePanel id={id} />}
          {tab === "notas" && <GradesPanel id={id} />}
          {tab === "tarefas" && <TasksPanel id={id} />}
          {tab === "arquivos" && <FilesPanel id={id} />}
          {tab === "noticias" && <NewsPanel id={id} />}
          {tab === "avaliacoes" && <EvaluationsPanel id={id} />}
          {tab === "plano" && <PlanPanel id={id} />}
          {tab === "participantes" && <ParticipantsPanel id={id} />}
          {tab === "referencias" && <ReferencesPanel id={id} />}
        </section>
      </div>
    </div>
  );
}
