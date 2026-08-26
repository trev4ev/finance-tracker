"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { NativeSelect } from "@/components/form-controls";
import { Modal } from "@/components/Modal";
import { PlaidLinkButton } from "@/components/PlaidLinkButton";
import { ACCOUNT_TYPES, type Account } from "@/lib/types";
import { accountBalance } from "@/lib/finance";
import { formatRelativeTimestamp } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { useFinance } from "@/lib/store";

export default function AccountsPage() {
  const {
    state,
    hydrated,
    addAccount,
    updateAccount,
    deleteAccount,
    user,
    cloudEnabled,
    syncing,
    refresh,
    syncPlaid,
  } = useFinance();
  const [editing, setEditing] = useState<Account | "new" | null>(null);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Accounts</h2>
          <p className="text-sm text-muted">
            Starting balances plus every income, expense, and transfer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-background"
        >
          <Plus size={16} />
          Add account
        </button>
        {cloudEnabled && user ? (
          <>
            <PlaidLinkButton onLinked={() => refresh()} />
            {state.plaidItems.length > 0 ? (
              <button
                type="button"
                disabled={syncing}
                onClick={() => void syncPlaid()}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
              >
                <RefreshCw size={16} />
                {syncing ? "Syncing…" : "Sync banks"}
              </button>
            ) : null}
          </>
        ) : cloudEnabled ? (
          <Link
            href="/login"
            className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2"
          >
            Sign in to link a bank
          </Link>
        ) : null}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {state.accounts.map((account) => {
          const balance = accountBalance(account, state.transactions);
          const relative = formatRelativeTimestamp(account.lastSyncedAt);
          const syncedLabel =
            account.source === "plaid"
              ? syncing
                ? "Syncing…"
                : relative
                  ? `Synced ${relative}`
                  : "Not synced yet"
              : null;
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => setEditing(account)}
              className="rounded-2xl border border-border bg-surface p-5 text-left hover:border-accent/40"
            >
              <p className="text-xs tracking-wide text-muted uppercase">
                {account.type}
                {account.source === "plaid" ? " · linked" : ""}
              </p>
              <h3 className="mt-1 text-lg font-medium">{account.name}</h3>
              {account.institutionName || account.mask ? (
                <p className="text-xs text-muted">
                  {[account.institutionName, account.mask ? `•••• ${account.mask}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              <p
                className={`mt-4 font-mono text-2xl ${
                  balance < 0 ? "text-expense" : "text-foreground"
                }`}
              >
                {account.type === "credit" && balance < 0
                  ? `${formatMoney(Math.abs(balance))} owed`
                  : formatMoney(balance)}
              </p>
              {syncedLabel ? (
                <p className="mt-2 text-xs text-muted">{syncedLabel}</p>
              ) : null}
            </button>
          );
        })}
        {state.accounts.length === 0 ? (
          <p className="text-sm text-muted">Add a checking or savings account to start.</p>
        ) : null}
      </div>

      {editing ? (
        <AccountModal
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(account) => {
            if (editing === "new") addAccount(account);
            else updateAccount({ ...editing, ...account });
            setEditing(null);
          }}
          onDelete={
            editing === "new"
              ? undefined
              : () => {
                  deleteAccount(editing.id);
                  setEditing(null);
                }
          }
        />
      ) : null}
    </div>
  );
}

function AccountModal({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial?: Account;
  onClose: () => void;
  onSave: (account: Pick<Account, "name" | "type" | "startingBalance">) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "checking");
  const [starting, setStarting] = useState(
    initial ? String(initial.startingBalance) : "0",
  );
  const [error, setError] = useState("");

  return (
    <Modal title={initial ? "Edit account" : "Add account"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const amount = Number(starting.replace(/[$,\s]/g, ""));
          if (!name.trim()) {
            setError("Name is required.");
            return;
          }
          if (!Number.isFinite(amount)) {
            setError("Enter a valid starting balance.");
            return;
          }
          onSave({
            name: name.trim(),
            type,
            startingBalance: Math.round(amount * 100) / 100,
          });
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        <div className="block text-sm">
          <span className="mb-1 block text-muted">Type</span>
          <NativeSelect
            value={type}
            onChange={(event) =>
              setType(event.target.value as Account["type"])
            }
          >
            {ACCOUNT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        {initial?.source === "plaid" ? (
          <p className="text-sm text-muted">
            This account is linked through Plaid. Balance comes from the bank.
            Your name here is kept across syncs; it does not change the institution.
            {initial.lastSyncedAt
              ? ` Last synced ${formatRelativeTimestamp(initial.lastSyncedAt)}.`
              : " Not synced yet."}
          </p>
        ) : (
        <label className="block text-sm">
          <span className="mb-1 block text-muted">
            Starting balance {type === "credit" ? "(negative if you owe)" : ""}
          </span>
          <input
            value={starting}
            onChange={(event) => setStarting(event.target.value)}
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono outline-none focus:border-accent"
          />
        </label>
        )}
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
            Save
          </button>
        </div>
      </form>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 w-full rounded-xl border border-expense/30 px-4 py-2 text-sm text-expense hover:bg-expense/10"
        >
          Delete account
        </button>
      ) : null}
    </Modal>
  );
}
