import { Award, FileDown, Info, ShieldAlert, TrendingUp, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { TRANSCRIPT_URL } from "../api/client";
import { useComplementaryActivities, useDashboard } from "../api/hooks";
import { Dialog } from "../components/Dialog";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Freshness, PageHeader, ProgressBar, ProgressRing, SkeletonCard } from "../components/ui";
import { situationTone } from "../lib/colors";
import { formatDate, formatNumber, titleCase } from "../lib/format";

/** Indices that are normalized against the course (hundreds/thousands scale) read better without 4 decimals. */
const LARGE_SCALE = new Set(["MCN", "IEAN"]);

export default function ProgressPage() {
  const q = useDashboard();
  const [confirm, setConfirm] = useState(false);
  const { hash } = useLocation();
  const ready = q.isSuccess;
  useEffect(() => {
    if (ready && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [ready, hash]);

  if (q.isPending)
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { indices, progress: p, profile } = q.data.data;
  const pending = p.mandatoryPendingHours + p.optionalPendingHours + p.complementaryPendingHours;
  const done = Math.max(0, p.totalCurriculumHours - pending);
  const highlight = indices.filter((i) => i.code === "IRA" || i.code === "MC");
  const rest = indices.filter((i) => i.code !== "IRA" && i.code !== "MC");

  return (
    <div className="animate-in">
      <PageHeader
        title="Índices e integralização"
        subtitle={profile.course}
        crumbs={[{ label: "Portal do Discente", to: "/" }, { label: "Ensino" }, { label: "Índices e integralização" }]}
        actions={<Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader title="Integralização" icon={TrendingUp} subtitle={`${p.totalCurriculumHours} h no currículo`} />
          <div className="flex flex-col items-center gap-6 px-5 pb-6 sm:flex-row sm:items-center">
            <ProgressRing value={p.percent} size={160} stroke={14} label={`${formatNumber(p.percent, 1)}% integralizado`}>
              <span>
                <span className="block text-4xl font-bold tracking-tight tabular">{Math.floor(p.percent)}%</span>
                <span className="block text-xs text-muted">integralizado</span>
              </span>
            </ProgressRing>
            <dl className="w-full flex-1 space-y-4 text-sm">
              <Row label="Cursado (estimado)" value={`${done} h`} pct={(done / p.totalCurriculumHours) * 100} />
              <Row label="Obrigatórias pendentes" value={`${p.mandatoryPendingHours} h`} pct={(p.mandatoryPendingHours / p.totalCurriculumHours) * 100} muted />
              <Row label="Optativas pendentes" value={`${p.optionalPendingHours} h`} pct={(p.optionalPendingHours / p.totalCurriculumHours) * 100} muted />
              <Row label="Complementares pendentes" value={`${p.complementaryPendingHours} h`} pct={(p.complementaryPendingHours / p.totalCurriculumHours) * 100} muted />
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Dados do vínculo" icon={UserRound} />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 pb-5 text-sm sm:grid-cols-2">
            {(
              [
                ["Nome", titleCase(profile.name)],
                ["Matrícula", profile.matricula],
                ["Curso", profile.course],
                ["Nível", titleCase(profile.level)],
                ["Status", titleCase(profile.status)],
                ["Entrada", profile.entryPeriod],
                ["Campus", titleCase(profile.campus)],
                ["E-mail", profile.email],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className={k === "Curso" ? "sm:col-span-2" : undefined}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-medium break-words">{v || "–"}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="indices-title">
        <h2 id="indices-title" className="mb-3 text-sm font-semibold text-muted">
          Índices acadêmicos
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[...highlight, ...rest].map((i) => (
            <div key={i.code} className={highlight.includes(i) ? "card border-brand/40 bg-brand-soft/40 p-4" : "card p-4"} title={i.description}>
              <p className="flex items-center gap-1 text-xs font-semibold text-muted">
                {i.code}
                <Info className="size-3 text-subtle" aria-hidden />
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular">{formatNumber(i.value, LARGE_SCALE.has(i.code) ? 1 : 2)}</p>
              <p className="mt-1 line-clamp-2 text-[0.7rem] leading-snug text-muted">{i.description}</p>
            </div>
          ))}
        </div>
      </section>

      <ComplementarySection pendingHours={p.complementaryPendingHours} />

      <section id="historico" className="card mt-8 flex scroll-mt-6 flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
          <FileDown className="size-5" />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold">Histórico escolar</h2>
          <p className="text-sm text-muted">Baixe o histórico oficial em PDF, gerado pelo SIGAA.</p>
        </div>
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          <FileDown className="size-4" /> Emitir histórico (PDF)
        </Button>
      </section>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Emitir histórico oficial?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <a
              href={TRANSCRIPT_URL}
              onClick={() => setConfirm(false)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand-strong"
            >
              <FileDown className="size-4" /> Emitir e baixar
            </a>
          </>
        }
      >
        <div className="flex gap-3 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="space-y-2 text-muted">
            <p>
              O histórico é um <strong className="text-fg">documento oficial</strong>. Ao emiti-lo, o SIGAA registra um <strong className="text-fg">código de autenticação</strong>{" "}
              para validação, exatamente como acontece quando você emite pelo site oficial.
            </p>
            <p>Por isso ele nunca é gerado automaticamente nem guardado em cache: só quando você confirma aqui.</p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s.startsWith("ACEIT") || s.startsWith("DEFERID") || s.startsWith("APROVAD")) return "success" as const;
  if (s.startsWith("NEGAD") || s.startsWith("INDEFERID") || s.startsWith("RECUSAD")) return "danger" as const;
  if (s.includes("PENDENTE") || s.includes("ANÁLISE") || s.includes("SUBMETID")) return "warning" as const;
  return situationTone(status);
}

/** "Atividades autônomas" (horas complementares) registered in SIGAA. */
function ComplementarySection({ pendingHours }: { pendingHours: number }) {
  const q = useComplementaryActivities();
  const total = q.data?.data.groups.reduce((sum, g) => sum + g.approvedHours, 0) ?? 0;
  return (
    <Card className="mt-8" as="section">
      <div id="complementares" className="scroll-mt-6" />
      <CardHeader
        title="Atividades complementares"
        icon={Award}
        subtitle={
          q.data
            ? `${formatNumber(total, 0)} h aprovadas${pendingHours > 0 ? ` · ${pendingHours} h pendentes no currículo` : " · carga complementar integralizada"}`
            : undefined
        }
        action={q.data && <Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />}
      />
      {q.isPending ? (
        <SkeletonCard lines={3} className="border-0 shadow-none" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} compact />
      ) : q.data.data.groups.length === 0 ? (
        <EmptyState icon={Award} title="Nenhuma atividade registrada" description="Os registros são cadastrados pelo SIGAA oficial." />
      ) : (
        <div className="space-y-5 px-5 pb-5">
          {q.data.data.groups.map((g) => (
            <section key={g.category}>
              <h3 className="mb-2 flex items-baseline justify-between gap-3 text-sm font-semibold">
                {titleCase(g.category)}
                <span className="text-xs font-medium text-muted tabular">{formatNumber(g.approvedHours, 0)} h aprovadas</span>
              </h3>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {g.activities.map((a, i) => (
                  <li key={i} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
                    <span className="w-24 shrink-0 text-xs text-muted tabular">{formatDate(a.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{a.type}</span>
                      {a.description && <span className="block text-xs text-muted">{a.description}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold tabular">{formatNumber(a.hours, 0)} h</span>
                      <Badge tone={statusTone(a.status)}>{titleCase(a.status)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

function Row({ label, value, pct, muted }: { label: string; value: string; pct: number; muted?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <dt className={muted ? "text-muted" : "font-medium"}>{label}</dt>
        <dd className="font-semibold tabular">{value}</dd>
      </div>
      <ProgressBar value={pct} tone={muted ? "warning" : "brand"} label={label} className="h-1.5" />
    </div>
  );
}
