"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { currentMonth, monthLabel } from "@/lib/dates";
import { lookup, spentForBudget } from "@/lib/finance";
import { formatMoney, parseAmount } from "@/lib/money";
import { useFinance } from "@/lib/store";
import type { Budget } from "@/lib/types";

export default function BudgetsPage() {
  const { state, hydrated, upsertBudget, deleteBudget } = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const [editing, setEditing] = useState<Budget | "new" | null>(null);

  const rows = useMemo(() => {
    return state.budgets
      .filter((budget) => budget.month === month)
      .map((budget) => {
        const spent = spentForBudget(state.transactions, budget);
        return {
          budget,
          category: lookup(state.categories, budget.categoryId),
          spent,
          remaining: budget.amount - spent,
          pct: budget.amount === 0 ? 0 : Math.min(100, (spent / budget.amount) * 100),
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [month, state]);

  const summary = useMemo(() => {
    const cap = rows.reduce((sum, row) => sum + row.budget.amount, 0);
    const spent = rows.reduce((sum, row) => sum + row.spent, 0);
    return {
      cap,
      spent,
      remaining: cap - spent,
      pct: cap === 0 ? 0 : Math.min(100, (spent / cap) * 100),
    };
  }, [rows]);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="hidden lg:block">
          <h2 className="text-2xl font-semibold tracking-tight">Budgets</h2>
          <p className="text-sm text-muted">Caps for each spending category.</p>
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
            Add budget
          </button>
        </div>
      </header>

      {rows.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Spent this month
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold">
            {formatMoney(summary.spent)}
          </p>
          <p className="mt-1 text-sm text-muted">
            of {formatMoney(summary.cap)} budgeted
            {summary.remaining < 0
              ? ` · ${formatMoney(Math.abs(summary.remaining))} over`
              : ` · ${formatMoney(summary.remaining)} left`}
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${
                summary.remaining < 0 ? "bg-expense" : "bg-accent"
              }`}
              style={{ width: `${summary.pct}%` }}
            />
          </div>
        </section>
      ) : null}

      <div className="space-y-3">
        {rows.map(({ budget, category, spent, remaining, pct }) => (
          <button
            key={budget.id}
            type="button"
            onClick={() => setEditing(budget)}
            className="w-full rounded-2xl border border-border bg-surface p-4 text-left active:scale-[0.99]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{category?.name ?? "Category"}</p>
                <p className="text-xs text-muted">
                  {formatMoney(spent)} of {formatMoney(budget.amount)}
                </p>
              </div>
              <p
                className={`shrink-0 font-mono text-sm ${
                  remaining < 0 ? "text-expense" : "text-income"
                }`}
              >
                {remaining < 0
                  ? `${formatMoney(Math.abs(remaining))} over`
                  : `${formatMoney(remaining)} left`}
              </p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full ${
                  remaining < 0 ? "bg-expense" : "bg-accent"
                }`}
                style={{
                  width: `${pct}%`,
                  background: remaining < 0 ? undefined : category?.color,
                }}
              />
            </div>
          </button>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            No budgets for {monthLabel(month)} yet.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted active:bg-surface lg:hidden"
        >
          <Plus size={16} />
          Add budget
        </button>
      </div>

      {editing ? (
        <BudgetModal
          month={month}
          initial={editing === "new" ? undefined : editing}
          categoryOptions={state.categories.filter((c) => c.kind === "expense")}
          onClose={() => setEditing(null)}
          onSave={(budget) => {
            upsertBudget(
              editing === "new" ? budget : { ...budget, id: editing.id },
            );
            setEditing(null);
          }}
          onDelete={
            editing === "new"
              ? undefined
              : () => {
                  deleteBudget(editing.id);
                  setEditing(null);
                }
          }
        />
      ) : null}
    </div>
  );
}

function BudgetModal({
  month,
  initial,
  categoryOptions,
  onClose,
  onSave,
  onDelete,
}: {
  month: string;
  initial?: Budget;
  categoryOptions: { id: string; name: string }[];
  onClose: () => void;
  onSave: (budget: { categoryId: string; month: string; amount: number }) => void;
  onDelete?: () => void;
}) {
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categoryOptions[0]?.id ?? "",
  );
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [error, setError] = useState("");

  return (
    <Modal title={initial ? "Edit budget" : "Add budget"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = parseAmount(amount);
          if (!categoryId) {
            setError("Choose a category.");
            return;
          }
          if (parsed === null || parsed === 0) {
            setError("Enter a budget amount.");
            return;
          }
          onSave({ categoryId, month, amount: parsed });
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Category</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={Boolean(initial)}
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent disabled:opacity-70 sm:h-11 sm:text-sm"
          >
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Monthly cap</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 font-mono text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
            placeholder="400"
          />
        </label>
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl px-4 py-2 text-sm text-muted active:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Save budget
          </button>
        </div>
      </form>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 min-h-11 w-full rounded-xl border border-expense/30 px-4 py-2 text-sm text-expense active:bg-expense/10"
        >
          Remove budget
        </button>
      ) : null}
    </Modal>
  );
}
