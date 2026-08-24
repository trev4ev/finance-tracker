"use client";

import { formatMoney, formatSignedMoney } from "@/lib/money";

export function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "income" | "expense";
  hint?: string;
}) {
  const color =
    tone === "income"
      ? "text-income"
      : tone === "expense"
        ? "text-expense"
        : value < 0
          ? "text-expense"
          : "text-foreground";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </p>
      <p className={`mt-2 font-mono text-2xl font-semibold ${color}`}>
        {tone === "neutral" ? formatMoney(value) : formatSignedMoney(value)}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
