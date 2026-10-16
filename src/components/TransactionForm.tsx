"use client";

import { useState } from "react";
import { NativeDateInput, NativeSelect } from "@/components/form-controls";
import { benefitsForAccount, redemptionForTransaction } from "@/lib/benefits";
import { formatMoney, parseAmount, sameMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import {
  shouldPromptCategoryRule,
  similarTransactions,
  transactionMerchantKey,
} from "@/lib/rules";
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
  onSubmit: (
    tx: TransactionInput,
    benefitId: string | null,
    applyRule?: boolean,
  ) => void;
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
          benefitId:
            redemptionForTransaction(state.benefitRedemptions, initial.id)
              ?.benefitId ?? "",
        }
      : {
          ...emptyForm,
          accountId: state.accounts[0]?.id ?? "",
          benefitId: "",
        },
  );
  const [error, setError] = useState("");
  const [showNotes, setShowNotes] = useState(() => Boolean(initial?.notes));
  const [pendingSave, setPendingSave] = useState<{
    tx: TransactionInput;
    benefitId: string | null;
    similar: number;
    merchant: string;
  } | null>(null);
  const readOnly = Boolean(initial?.pending);

  const categories = state.categories.filter((category) =>
    form.type === "income" ? category.kind === "income" : category.kind === "expense",
  );
  const accountBenefits = benefitsForAccount(
    state.cardBenefits,
    form.accountId,
    form.benefitId,
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) {
      onCancel();
      return;
    }
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
    const payload: TransactionInput = {
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
      merchantName: initial?.merchantName ?? null,
    };
    const benefitId = form.type === "income" ? form.benefitId || null : null;
    if (shouldPromptCategoryRule(state.categoryRules, payload)) {
      const similar = similarTransactions(state.transactions, {
        id: initial?.id ?? "",
        type: payload.type,
          merchantName: payload.merchantName ?? null,
        description: payload.description,
      }).length;
      setPendingSave({
        tx: payload,
        benefitId,
        similar,
        merchant: transactionMerchantKey(payload),
      });
      return;
    }
    onSubmit(payload, benefitId);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {readOnly ? (
        <p className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
          Pending bank charges can&apos;t be edited. Amount and category are replaced when
          the transaction posts.
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {(["expense", "income", "transfer"] as TransactionType[]).map((type) => (
          <button
            key={type}
            type="button"
            disabled={readOnly}
            onClick={() =>
              setForm((prev) => ({ ...prev, type, categoryId: "", benefitId: "" }))
            }
            className={`min-h-12 rounded-xl border px-2 text-sm capitalize disabled:cursor-not-allowed ${
              form.type === type
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted active:bg-surface-2 disabled:active:bg-transparent"
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
          disabled={readOnly}
          className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:text-sm"
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
            disabled={readOnly}
            inputMode="decimal"
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 font-mono text-base outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:text-sm"
            placeholder="0.00"
          />
          {initial && !readOnly ? (
            <p className="mt-1 text-xs text-muted">
              {sameMoney(
                parseAmount(form.amount) ?? initial.amount,
                initial.originalAmount,
              )
                ? "If you covered others, lower this to your share. The original charge is kept."
                : `Your share. Original charge ${formatMoney(initial.originalAmount)}.`}
            </p>
          ) : null}
        </label>
        <div className="block text-sm">
          <span className="mb-1 block text-muted">Date</span>
          <NativeDateInput
            value={form.date}
            disabled={readOnly}
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
          disabled={readOnly}
          onChange={(event) =>
            setForm((prev) => {
              const accountId = event.target.value;
              const stillValid = benefitsForAccount(
                state.cardBenefits,
                accountId,
              ).some((benefit) => benefit.id === prev.benefitId);
              return {
                ...prev,
                accountId,
                benefitId: stillValid ? prev.benefitId : "",
              };
            })
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
            disabled={readOnly}
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
          disabled={readOnly}
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

      {form.type === "income" && accountBenefits.length > 0 ? (
        <div className="block text-sm">
          <span className="mb-1 block text-muted">Card benefit</span>
          <NativeSelect
            value={form.benefitId}
            disabled={readOnly}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, benefitId: event.target.value }))
            }
          >
            <option value="">Not a card benefit</option>
            {accountBenefits.map((benefit) => (
              <option key={benefit.id} value={benefit.id}>
                {benefit.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {showNotes ? (
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, notes: event.target.value }))
            }
            disabled={readOnly}
            rows={2}
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          />
        </label>
      ) : readOnly ? null : (
        <button
          type="button"
          onClick={() => setShowNotes(true)}
          className="text-sm text-accent"
        >
          Add note
        </button>
      )}

      {error ? <p className="text-sm text-expense">{error}</p> : null}

      {pendingSave ? (
        <div className="space-y-3 rounded-xl border border-border bg-surface-2 px-3 py-3">
          <p className="text-sm">
            {pendingSave.similar > 0
              ? `Apply this category to ${pendingSave.similar} other ${pendingSave.merchant} transaction${pendingSave.similar === 1 ? "" : "s"} and future matches?`
              : `Remember this category for future ${pendingSave.merchant} charges?`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                onSubmit(pendingSave.tx, pendingSave.benefitId, false);
              }}
              className="min-h-11 rounded-xl border border-border px-4 text-sm active:bg-surface"
            >
              Just this one
            </button>
            <button
              type="button"
              onClick={() => {
                onSubmit(pendingSave.tx, pendingSave.benefitId, true);
              }}
              className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-background"
            >
              {pendingSave.similar > 0 ? "Apply to all" : "Remember for later"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="hidden min-h-11 rounded-xl px-4 py-2 text-sm text-muted active:bg-surface-2 sm:inline-flex sm:items-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-12 w-full rounded-xl bg-accent px-4 text-sm font-medium text-background sm:min-h-11 sm:w-auto"
          >
            {readOnly ? "Done" : initial ? "Save changes" : "Add transaction"}
          </button>
        </div>
      )}
    </form>
  );
}
