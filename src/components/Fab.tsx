"use client";

import { Plus } from "lucide-react";

export function Fab({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-background shadow-lg shadow-black/40 active:scale-95 lg:hidden"
      style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <Plus size={26} strokeWidth={2.5} />
    </button>
  );
}
