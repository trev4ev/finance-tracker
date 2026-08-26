"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { NativeSelect } from "@/components/form-controls";
import { parseTransactionsCsv, transactionsToCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/client";
import { useFinance } from "@/lib/store";

export default function SettingsPage() {
  const {
    state,
    hydrated,
    addCategory,
    deleteCategory,
    importTransactions,
    loadDemo,
    resetAll,
    user,
    cloudEnabled,
  } = useFinance();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [notice, setNotice] = useState("");

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  function downloadCsv() {
    const blob = new Blob([transactionsToCsv(state)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ledger-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted">
          {cloudEnabled
            ? user
              ? "Signed in. Transactions and balances sync to Supabase."
              : "Sign in to store data in Supabase and link banks with Plaid."
            : "Without Supabase keys, data stays in this browser."}
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="mb-2 font-medium">Cloud account</h3>
        {cloudEnabled ? (
          user ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">{user.email}</p>
              <button
                type="button"
                className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2"
                onClick={async () => {
                  await createClient().auth.signOut();
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-medium text-background"
            >
              Sign in
            </Link>
          )
        ) : (
          <p className="text-sm text-muted">
            Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            to enable cloud sync.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="mb-4 font-medium">Categories</h3>
        <form
          className="mb-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            addCategory({
              name: name.trim(),
              kind,
              color: kind === "income" ? "#34d399" : "#94a3b8",
            });
            setName("");
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New category"
            className="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <NativeSelect
            className="w-36 shrink-0"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as "income" | "expense")
            }
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </NativeSelect>
          <button
            type="submit"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Add
          </button>
        </form>
        <ul className="divide-y divide-border">
          {state.categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: category.color }}
                />
                {category.name}
                <span className="text-xs text-muted capitalize">{category.kind}</span>
              </span>
              <button
                type="button"
                className="text-xs text-muted hover:text-expense"
                onClick={() => deleteCategory(category.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="mb-2 font-medium">Import & export</h3>
        <p className="mb-4 text-sm text-muted">
          CSV columns: date, description, amount, original_amount, type, account, category,
          to_account, notes.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Import CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const text = await file.text();
              const imported = parseTransactionsCsv(text, state);
              importTransactions(imported);
              setNotice(`Imported ${imported.length} transactions.`);
            }}
          />
        </div>
        {notice ? <p className="mt-3 text-sm text-accent">{notice}</p> : null}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="mb-2 font-medium">Data</h3>
        <p className="mb-4 text-sm text-muted">
          Sample data is generated locally so you can explore the app. Resetting
          cannot be undone.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadDemo}
            className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Reload sample data
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear all accounts, transactions, and budgets?")) {
                resetAll();
              }
            }}
            className="rounded-xl border border-expense/30 px-4 py-2 text-sm text-expense hover:bg-expense/10"
          >
            Clear everything
          </button>
        </div>
      </section>
    </div>
  );
}
