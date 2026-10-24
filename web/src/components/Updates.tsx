import clsx from "clsx";
import { Bell } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useDashboard } from "../api/hooks";
import type { Dashboard } from "../api/types";
import { normalizeClassName } from "../lib/classStats";
import { formatShortDate, updateMessage } from "../lib/format";
import { ClassDot, prettyClassName } from "./ClassBits";
import { EmptyState } from "./ui";
import { Tabs } from "./Tabs";

/**
 * Class updates and the course forum live behind the bell in the page header,
 * so the dashboard only shows the latest two. The dashboard's "Ver todas"
 * opens the same menu through this context.
 */
export const UpdatesContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => {} });

export const useUpdatesMenu = () => useContext(UpdatesContext);

// Newest update date the user has seen, so the bell's dot means "something new".
const SEEN_KEY = "sbb-updates-seen";

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

type FeedTab = "turmas" | "forum";

function ForumRow({ t, onNavigate }: { t: Dashboard["forum"][number]; onNavigate: () => void }) {
  const body = (
    <>
      <p className="line-clamp-2 font-medium">{t.title}</p>
      <p className="mt-0.5 truncate text-xs text-subtle">
        {t.author} · {formatShortDate(t.date.slice(0, 10))}
        {t.replies > 0 && ` · ${t.replies} ${t.replies === 1 ? "resposta" : "respostas"}`}
      </p>
    </>
  );
  return t.id ? (
    <Link to={`/forum/${t.id}`} onClick={onNavigate} className="block px-4 py-3 text-sm transition-colors hover:bg-surface-2">
      {body}
    </Link>
  ) : (
    <div className="px-4 py-3 text-sm">{body}</div>
  );
}

function Feed({ data, onNavigate }: { data: Dashboard; onNavigate: () => void }) {
  const [tab, setTab] = useState<FeedTab>("turmas");
  const idByName = new Map(data.classes.map((c) => [normalizeClassName(c.name), c.id]));
  return (
    <>
      <div className="px-3">
        <Tabs
          idPrefix="feed"
          label="Novidades"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "turmas", label: "Turmas" },
            { key: "forum", label: "Fórum do curso" },
          ]}
        />
      </div>
      <div role="tabpanel" id={`feed-panel-${tab}`} aria-labelledby={`feed-tab-${tab}`} className="max-h-[min(28rem,70dvh)] overflow-y-auto">
        {tab === "turmas" ? (
          data.updates.length ? (
            <ul className="divide-y divide-line-soft">
              {data.updates.map((u, i) => {
                const id = idByName.get(normalizeClassName(u.className));
                return (
                  <li key={i} className="flex gap-3 px-4 py-3">
                    <ClassDot name={u.className} className="mt-1.5 rounded-[2px]! size-[7px]!" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="line-clamp-2" title={u.description}>{updateMessage(u.description)}</p>
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        {id ? (
                          <Link to={`/turmas/${id}`} onClick={onNavigate} className="hover:text-fg hover:underline">
                            {prettyClassName(u.className)}
                          </Link>
                        ) : (
                          prettyClassName(u.className)
                        )}{" "}
                        · {formatShortDate(u.date)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Sem novidades" className="py-8" />
          )
        ) : data.forum.length ? (
          <ul className="divide-y divide-line-soft">
            {data.forum.map((t, i) => (
              <li key={t.id ?? i}>
                <ForumRow t={t} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhum tópico" className="py-8" />
        )}
        {tab === "forum" && (
          <Link to="/forum" onClick={onNavigate} className="block border-t border-line-soft px-4 py-2.5 text-center text-xs text-muted hover:text-fg">
            Ver fórum completo
          </Link>
        )}
      </div>
    </>
  );
}

export function UpdatesBell() {
  const { open, setOpen } = useUpdatesMenu();
  const q = useDashboard();
  const data = q.data?.data;
  const [seen, setSeen] = useState(readSeen);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const newest = data?.updates.reduce((m, u) => (u.date > m ? u.date : m), "") ?? "";
  const unread = newest !== "" && newest > seen;

  // Closing clears the dot; opening (here or from the dashboard) records what was seen.
  const close = useCallback(() => {
    setOpen(false);
    setSeen(readSeen());
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    if (newest) {
      try {
        localStorage.setItem(SEEN_KEY, newest);
      } catch {
        // Ignore: the dot just comes back next visit.
      }
    }
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, newest, close]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? "Novidades (há itens novos)" : "Novidades"}
        title="Novidades"
        className={clsx("relative grid size-8.5 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:text-fg", open && "text-fg")}
      >
        <Bell className="size-4" />
        {unread && <span aria-hidden className="absolute top-1.5 right-2 size-[7px] rounded-full bg-danger ring-2 ring-surface" />}
      </button>
      {open && (
        <div
          role="region"
          aria-label="Novidades"
          className="animate-in fixed inset-x-3 top-16 z-40 overflow-hidden rounded-xl border border-line bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96"
        >
          <p className="px-4 pt-3.5 pb-1 text-sm font-semibold">Novidades</p>
          {data ? <Feed data={data} onNavigate={close} /> : <p className="px-4 py-6 text-sm text-muted">Carregando…</p>}
        </div>
      )}
    </div>
  );
}
