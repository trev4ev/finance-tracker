"use client";

import { Modal } from "@/components/Modal";
import { TransactionForm } from "@/components/TransactionForm";
import type { FinanceState, Transaction, TransactionInput } from "@/lib/types";

export function TransactionModal({
  editing,
  state,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  onLooksGood,
}: {
  editing: Transaction | "new";
  state: FinanceState;
  onClose: () => void;
  onAdd: (
    tx: TransactionInput,
    benefitId?: string | null,
    options?: { applyRule?: boolean },
  ) => string;
  onUpdate: (
    tx: TransactionInput & { id: string },
    benefitId?: string | null,
    options?: { applyRule?: boolean },
  ) => void;
  onDelete: (id: string) => void;
  onLooksGood?: (id: string) => void;
}) {
  const pending = editing !== "new" && editing.pending;
  const unreviewed = editing !== "new" && !editing.pending && !editing.reviewed;

  return (
    <Modal
      title={
        editing === "new"
          ? "Add transaction"
          : pending
            ? "Pending transaction"
            : "Edit transaction"
      }
      onClose={onClose}
    >
      <TransactionForm
        state={state}
        initial={editing === "new" ? undefined : editing}
        onCancel={onClose}
        onSubmit={(tx, benefitId, applyRule) => {
          if (pending) return;
          const options = applyRule ? { applyRule: true } : undefined;
          if (editing === "new") onAdd(tx, benefitId, options);
          else onUpdate({ ...editing, ...tx, id: editing.id }, benefitId, options);
          onClose();
        }}
      />
      {unreviewed && onLooksGood ? (
        <button
          type="button"
          className="mt-3 min-h-11 w-full rounded-xl bg-accent/15 px-4 py-2 text-sm font-medium text-accent active:bg-accent/25"
          onClick={() => {
            onLooksGood(editing.id);
            onClose();
          }}
        >
          Looks good
        </button>
      ) : null}
      {editing !== "new" && !pending ? (
        <button
          type="button"
          className="mt-3 min-h-11 w-full rounded-xl border border-expense/30 px-4 py-2 text-sm text-expense active:bg-expense/10"
          onClick={() => {
            onDelete(editing.id);
            onClose();
          }}
        >
          Delete transaction
        </button>
      ) : null}
    </Modal>
  );
}
