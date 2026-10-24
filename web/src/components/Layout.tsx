import clsx from "clsx";
import { CalendarDays, CalendarRange, ChartNoAxesColumn, FileText, History, LayoutDashboard, LayoutGrid, ListChecks, LogOut, Menu, MessagesSquare, ScrollText, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { IS_MOCK } from "../api/client";
import { useDashboard, useLogout, useSession } from "../api/hooks";
import { useClassStats } from "../lib/classStats";
import { initials, titleCase } from "../lib/format";
import { ClassDot, prettyClassName } from "./ClassBits";
import { LogoMark } from "./Logo";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { TopBarContext, type TopBarSlots } from "./topbar";
import { UpdatesBell, UpdatesContext } from "./Updates";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

/** SIGAA's "Menu Discente" names, so the paths feel familiar. */
const NAV: NavItem[] = [
  { label: "Portal do discente", to: "/", icon: LayoutDashboard, end: true },
  { label: "Horários", to: "/horarios", icon: CalendarDays },
  { label: "Calendário acadêmico", to: "/calendario", icon: CalendarRange },
  { label: "Minhas notas", to: "/notas", icon: FileText },
  { label: "Índices e integralização", to: "/progresso", icon: ChartNoAxesColumn },
  { label: "Atividades complementares", to: "/progresso#complementares", icon: ListChecks },
  { label: "Fórum do curso", to: "/forum", icon: MessagesSquare },
  { label: "Emitir histórico", to: "/progresso#historico", icon: ScrollText },
];

const itemClass = (active: boolean) =>
  clsx(
    "flex h-8.5 items-center gap-2.5 rounded-lg px-2.5 text-[0.8125rem] transition-colors",
    active ? "bg-surface font-medium text-fg ring-1 ring-line" : "text-fg/80 hover:bg-surface/70 hover:text-fg",
  );

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const session = useSession();
  const dashboard = useDashboard();
  const logout = useLogout();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const info = session.data?.data;
  const data = dashboard.data?.data;
  const classes = data?.classes ?? [];
  const stats = useClassStats(classes);
  const signOut = () => logout.mutate(undefined, { onSettled: () => navigate("/login", { replace: true }) });

  // Some items are anchors on /progresso; only one of them should look selected.
  const anchors = NAV.flatMap((i) => (i.to.startsWith("/progresso#") ? [i.to.slice("/progresso".length)] : []));
  const isActive = (item: NavItem) => {
    const [path, anchor] = item.to.split("#");
    if (item.end) return pathname === path;
    if (path === "/progresso") return pathname === path && (anchor ? hash === `#${anchor}` : !anchors.includes(hash));
    return pathname.startsWith(path ?? "");
  };

  return (
    <div className="flex h-full flex-col gap-6 px-3.5 py-4">
      <Link to="/" onClick={onNavigate} className="flex h-10 items-center gap-2.5 rounded-lg px-2.5">
        <LogoMark className="size-6.5" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold tracking-tight">SIGAA But Better</span>
          <span className="block truncate text-xs text-subtle">IFC · não oficial</span>
        </span>
      </Link>

      <nav aria-label="Principal" className="flex flex-col gap-px">
        {NAV.map((item) => {
          const active = isActive(item);
          return (
            <Link key={item.to} to={item.to} onClick={onNavigate} aria-current={active ? "page" : undefined} className={itemClass(active)}>
              <item.icon className={clsx("size-4 shrink-0", active ? "text-fg" : "text-subtle")} strokeWidth={1.75} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Turmas virtuais" className="flex flex-col gap-px">
        <p className="flex items-center justify-between px-2.5 pb-1.5 text-xs font-medium text-subtle">
          <span>Turmas virtuais</span>
          {data && <span className="tabular">{data.profile.currentPeriod}</span>}
        </p>
        {classes.map((c) => {
          const risky = stats.get(c.id)?.atRisk;
          return (
            <NavLink key={c.id} to={`/turmas/${c.id}`} onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
              <span className="grid size-4 shrink-0 place-items-center">
                <ClassDot name={c.name} className="rounded-[2px]! size-2!" />
              </span>
              <span className="flex-1 truncate">{prettyClassName(c.name)}</span>
              {risky && (
                <span className="size-1.5 shrink-0 rounded-full bg-danger" title="Perto do limite de faltas">
                  <span className="sr-only">(perto do limite de faltas)</span>
                </span>
              )}
            </NavLink>
          );
        })}
        <NavLink to="/turmas" end onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
          <LayoutGrid className="size-4 shrink-0 text-subtle" strokeWidth={1.75} />
          <span className="truncate">Todas as turmas</span>
        </NavLink>
        <NavLink to="/turmas/anteriores" onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
          <History className="size-4 shrink-0 text-subtle" strokeWidth={1.75} />
          <span className="truncate">Turmas anteriores</span>
        </NavLink>
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center justify-between px-2.5">
          <span className="text-xs font-medium text-subtle">Tema</span>
          <ThemeSwitcher compact />
        </div>
        <div className="flex h-12 items-center gap-2.5 rounded-lg px-2">
          <span aria-hidden className="grid size-7.5 shrink-0 place-items-center rounded-full bg-tick-empty text-[0.7rem] font-semibold">
            {info ? initials(info.name) : "?"}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[0.8125rem] font-semibold">{info ? titleCase(info.name.split(" ")[0] ?? "") : ""}</span>
            <span className="block truncate text-xs text-subtle tabular">{info?.matricula}</span>
          </span>
          <button
            type="button"
            onClick={signOut}
            disabled={logout.isPending}
            className="grid size-8 place-items-center rounded-md text-subtle hover:bg-surface hover:text-fg"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [slots, setSlots] = useState<TopBarSlots>({ title: null, actions: null });
  // Stable refs: a new callback per render would detach/attach and loop on setState.
  const titleRef = useCallback((el: HTMLDivElement | null) => setSlots((s) => (s.title === el ? s : { ...s, title: el })), []);
  const actionsRef = useCallback((el: HTMLDivElement | null) => setSlots((s) => (s.actions === el ? s : { ...s, actions: el })), []);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const updates = useMemo(() => ({ open: updatesOpen, setOpen: setUpdatesOpen }), [updatesOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <TopBarContext.Provider value={slots}>
      <UpdatesContext.Provider value={updates}>
        <div className="min-h-dvh lg:flex">
          <a href="#conteudo" className="sr-only z-50 rounded-lg bg-brand px-3 py-2 text-brand-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
            Pular para o conteúdo
          </a>

          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-0 h-dvh">
              <Sidebar />
            </div>
          </aside>

          {drawerOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
              <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
              <div className="animate-in absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-bg shadow-pop">
                <Sidebar onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          )}

          <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
            {/* Mobile only: the sidebar collapses into a drawer. */}
            <div className="sticky top-0 z-30 flex h-13 items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur lg:hidden">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Abrir menu"
                aria-expanded={drawerOpen}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface"
              >
                {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
              <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <LogoMark className="size-6" />
                SIGAA But Better
              </Link>
            </div>

            {IS_MOCK && <div className="bg-warning-soft px-4 py-1.5 text-center text-xs font-medium text-warning">Modo demonstração: dados fictícios (VITE_MOCK=1)</div>}

            <div className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-4 pb-16 sm:px-6 lg:pr-7 lg:pl-2">
              <header className="flex min-h-18 flex-wrap items-center gap-x-3 gap-y-2 py-4 lg:pt-5">
                <div ref={titleRef} className="flex min-w-0 flex-1 items-center gap-3" />
                <div className="flex shrink-0 items-center gap-2">
                  <div ref={actionsRef} className="flex items-center gap-2" />
                  <UpdatesBell />
                </div>
              </header>

              <main id="conteudo" className="w-full flex-1">
                <Outlet />
              </main>
            </div>
          </div>
        </div>
      </UpdatesContext.Provider>
    </TopBarContext.Provider>
  );
}
