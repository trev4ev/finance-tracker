"use client";

import Link from "next/link";
import { formatMoney, formatSignedMoney } from "@/lib/money";

export function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
  href,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "income" | "expense";
  hint?: string;
  href?: string;
}) {
  const color =
    tone === "income"
      ? "text-income"
      : tone === "expense"
        ? "text-expense"
        : value < 0
          ? "text-expense"
          : "text-foreground";

  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </p>
      <p className={`mt-2 font-mono text-2xl font-semibold ${color}`}>
        {tone === "neutral" ? formatMoney(value) : formatSignedMoney(value)}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-2xl border border-border bg-surface p-4 hover:border-accent/40"
      >
        {body}
      </Link>
    );
  }

  return <div className="rounded-2xl border border-border bg-surface p-4">{body}</div>;
}
