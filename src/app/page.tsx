"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CashFlowChart } from "@/components/CashFlowChart";
import { CategoryDonut } from "@/components/CategoryDonut";
import { Modal } from "@/components/Modal";
import { StatCard } from "@/components/StatCard";
import { TransactionForm } from "@/components/TransactionForm";
import {
  addMonths,
  currentMonth,
  formatDisplayDate,
  lastNMonths,
  monthLabel,
} from "@/lib/dates";
import {
  accountBalance,
  lookup,
  monthTotals,
  netWorth,
  sortTransactions,
  spendingByCategory,
} from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { useFinance } from "@/lib/store";

export default function OverviewPage() {
  const { state, hydrated, addTransaction } = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);

  const totals = useMemo(
    () => monthTotals(state.transactions, month),
    [month, state.transactions],
  );
  const worth = useMemo(() => netWorth(state), [state]);
  const slices = useMemo(
    () => spendingByCategory(state, month),
    [month, state],
  );
  const cashflow = useMemo(
    () =>
      lastNMonths(6, month).map((item) => ({
        month: item,
        ...monthTotals(state.transactions, item),
      })),
    [month, state.transactions],
  );
  const recent = useMemo(
    () => sortTransactions(state.transactions).slice(0, 8),
    [state.transactions],
  );
  const accounts = useMemo(
    () =>
      state.accounts.map((account) => ({
        account,
        balance: accountBalance(account, state.transactions),
      })),
    [state],
  );

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Personal ledger</p>
          <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border bg-surface">
            <button
              type="button"
              className="p-2 text-muted hover:text-foreground"
              onClick={() => setMonth((prev) => addMonths(prev, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-36 text-center text-sm font-medium">
              {monthLabel(month)}
            </span>
            <button
              type="button"
              className="p-2 text-muted hover:text-foreground"
              onClick={() => setMonth((prev) => addMonths(prev, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-background"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Income"
          value={totals.income}
          tone="income"
          hint={monthLabel(month)}
        />
        <StatCard
          label="Expenses"
          value={-totals.expenses}
          tone="expense"
          hint={monthLabel(month)}
        />
        <StatCard
          label="Net cash flow"
          value={totals.net}
          hint={totals.net >= 0 ? "In the black" : "Spending more than you earn"}
        />
        <StatCard label="Net worth" value={worth} hint="All accounts combined" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="mb-4 font-medium">Spending by category</h3>
          <CategoryDonut slices={slices} />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">Cash flow</h3>
            <p className="text-xs text-muted">
              <span className="mr-2 text-income">● Income</span>
              <span className="text-expense">● Expenses</span>
            </p>
          </div>
          <CashFlowChart series={cashflow} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">Accounts</h3>
            <Link href="/accounts" className="text-sm text-accent">
              Manage
            </Link>
          </div>
          <ul className="space-y-3">
            {accounts.map(({ account, balance }) => (
              <li
                key={account.id}
                className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-muted capitalize">{account.type}</p>
                </div>
                <p
                  className={`font-mono text-sm ${
                    account.type === "credit" || balance < 0
                      ? "text-expense"
                      : "text-foreground"
                  }`}
                >
                  {account.type === "credit" && balance < 0
                    ? `${formatMoney(Math.abs(balance))} owed`
                    : formatMoney(balance)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">Recent activity</h3>
            <Link href="/transactions" className="text-sm text-accent">
              View all
            </Link>
          </div>
          <ul className="space-y-3">
            {recent.map((tx) => {
              const category = lookup(state.categories, tx.categoryId);
              const signed =
                tx.type === "income"
                  ? tx.amount
                  : tx.type === "expense"
                    ? -tx.amount
                    : 0;
              return (
                <li key={tx.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted">
                      {formatDisplayDate(tx.date)}
                      {category ? ` · ${category.name}` : ""}
                    </p>
                  </div>
                  <p
                    className={`font-mono text-sm ${
                      tx.type === "income"
                        ? "text-income"
                        : tx.type === "expense"
                          ? "text-expense"
                          : "text-muted"
                    }`}
                  >
                    {tx.type === "transfer"
                      ? formatMoney(tx.amount)
                      : `${signed > 0 ? "+" : "-"}${formatMoney(tx.amount)}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {open ? (
        <Modal title="Add transaction" onClose={() => setOpen(false)}>
          <TransactionForm
            state={state}
            onCancel={() => setOpen(false)}
            onSubmit={(tx) => {
              addTransaction(tx);
              setOpen(false);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
