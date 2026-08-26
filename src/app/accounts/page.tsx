"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { NativeSelect } from "@/components/form-controls";
import { Modal } from "@/components/Modal";
import { PlaidLinkButton } from "@/components/PlaidLinkButton";
import { ACCOUNT_TYPES, type Account } from "@/lib/types";
import { accountBalance } from "@/lib/finance";
import { formatRelativeTimestamp } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { useFinance } from "@/lib/store";
import { transactionsHref } from "@/lib/transactions-href";

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
    <div className="space-y-4">
      <header className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Accounts
          </h2>
          <p className="hidden text-sm text-muted sm:block">
            Starting balances plus every income, expense, and transfer.
          </p>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-accent px-4 text-sm font-medium text-background"
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
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-border px-4 text-sm active:bg-surface-2 disabled:opacity-50"
                >
                  <RefreshCw size={16} />
                  {syncing ? "Syncing…" : "Sync banks"}
                </button>
              ) : null}
            </>
          ) : cloudEnabled ? (
            <Link
              href="/login"
              className="inline-flex h-11 shrink-0 items-center rounded-2xl border border-border px-4 text-sm active:bg-surface-2"
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
            <div
              key={account.id}
              className="group relative rounded-2xl border border-border bg-surface active:scale-[0.99] hover:border-accent/40"
            >
              <Link
                href={transactionsHref({ account: account.id })}
                className="block p-3.5 pr-14 text-left sm:p-5"
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
              </Link>
              <button
                type="button"
                aria-label={`Edit ${account.name}`}
                onClick={() => setEditing(account)}
                className="absolute top-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-surface-2 hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <Pencil size={16} />
              </button>
            </div>
          );
        })}
        {state.accounts.length === 0 ? (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted"
          >
            Add a checking or savings account to start.
          </button>
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
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
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
            {initial.lastSyncedAt
              ? `Last synced ${formatRelativeTimestamp(initial.lastSyncedAt)}.`
              : "Not synced yet."}
          </p>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block text-muted">
              Starting balance {type === "credit" ? "(negative if you owe)" : ""}
            </span>
            <input
              value={starting}
              onChange={(event) => setStarting(event.target.value)}
              inputMode="decimal"
              className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 font-mono text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
            />
          </label>
        )}
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
            Save
          </button>
        </div>
      </form>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 min-h-11 w-full rounded-xl border border-expense/30 px-4 py-2 text-sm text-expense active:bg-expense/10"
        >
          Delete account
        </button>
      ) : null}
    </Modal>
  );
}
