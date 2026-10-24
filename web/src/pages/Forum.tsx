import { ExternalLink, MessageSquare, MessagesSquare, Search } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { OFFICIAL_SIGAA_URL } from "../api/client";
import { useForum, useForumThread } from "../api/hooks";
import { EmptyState, ErrorState, Freshness, PageHeader, SkeletonCard } from "../components/ui";
import { formatDateTime, titleCase } from "../lib/format";

const crumbs = [{ label: "Portal do Discente", to: "/" }, { label: "Fórum do curso", to: "/forum" }];

function ReadOnlyNote() {
  return (
    <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-sm text-muted">
      <span>Somente leitura: para criar tópicos, responder ou seguir, use o SIGAA oficial.</span>
      <a href={OFFICIAL_SIGAA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-strong underline underline-offset-2">
        Abrir SIGAA <ExternalLink className="size-3.5" />
      </a>
    </p>
  );
}

function TopicList() {
  const q = useForum();
  const [filter, setFilter] = useState("");
  if (q.isPending) return <SkeletonCard lines={8} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const f = filter.trim().toLocaleLowerCase("pt-BR");
  const topics = q.data.data.filter((t) => !f || t.title.toLocaleLowerCase("pt-BR").includes(f));

  return (
    <div className="animate-in">
      <PageHeader
        title="Fórum do curso"
        subtitle="Avisos da coordenação e discussões do curso"
        crumbs={[crumbs[0]!, { label: "Fórum do curso" }]}
        actions={<Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />}
      />
      <ReadOnlyNote />
      <label className="mb-4 flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm focus-within:border-brand">
        <Search className="size-4 text-subtle" />
        <span className="sr-only">Filtrar tópicos</span>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por título" className="h-full flex-1 bg-transparent outline-none" />
      </label>
      {topics.length === 0 ? (
        <EmptyState icon={MessagesSquare} title={f ? "Nenhum tópico com esse título" : "Nenhum tópico"} className="card" />
      ) : (
        <ul className="card divide-y divide-line">
          {topics.map((t, i) => {
            const body = (
              <>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                  <MessageSquare className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium group-hover:text-brand-strong">{t.title}</span>
                  <span className="block text-xs text-muted">
                    {titleCase(t.author)} · {formatDateTime(t.date)}
                  </span>
                </span>
                {t.replies > 0 && (
                  <span className="shrink-0 text-xs text-muted tabular">
                    {t.replies} {t.replies === 1 ? "resposta" : "respostas"}
                  </span>
                )}
              </>
            );
            return (
              <li key={t.id ?? i}>
                {t.id ? (
                  <Link to={`/forum/${t.id}`} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2/50">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Thread({ id }: { id: string }) {
  const q = useForumThread(id);
  if (q.isPending) return <SkeletonCard lines={6} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const t = q.data.data;
  return (
    <div className="animate-in">
      <PageHeader title={t.title} crumbs={crumbs} actions={<Freshness fetchedAt={q.data.fetchedAt} onRefresh={q.refresh} refreshing={q.refreshing} />} />
      <ReadOnlyNote />
      <ol className="space-y-4">
        {t.posts.map((p, i) => (
          <li key={i}>
            <article className="card p-5">
              <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{titleCase(p.author)}</p>
                <p className="text-xs text-muted tabular">{formatDateTime(p.date)}</p>
              </header>
              <div className="prose-sigaa text-sm" dangerouslySetInnerHTML={{ __html: p.html }} />
            </article>
          </li>
        ))}
      </ol>
      {t.posts.length === 0 && <EmptyState icon={MessagesSquare} title="Nenhuma mensagem" className="card" />}
    </div>
  );
}

export default function ForumPage() {
  const { id } = useParams();
  return id ? <Thread id={id} /> : <TopicList />;
}
