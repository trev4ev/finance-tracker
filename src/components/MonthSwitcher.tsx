"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, monthLabel } from "@/lib/dates";

export function MonthSwitcher({
  month,
  onChange,
  className = "",
}: {
  month: string;
  onChange: (month: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-2xl border border-border bg-surface ${className}`}
    >
      <button
        type="button"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted active:bg-surface-2 active:text-foreground"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="min-w-0 flex-1 px-1 text-center text-sm font-medium">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted active:bg-surface-2 active:text-foreground"
        onClick={() => onChange(addMonths(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
