"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/** Bottom sheet on phones, centered dialog on larger screens. */
export default function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  // Portal + stopPropagation: React events bubble through portals, and sheets often sit inside clickable rows.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-card shadow-2xl md:max-w-lg md:rounded-3xl">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line md:hidden" />
        <div className="flex items-start gap-3 px-6 pb-2 pt-4">
          <div className="min-w-0 flex-1 text-[19px] font-semibold tracking-tight">{title}</div>
          <button onClick={onClose} aria-label="Schließen" className="grid size-8 shrink-0 place-items-center rounded-full bg-chip text-muted hover:text-ink">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}
