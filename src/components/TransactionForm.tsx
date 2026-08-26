"use client";

import { useState } from "react";
import { NativeDateInput, NativeSelect } from "@/components/form-controls";
import { formatMoney, parseAmount, sameMoney } from "@/lib/money";
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
    form.type === "income" ? category.kind === "income" : category.kind === "expense",
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
    if (form.type === "transfer" && !initial && !form.toAccountId) {
      setError("Choose a destination account.");
      return;
    }
    if (form.type === "transfer" && form.toAccountId && form.toAccountId === form.accountId) {
      setError("Pick two different accounts.");
      return;
    }
    onSubmit({
      id: initial?.id,
      date: form.date,
      description: form.description.trim(),
      amount,
      originalAmount: initial?.originalAmount ?? amount,
      type: form.type,
      accountId: form.accountId,
      categoryId: form.categoryId || null,
      toAccountId: form.type === "transfer" ? form.toAccountId || null : null,
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
            className={`rounded-xl border px-3 py-2 text-sm capitalize ${
              form.type === type
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:bg-surface-2"
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
          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
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
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono outline-none focus:border-accent"
            placeholder="0.00"
          />
          {initial ? (
            <p className="mt-1 text-xs text-muted">
              {sameMoney(
                parseAmount(form.amount) ?? initial.amount,
                initial.originalAmount,
              )
                ? "If you covered others, lower this to your share. The original charge is kept."
                : `Your share for budgets. Original charge ${formatMoney(initial.originalAmount)}.`}
            </p>
          ) : null}
        </label>
        <div className="block text-sm">
          <span className="mb-1 block text-muted">Date</span>
          <NativeDateInput
            value={form.date}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, date: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="block text-sm">
        <span className="mb-1 block text-muted">
          {form.type === "transfer" ? "From account" : "Account"}
        </span>
        <NativeSelect
          value={form.accountId}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, accountId: event.target.value }))
          }
        >
          {state.accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {form.type === "transfer" ? (
        <div className="block text-sm">
          <span className="mb-1 block text-muted">To account</span>
          <NativeSelect
            value={form.toAccountId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, toAccountId: event.target.value }))
            }
          >
            <option value="">Select account</option>
            {state.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      <div className="block text-sm">
        <span className="mb-1 block text-muted">Category</span>
        <NativeSelect
          value={form.categoryId}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, categoryId: event.target.value }))
          }
        >
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Notes</span>
        <textarea
          value={form.notes}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, notes: event.target.value }))
          }
          rows={2}
          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
        />
      </label>

      {error ? <p className="text-sm text-expense">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-4 py-2 text-sm text-muted hover:bg-surface-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          {initial ? "Save changes" : "Add transaction"}
        </button>
      </div>
    </form>
  );
}
