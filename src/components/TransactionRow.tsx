"use client";

import { ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { Account, Category, Transaction } from "@/lib/types";

export function TransactionRow({
  tx,
  category,
  account,
  toAccount,
  onClick,
}: {
  tx: Transaction;
  category?: Category;
  account?: Account;
  toAccount?: Account;
  onClick: () => void;
}) {
  const subtitle =
    tx.type === "transfer"
      ? `${account?.name ?? "Account"} → ${toAccount?.name ?? "Account"}`
      : [category?.name ?? "Uncategorized", account?.name]
          .filter(Boolean)
          .join(" · ");
  const color = category?.color ?? "#64748b";
  const label = (tx.merchantName ?? tx.description).trim().slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-surface-2/80"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        style={{ background: `${color}24`, color }}
      >
        {label || "•"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{tx.description}</span>
          {tx.pending ? (
            <span className="shrink-0 text-[10px] font-medium tracking-wide text-muted uppercase">
              pending
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted">{subtitle}</span>
      </span>
      <span
        className={`shrink-0 font-mono text-sm ${
          tx.type === "income"
            ? "text-income"
            : tx.type === "expense"
              ? "text-expense"
              : "text-muted"
        }`}
      >
        {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
        {formatMoney(tx.amount)}
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
    </button>
  );
}
