"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Fab } from "@/components/Fab";
import { Modal } from "@/components/Modal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionRow } from "@/components/TransactionRow";
import { formatDayHeading, formatDisplayDate } from "@/lib/dates";
import { groupTransactionsByDate, lookup, sortTransactions } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { useFinance } from "@/lib/store";
import type { Transaction, TransactionType } from "@/lib/types";

const TYPE_FILTERS: { value: "all" | TransactionType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Spent" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Moves" },
];

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
      return [tx.description, tx.notes, account, category, tx.merchantName ?? ""].some(
        (value) => value.toLowerCase().includes(q),
      );
    });
  }, [query, state, typeFilter]);

  const groups = useMemo(() => groupTransactionsByDate(rows), [rows]);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Transactions
          </h2>
          <p className="text-sm text-muted">{rows.length} shown</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="hidden h-11 items-center gap-2 rounded-2xl bg-accent px-4 text-sm font-medium text-background lg:inline-flex"
        >
          <Plus size={16} />
          Add transaction
        </button>
      </header>

      <div className="sticky top-0 z-20 -mx-4 space-y-3 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search payees, notes, accounts…"
            className="h-11 w-full rounded-2xl border border-border bg-surface py-2 pr-3 pl-9 text-base outline-none focus:border-accent sm:text-sm"
          />
        </label>
        <SegmentedControl
          value={typeFilter}
          onChange={setTypeFilter}
          options={TYPE_FILTERS}
        />
      </div>

      <div className="space-y-4 md:hidden">
        {groups.map((group) => (
          <section key={group.date}>
            <h3 className="px-1 pb-2 text-xs font-medium tracking-wide text-muted uppercase">
              {formatDayHeading(group.date)}
            </h3>
            <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-surface">
              {group.items.map((tx) => (
                <li key={tx.id}>
                  <TransactionRow
                    tx={tx}
                    category={lookup(state.categories, tx.categoryId)}
                    account={lookup(state.accounts, tx.accountId)}
                    toAccount={lookup(state.accounts, tx.toAccountId)}
                    onClick={() => setEditing(tx)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {rows.length === 0 ? (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="w-full rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted active:bg-surface"
          >
            No transactions match these filters.
            <span className="mt-1 block text-accent">Tap to add one</span>
          </button>
        ) : null}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium">Account</th>
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
                  <td className="px-4 py-3 text-muted">{account?.name}</td>
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

      {editing ? null : (
        <Fab label="Add transaction" onClick={() => setEditing("new")} />
      )}

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
              className="mt-3 min-h-11 w-full rounded-xl border border-expense/30 px-4 py-2 text-sm text-expense active:bg-expense/10"
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
