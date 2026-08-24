"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { addMonths, currentMonth, monthLabel } from "@/lib/dates";
import { lookup, spentForBudget } from "@/lib/finance";
import { formatMoney, parseAmount } from "@/lib/money";
import { useFinance } from "@/lib/store";

export default function BudgetsPage() {
  const { state, hydrated, upsertBudget, deleteBudget } = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);

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
      });
  }, [month, state]);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Budgets</h2>
          <p className="text-sm text-muted">Caps for each spending category.</p>
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
            Add budget
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {rows.map(({ budget, category, spent, remaining, pct }) => (
          <div
            key={budget.id}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{category?.name ?? "Category"}</p>
                <p className="text-xs text-muted">
                  {formatMoney(spent)} of {formatMoney(budget.amount)}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`font-mono text-sm ${
                    remaining < 0 ? "text-expense" : "text-income"
                  }`}
                >
                  {remaining < 0
                    ? `${formatMoney(Math.abs(remaining))} over`
                    : `${formatMoney(remaining)} left`}
                </p>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-expense"
                  onClick={() => deleteBudget(budget.id)}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full ${
                  remaining < 0 ? "bg-expense" : "bg-accent"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            No budgets for {monthLabel(month)} yet.
          </p>
        ) : null}
      </div>

      {open ? (
        <BudgetModal
          month={month}
          categoryOptions={state.categories.filter((c) => c.kind === "expense")}
          onClose={() => setOpen(false)}
          onSave={(budget) => {
            upsertBudget(budget);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function BudgetModal({
  month,
  categoryOptions,
  onClose,
  onSave,
}: {
  month: string;
  categoryOptions: { id: string; name: string }[];
  onClose: () => void;
  onSave: (budget: { categoryId: string; month: string; amount: number }) => void;
}) {
  const [categoryId, setCategoryId] = useState(categoryOptions[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  return (
    <Modal title="Add budget" onClose={onClose}>
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
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
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
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono outline-none focus:border-accent"
            placeholder="400"
          />
        </label>
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-muted hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Save budget
          </button>
        </div>
      </form>
    </Modal>
  );
}
