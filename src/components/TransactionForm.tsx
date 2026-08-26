"use client";

import { useState } from "react";
import { parseAmount } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import type {
  FinanceState,
  Transaction,
  TransactionInput,
  TransactionType,
} from "@/lib/types";

const emptyForm = {
  date: todayISO(),
  description: "",
  amount: "",
  type: "expense" as TransactionType,
  accountId: "",
  categoryId: "",
  toAccountId: "",
  notes: "",
};

export function TransactionForm({
  state,
  initial,
  onSubmit,
  onCancel,
}: {
  state: FinanceState;
  initial?: Transaction;
  onSubmit: (tx: TransactionInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          date: initial.date,
          description: initial.description,
          amount: String(initial.amount),
          type: initial.type,
          accountId: initial.accountId,
          categoryId: initial.categoryId ?? "",
          toAccountId: initial.toAccountId ?? "",
          notes: initial.notes,
        }
      : {
          ...emptyForm,
          accountId: state.accounts[0]?.id ?? "",
        },
  );
  const [error, setError] = useState("");

  const categories = state.categories.filter((category) =>
    form.type === "income"
      ? category.kind === "income"
      : form.type === "expense"
        ? category.kind === "expense"
        : false,
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseAmount(form.amount);
    if (!form.description.trim()) {
      setError("Add a description.");
      return;
    }
    if (amount === null || amount === 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!form.accountId) {
      setError("Choose an account.");
      return;
    }
    if (form.type === "transfer" && !form.toAccountId) {
      setError("Choose a destination account.");
      return;
    }
    if (form.type === "transfer" && form.toAccountId === form.accountId) {
      setError("Pick two different accounts.");
      return;
    }
    onSubmit({
      id: initial?.id,
      date: form.date,
      description: form.description.trim(),
      amount,
      type: form.type,
      accountId: form.accountId,
      categoryId: form.type === "transfer" ? null : form.categoryId || null,
      toAccountId: form.type === "transfer" ? form.toAccountId : null,
      notes: form.notes.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(["expense", "income", "transfer"] as TransactionType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, type, categoryId: "" }))}
            className={`min-h-12 rounded-xl border px-2 text-sm capitalize ${
              form.type === type
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted active:bg-surface-2"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Description</span>
        <input
          value={form.description}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, description: event.target.value }))
          }
          className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
          placeholder="Coffee, payroll, rent…"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Amount</span>
          <input
            value={form.amount}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, amount: event.target.value }))
            }
            inputMode="decimal"
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 font-mono text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
            placeholder="0.00"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Date</span>
          <input
            type="date"
            value={form.date}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, date: event.target.value }))
            }
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">
          {form.type === "transfer" ? "From account" : "Account"}
        </span>
        <select
          value={form.accountId}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, accountId: event.target.value }))
          }
          className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
        >
          {state.accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      {form.type === "transfer" ? (
        <label className="block text-sm">
          <span className="mb-1 block text-muted">To account</span>
          <select
            value={form.toAccountId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, toAccountId: event.target.value }))
            }
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
          >
            <option value="">Select account</option>
            {state.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Category</span>
          <select
            value={form.categoryId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, categoryId: event.target.value }))
            }
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Notes</span>
        <textarea
          value={form.notes}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, notes: event.target.value }))
          }
          rows={2}
          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base outline-none focus:border-accent sm:text-sm"
        />
      </label>

      {error ? <p className="text-sm text-expense">{error}</p> : null}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl px-4 py-2 text-sm text-muted active:bg-surface-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          {initial ? "Save changes" : "Add transaction"}
        </button>
      </div>
    </form>
  );
}
