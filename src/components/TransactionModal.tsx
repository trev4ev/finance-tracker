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
}: {
  editing: Transaction | "new";
  state: FinanceState;
  onClose: () => void;
  onAdd: (tx: TransactionInput, benefitId?: string | null) => string;
  onUpdate: (
    tx: TransactionInput & { id: string },
    benefitId?: string | null,
  ) => void;
  onDelete: (id: string) => void;
}) {
  const pending = editing !== "new" && editing.pending;

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
        onSubmit={(tx, benefitId) => {
          if (pending) return;
          if (editing === "new") onAdd(tx, benefitId);
          else onUpdate({ ...editing, ...tx, id: editing.id }, benefitId);
          onClose();
        }}
      />
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
