import clsx from "clsx";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { IS_MOCK } from "../api/client";
import { useDashboard, useLogout, useSession } from "../api/hooks";
import { titleCase } from "../lib/format";
import { prettyClassName } from "./ClassBits";
import { LogoMark } from "./Logo";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface MenuItem {
  label: string;
  to: string;
  hint?: string;
}

interface MenuGroupDef {
  label: string;
  items: MenuItem[];
}

/** The "Menu Discente": same paths as SIGAA, fewer clicks. */
function useMenu(): MenuGroupDef[] {
  const dashboard = useDashboard();
  const classes = dashboard.data?.data.classes ?? [];
  return [
    {
      label: "Ensino",
      items: [
        { label: "Minhas notas", to: "/notas", hint: "Boletim de todos os semestres" },
        { label: "Horários", to: "/horarios", hint: "Grade da semana" },
        { label: "Índices e integralização", to: "/progresso", hint: "IRA, MC e carga horária" },
        { label: "Atividades complementares", to: "/progresso#complementares", hint: "Horas registradas e aprovadas" },
        { label: "Calendário acadêmico", to: "/calendario", hint: "Prazos do semestre" },
        { label: "Fórum do curso", to: "/forum", hint: "Avisos da coordenação" },
        { label: "Emitir histórico", to: "/progresso#historico", hint: "PDF oficial do SIGAA" },
      ],
    },
    {
      label: "Turmas virtuais",
      items: [
        ...classes.map((c) => ({ label: prettyClassName(c.name), to: `/turmas/${c.id}`, hint: c.location })),
        { label: "Todas as turmas do semestre", to: "/turmas" },
        { label: "Turmas anteriores", to: "/turmas/anteriores", hint: "Materiais de semestres passados" },
      ],
    },
  ];
}

function isActiveGroup(group: MenuGroupDef, pathname: string): boolean {
  return group.items.some((i) => {
    const path = i.to.split("#")[0]!;
    return path === "/turmas" ? pathname.startsWith("/turmas") : pathname === path || pathname.startsWith(`${path}/`);
  });
}

function MenuDropdown({ group }: { group: MenuGroupDef }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const active = isActiveGroup(group, pathname);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex h-11 items-center gap-1 border-b-2 px-3 text-sm font-medium transition-colors",
          active ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg",
        )}
      >
        {group.label}
        <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-40 mt-1 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          {group.items.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-surface-2">
              <span className="block text-sm font-medium">{item.label}</span>
              {item.hint && <span className="block truncate text-xs text-muted">{item.hint}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TopLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        clsx(
          "flex h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors",
          isActive ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg",
        )
      }
    >
      {label}
    </NavLink>
  );
}

function MobileMenu({ groups, onClose }: { groups: MenuGroupDef[]; onClose: () => void }) {
  return (
    <div className="border-b border-line bg-surface md:hidden">
      <nav aria-label="Menu" className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <Link to="/" onClick={onClose} className="block text-sm font-semibold">
          Portal do Discente
        </Link>
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{g.label}</p>
            <ul>
              {g.items.map((i) => (
                <li key={i.to}>
                  <Link to={i.to} onClick={onClose} className="block rounded-lg px-2 py-2 text-sm hover:bg-surface-2">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <ThemeSwitcher />
      </nav>
    </div>
  );
}

export function Layout() {
  const session = useSession();
  const dashboard = useDashboard();
  const logout = useLogout();
  const navigate = useNavigate();
  const groups = useMenu();
  const [mobileOpen, setMobileOpen] = useState(false);
  const info = session.data?.data;
  const period = dashboard.data?.data.profile.currentPeriod;
  const signOut = () => logout.mutate(undefined, { onSettled: () => navigate("/login", { replace: true }) });

  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="sr-only z-50 rounded-lg bg-brand px-3 py-2 text-brand-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Pular para o conteúdo
      </a>

      <header>
        {/* Top bar: who you are and which semester, like SIGAA's header. */}
        <div className="bg-bar text-bar-fg">
          <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <LogoMark className="size-6" onBar />
              <span>SIGAA But Better</span>
            </Link>
            <span className="hidden text-xs text-bar-fg/70 lg:inline">não oficial · somente leitura</span>
            <div className="ml-auto flex items-center gap-3 text-xs">
              {period && (
                <span className="hidden sm:inline">
                  Semestre <strong className="font-semibold tabular">{period}</strong>
                </span>
              )}
              {info && (
                <span className="hidden text-bar-fg/90 md:inline" title={info.name}>
                  {titleCase(info.name.split(" ")[0] ?? "")} <span className="text-bar-fg/60 tabular">{info.matricula}</span>
                </span>
              )}
              <div className="hidden md:block">
                <ThemeSwitcher compact onBar />
              </div>
              <button
                type="button"
                onClick={signOut}
                disabled={logout.isPending}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 font-medium hover:bg-bar-tint"
                aria-label="Sair"
              >
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>

        {/* Menu bar */}
        <div className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl items-center px-2 sm:px-4">
            <nav aria-label="Principal" className="hidden items-center md:flex">
              <TopLink to="/" label="Portal do Discente" />
              {groups.map((g) => (
                <MenuDropdown key={g.label} group={g} />
              ))}
            </nav>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              className="flex h-11 items-center gap-2 px-2 text-sm font-medium md:hidden"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              Menu
            </button>
          </div>
        </div>
        {mobileOpen && <MobileMenu groups={groups} onClose={() => setMobileOpen(false)} />}
      </header>

      {IS_MOCK && <div className="bg-warning-soft px-4 py-1.5 text-center text-xs font-medium text-warning">Modo demonstração: dados fictícios (VITE_MOCK=1)</div>}

      <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
