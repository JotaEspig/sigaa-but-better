import clsx from "clsx";
import { AlertTriangle, ChevronRight, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { forwardRef, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from "react";
import { isApiError } from "../api/client";
import { relativeTime } from "../lib/format";
import type { Tone } from "../lib/colors";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand-strong shadow-soft",
  secondary: "bg-surface text-fg border border-line hover:bg-surface-2 shadow-soft",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean }
>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-base",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function Card({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" | "aside" }) {
  return <As className={clsx("card", className)}>{children}</As>;
}

export function CardHeader({
  title,
  icon: Icon,
  action,
  subtitle,
}: {
  title: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-strong">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[0.95rem] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

const toneClasses: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-muted",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} aria-hidden />;
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx("card space-y-3 p-5", className)} aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={clsx("h-4", i % 2 ? "w-4/5" : "w-full")} />
      ))}
    </div>
  );
}

const errorMessages: Record<string, string> = {
  SIGAA_UNAVAILABLE: "O SIGAA não respondeu. Ele pode estar fora do ar ou lento.",
  PARSE_ERROR: "O SIGAA respondeu em um formato inesperado. Talvez o layout tenha mudado.",
  RATE_LIMITED: "Muitas requisições em pouco tempo. Aguarde alguns segundos.",
  NOT_FOUND: "Não encontramos isso no SIGAA.",
};

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const msg = isApiError(error) ? (errorMessages[error.code] ?? error.message) : "Algo deu errado.";
  return (
    <div role="alert" className={clsx("flex flex-col items-center gap-3 text-center", compact ? "p-5" : "card p-8")}>
      <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-5" />
      </span>
      <div>
        <p className="font-semibold">Não foi possível carregar</p>
        <p className="mt-1 max-w-md text-sm text-muted">{msg}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" /> Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-subtle">
        <Icon className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
    </div>
  );
}

/** "Atualizado há 3 min · ↻" — the refresh bypasses the BFF cache. */
export function Freshness({ fetchedAt, onRefresh, refreshing }: { fetchedAt?: string; onRefresh: () => void; refreshing?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted">
      {fetchedAt && <span className="hidden sm:inline">Atualizado {relativeTime(fetchedAt)}</span>}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="grid size-8 place-items-center rounded-lg hover:bg-surface-2 hover:text-fg disabled:opacity-60"
        aria-label="Atualizar dados do SIGAA"
        title={fetchedAt ? `Atualizado ${relativeTime(fetchedAt)}. Clique para buscar de novo no SIGAA.` : "Atualizar"}
      >
        <RefreshCw className={clsx("size-4", refreshing && "animate-spin")} />
      </button>
    </div>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

/** SIGAA-style trail: "Portal do Discente › Ensino › Minhas notas". */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Você está em" className="mb-2 text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 text-subtle" aria-hidden />}
            {c.to && i < items.length - 1 ? (
              <Link to={c.to} className="hover:text-brand-strong hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className={i === items.length - 1 ? "font-medium text-fg" : undefined}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: Crumb[] }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Circular progress (SVG). `value` in 0–100. */
export function ProgressRing({ value, size = 120, stroke = 10, children, label }: { value: number; size?: number; stroke?: number; children?: ReactNode; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, tone = "brand", label, className }: { value: number; tone?: "brand" | "warning" | "danger"; label: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={clsx("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
    >
      <div
        className={clsx("h-full rounded-full transition-[width] duration-700 ease-out", tone === "brand" && "bg-brand", tone === "warning" && "bg-warning", tone === "danger" && "bg-danger")}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
