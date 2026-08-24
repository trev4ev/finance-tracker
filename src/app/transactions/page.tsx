"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Modal } from "@/components/Modal";
import { TransactionForm } from "@/components/TransactionForm";
import { formatDisplayDate } from "@/lib/dates";
import { lookup, sortTransactions } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { useFinance } from "@/lib/store";
import type { Transaction, TransactionType } from "@/lib/types";

export default function TransactionsPage() {
  const { state, hydrated, addTransaction, updateTransaction, deleteTransaction } =
    useFinance();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortTransactions(state.transactions).filter((tx) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (!q) return true;
      const account = lookup(state.accounts, tx.accountId)?.name ?? "";
      const category = lookup(state.categories, tx.categoryId)?.name ?? "";
      return [tx.description, tx.notes, account, category].some((value) =>
        value.toLowerCase().includes(q),
      );
    });
  }, [query, state, typeFilter]);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Transactions</h2>
          <p className="text-sm text-muted">{rows.length} shown</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-background"
        >
          <Plus size={16} />
          Add transaction
        </button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search payees, notes, accounts…"
            className="w-full rounded-xl border border-border bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-accent"
          />
        </label>
        <select
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value as typeof typeFilter)
          }
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
          <option value="transfer">Transfers</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Account</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => {
              const account = lookup(state.accounts, tx.accountId);
              const toAccount = lookup(state.accounts, tx.toAccountId);
              const category = lookup(state.categories, tx.categoryId);
              return (
                <tr
                  key={tx.id}
                  className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-surface-2/50"
                  onClick={() => setEditing(tx)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {formatDisplayDate(tx.date)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {tx.description}
                      {tx.pending ? (
                        <span className="ml-2 text-[10px] font-normal tracking-wide text-muted uppercase">
                          pending
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      {tx.type === "transfer"
                        ? `${account?.name ?? "Account"} → ${toAccount?.name ?? "Account"}`
                        : category?.name ?? "Uncategorized"}
                      {tx.source === "plaid" ? " · Plaid" : ""}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {account?.name}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      tx.type === "income"
                        ? "text-income"
                        : tx.type === "expense"
                          ? "text-expense"
                          : "text-muted"
                    }`}
                  >
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                    {formatMoney(tx.amount)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted">
                  No transactions match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <Modal
          title={editing === "new" ? "Add transaction" : "Edit transaction"}
          onClose={() => setEditing(null)}
        >
          <TransactionForm
            state={state}
            initial={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSubmit={(tx) => {
              if (editing === "new") addTransaction(tx);
              else updateTransaction({ ...editing, ...tx, id: editing.id });
              setEditing(null);
            }}
          />
          {editing !== "new" ? (
            <button
              type="button"
              className="mt-3 w-full rounded-xl border border-expense/30 px-4 py-2 text-sm text-expense hover:bg-expense/10"
              onClick={() => {
                deleteTransaction(editing.id);
                setEditing(null);
              }}
            >
              Delete transaction
            </button>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
