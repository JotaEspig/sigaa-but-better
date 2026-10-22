import clsx from "clsx";

/** Project mark: our own "S" monogram, deliberately unlike any official IFC/SIGAA logo. */
export function LogoMark({ className, onBar }: { className?: string; onBar?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={clsx("shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill={onBar ? "#ffffff" : "var(--brand)"} />
      <path
        d="M9 21.5c1.4 1.2 3.2 1.9 5.2 1.9 2.6 0 4.3-1.3 4.3-3.3 0-4.2-8.9-2.7-8.9-8 0-2.6 2.2-4.5 5.4-4.5 1.8 0 3.4.5 4.6 1.4"
        fill="none"
        stroke={onBar ? "#1f7a33" : "var(--brand-fg)"}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="23.5" cy="22" r="2.4" fill="#ffd166" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("flex items-center gap-2.5", className)}>
      <LogoMark className="size-8" />
      <span className="leading-tight">
        <span className="block text-[0.95rem] font-bold tracking-tight">SIGAA But Better</span>
        <span className="block text-[0.7rem] font-medium text-muted">não oficial · somente leitura</span>
      </span>
    </span>
  );
}
