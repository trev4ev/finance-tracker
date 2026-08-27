"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { CashFlowChart } from "@/components/CashFlowChart";
import { CategoryDonut } from "@/components/CategoryDonut";
import { Fab } from "@/components/Fab";
import { Modal } from "@/components/Modal";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { StatCard } from "@/components/StatCard";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionRow } from "@/components/TransactionRow";
import {
  currentMonth,
  formatRelativeTimestamp,
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
import { formatMoney, formatSignedMoney } from "@/lib/money";
import { useFinance } from "@/lib/store";
import { transactionsHref } from "@/lib/transactions-href";
import type { Transaction } from "@/lib/types";

export default function OverviewPage() {
  const { state, hydrated, addTransaction, updateTransaction, deleteTransaction } =
    useFinance();
  const [month, setMonth] = useState(currentMonth());
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);

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
    () => sortTransactions(state.transactions).slice(0, 6),
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
  const flowTotal = totals.income + totals.expenses;
  const incomeShare = flowTotal === 0 ? 50 : (totals.income / flowTotal) * 100;

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="hidden lg:block">
          <p className="text-sm text-muted">Personal ledger</p>
          <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        </div>
        <div className="flex items-center gap-2">
          <MonthSwitcher
            month={month}
            onChange={setMonth}
            className="w-full lg:w-auto"
          />
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="hidden h-11 shrink-0 items-center gap-2 rounded-2xl bg-accent px-4 text-sm font-medium text-background lg:inline-flex"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-4 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Net this month
            </p>
            <p
              className={`mt-0.5 font-mono text-3xl font-semibold ${
                totals.net < 0 ? "text-expense" : "text-foreground"
              }`}
            >
              {formatMoney(totals.net)}
            </p>
          </div>
          <div className="pt-1 text-right">
            <p className="font-mono text-sm text-income">
              {formatSignedMoney(totals.income)}
            </p>
            <p className="font-mono text-sm text-expense">
              {formatSignedMoney(-totals.expenses)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="bg-income" style={{ width: `${incomeShare}%` }} />
          <div className="bg-expense" style={{ width: `${100 - incomeShare}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted">Net worth</span>
          <Link href="/accounts#history" className="font-mono font-medium">
            {formatMoney(worth)}
          </Link>
        </div>
      </section>

      <section className="hidden gap-3 lg:grid lg:grid-cols-4">
        <StatCard
          label="Income"
          value={totals.income}
          tone="income"
          hint={monthLabel(month)}
          href={transactionsHref({ type: "income", month })}
        />
        <StatCard
          label="Expenses"
          value={-totals.expenses}
          tone="expense"
          hint={monthLabel(month)}
          href={transactionsHref({ type: "expense", month })}
        />
        <StatCard
          label="Net cash flow"
          value={totals.net}
          hint={totals.net >= 0 ? "In the black" : "Spending more than you earn"}
        />
          <StatCard label="Net worth" value={worth} hint="All accounts combined" href="/accounts#history" />
      </section>

      <section className="lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Accounts</h3>
          <Link
            href="/accounts"
            className="inline-flex items-center text-sm text-accent"
          >
            Manage
            <ChevronRight size={16} />
          </Link>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 scroll-pl-4 sm:-mx-6 sm:px-6 sm:scroll-pl-6">
          {accounts.map(({ account, balance }) => (
            <Link
              key={account.id}
              href={transactionsHref({ account: account.id })}
              className="w-[min(70%,16rem)] shrink-0 snap-start rounded-2xl border border-border bg-surface px-4 py-3 active:scale-[0.99]"
            >
              <p className="text-[11px] tracking-wide text-muted uppercase">
                {account.type}
                {account.source === "plaid" ? " · linked" : ""}
              </p>
              <p className="mt-1 truncate font-medium">{account.name}</p>
              <p
                className={`mt-2 font-mono text-lg ${
                  account.type === "credit" || balance < 0
                    ? "text-expense"
                    : "text-foreground"
                }`}
              >
                {account.type === "credit" && balance < 0
                  ? `${formatMoney(Math.abs(balance))} owed`
                  : formatMoney(balance)}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 lg:hidden">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-medium">Recent</h3>
          <Link
            href="/transactions"
            className="inline-flex items-center text-sm text-accent"
          >
            View all
            <ChevronRight size={16} />
          </Link>
        </div>
        <ul className="-mx-2 divide-y divide-border/70">
          {recent.slice(0, 4).map((tx) => (
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

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <h3 className="mb-4 font-medium">Spending by category</h3>
          <CategoryDonut slices={slices} compactCount={4} month={month} />
        </div>
        <div className="hidden rounded-2xl border border-border bg-surface p-5 lg:block">
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

      <section className="hidden gap-4 lg:grid lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">Accounts</h3>
            <Link href="/accounts" className="text-sm text-accent">
              Manage
            </Link>
          </div>
          <ul className="space-y-3">
            {accounts.map(({ account, balance }) => {
              const relative = formatRelativeTimestamp(account.lastSyncedAt);
              return (
                <li key={account.id}>
                  <Link
                    href={transactionsHref({ account: account.id })}
                    className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 hover:bg-surface-2/80"
                  >
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted capitalize">
                        {account.type}
                        {account.source === "plaid"
                          ? relative
                            ? ` · synced ${relative}`
                            : " · not synced yet"
                          : ""}
                      </p>
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
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">Recent activity</h3>
            <Link href="/transactions" className="text-sm text-accent">
              View all
            </Link>
          </div>
          <ul className="-mx-2 divide-y divide-border/70">
            {recent.map((tx) => (
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
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 lg:hidden">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium">Cash flow</h3>
          <p className="text-xs text-muted">
            <span className="mr-2 text-income">● In</span>
            <span className="text-expense">● Out</span>
          </p>
        </div>
        <CashFlowChart series={cashflow} />
      </section>

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
