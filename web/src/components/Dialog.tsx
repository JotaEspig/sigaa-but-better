import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Accessible modal built on the native <dialog> element: focus trapping,
 * Esc-to-close and the backdrop come for free from showModal().
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself, outside the panel) closes it.
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[min(85dvh,48rem)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-black/50"
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="text-lg leading-snug font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="-m-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
              <X className="size-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
