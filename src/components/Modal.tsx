"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        onClose();
      }
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="sheet-panel relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-surface px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] shadow-2xl sm:rounded-2xl sm:pt-5"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="pt-1 text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted active:bg-surface-2 active:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
