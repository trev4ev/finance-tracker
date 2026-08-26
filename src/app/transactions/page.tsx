"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { NativeDateInput, NativeSelect } from "@/components/form-controls";
import { Modal } from "@/components/Modal";
import { TransactionForm } from "@/components/TransactionForm";
import { formatDisplayDate } from "@/lib/dates";
import { lookup, transactionDetailLabel, hasAdjustedAmount } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { useFinance } from "@/lib/store";
import { transactionsHref } from "@/lib/transactions-href";
import type { Transaction, TransactionType } from "@/lib/types";

const PAGE_SIZE = 100;

type SortKey = "date" | "amount";
type SortDir = "asc" | "desc";

function parseType(value: string | null): "all" | TransactionType {
  if (value === "income" || value === "expense" || value === "transfer") {
    return value;
  }
  return "all";
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface" />}>
      <TransactionsList />
    </Suspense>
  );
}

function TransactionsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, hydrated, addTransaction, updateTransaction, deleteTransaction } =
    useFinance();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>(() =>
    parseType(searchParams.get("type")),
  );
  const [accountFilter, setAccountFilter] = useState(
    () => searchParams.get("account") ?? "all",
  );
  const [categoryFilter, setCategoryFilter] = useState(
    () => searchParams.get("category") ?? "all",
  );
  const [fromDate, setFromDate] = useState(() => searchParams.get("from") ?? "");
  const [toDate, setToDate] = useState(() => searchParams.get("to") ?? "");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);

  useEffect(() => {
    setTypeFilter(parseType(searchParams.get("type")));
    setAccountFilter(searchParams.get("account") ?? "all");
    setCategoryFilter(searchParams.get("category") ?? "all");
    setFromDate(searchParams.get("from") ?? "");
    setToDate(searchParams.get("to") ?? "");
  }, [searchParams]);

  const categories = useMemo(
    () =>
      [...state.categories].sort((a, b) => a.name.localeCompare(b.name)),
    [state.categories],
  );
  const accounts = useMemo(
    () => [...state.accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [state.accounts],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = state.transactions.filter((tx) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (accountFilter !== "all" && tx.accountId !== accountFilter) return false;
      if (categoryFilter === "uncategorized") {
        if (tx.categoryId) return false;
      } else if (categoryFilter !== "all" && tx.categoryId !== categoryFilter) {
        return false;
      }
      if (fromDate && tx.date < fromDate) return false;
      if (toDate && tx.date > toDate) return false;
      if (!q) return true;
      const account = lookup(state.accounts, tx.accountId)?.name ?? "";
      const category = lookup(state.categories, tx.categoryId)?.name ?? "";
      const plaid = tx.plaidCategory ?? "";
      return [tx.description, tx.notes, account, category, plaid].some((value) =>
        value.toLowerCase().includes(q),
      );
    });
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "amount" && a.amount !== b.amount) {
        return (a.amount - b.amount) * direction;
      }
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date) * direction;
      }
      return b.id.localeCompare(a.id);
    });
  }, [
    accountFilter,
    categoryFilter,
    fromDate,
    query,
    sortDir,
    sortKey,
    state,
    toDate,
    typeFilter,
  ]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const rangeStart = rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, rows.length);
  const filtersActive =
    query.trim() !== "" ||
    typeFilter !== "all" ||
    accountFilter !== "all" ||
    categoryFilter !== "all" ||
    fromDate !== "" ||
    toDate !== "";

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, accountFilter, categoryFilter, fromDate, toDate, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((value) => (value === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  }

  function updateFilters(patch: {
    type?: "all" | TransactionType;
    account?: string;
    category?: string;
    from?: string;
    to?: string;
  }) {
    const next = {
      type: patch.type ?? typeFilter,
      account: patch.account ?? accountFilter,
      category: patch.category ?? categoryFilter,
      from: patch.from ?? fromDate,
      to: patch.to ?? toDate,
    };
    if (patch.type !== undefined) setTypeFilter(patch.type);
    if (patch.account !== undefined) setAccountFilter(patch.account);
    if (patch.category !== undefined) setCategoryFilter(patch.category);
    if (patch.from !== undefined) setFromDate(patch.from);
    if (patch.to !== undefined) setToDate(patch.to);
    router.replace(transactionsHref(next));
  }

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Transactions</h2>
          <p className="text-sm text-muted">
            {rows.length === 0
              ? "0 shown"
              : `${rangeStart}–${rangeEnd} of ${rows.length}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-background"
        >
          <Plus size={16} />
          Add transaction
        </button>
      </header>

      <div className="space-y-3">
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search payees, notes, accounts…"
            className="w-full rounded-xl border border-border bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-accent"
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="block text-sm">
            <span className="mb-1 block text-muted">From</span>
            <NativeDateInput
              tone="surface"
              allowEmpty
              value={fromDate}
              onChange={(event) => updateFilters({ from: event.target.value })}
            />
          </div>
          <div className="block text-sm">
            <span className="mb-1 block text-muted">To</span>
            <NativeDateInput
              tone="surface"
              allowEmpty
              value={toDate}
              onChange={(event) => updateFilters({ to: event.target.value })}
            />
          </div>
          <div className="block text-sm">
            <span className="mb-1 block text-muted">Account</span>
            <NativeSelect
              tone="surface"
              value={accountFilter}
              onChange={(event) => updateFilters({ account: event.target.value })}
            >
              <option value="all">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="block text-sm">
            <span className="mb-1 block text-muted">Category</span>
            <NativeSelect
              tone="surface"
              value={categoryFilter}
              onChange={(event) => updateFilters({ category: event.target.value })}
            >
              <option value="all">All categories</option>
              <option value="uncategorized">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="block text-sm">
            <span className="mb-1 block text-muted">Type</span>
            <NativeSelect
              tone="surface"
              value={typeFilter}
              onChange={(event) =>
                updateFilters({
                  type: event.target.value as "all" | TransactionType,
                })
              }
            >
              <option value="all">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="transfer">Transfers</option>
            </NativeSelect>
          </div>
          {filtersActive ? (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  router.replace("/transactions");
                }}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm text-muted hover:bg-surface-2"
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">
                <SortButton
                  label="Date"
                  active={sortKey === "date"}
                  direction={sortDir}
                  onClick={() => toggleSort("date")}
                />
              </th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Account</th>
              <th className="px-4 py-3 text-right font-medium">
                <SortButton
                  label="Amount"
                  align="right"
                  active={sortKey === "amount"}
                  direction={sortDir}
                  onClick={() => toggleSort("amount")}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((tx) => {
              const account = lookup(state.accounts, tx.accountId);
              return (
                <tr
                  key={tx.id}
                  className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-surface-2/50"
                  onClick={() => setEditing(tx)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {formatDisplayDate(tx.date)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {tx.description}
                      {tx.pending ? (
                        <span className="ml-2 text-[10px] font-normal tracking-wide text-muted uppercase">
                          pending
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      {transactionDetailLabel(tx, state)}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {account?.name}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      tx.type === "income"
                        ? "text-income"
                        : tx.type === "expense"
                          ? "text-expense"
                          : "text-muted"
                    }`}
                  >
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                    {formatMoney(tx.amount)}
                    {hasAdjustedAmount(tx) ? (
                      <p className="text-[11px] font-normal text-muted">
                        of {formatMoney(tx.originalAmount)}
                      </p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted">
                  No transactions match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {rows.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Page {currentPage} of {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 hover:bg-surface-2"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 hover:bg-surface-2"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <Modal
          title={editing === "new" ? "Add transaction" : "Edit transaction"}
          onClose={() => setEditing(null)}
        >
          <TransactionForm
            state={state}
            initial={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSubmit={(tx) => {
              if (editing === "new") addTransaction(tx);
              else updateTransaction({ ...editing, ...tx, id: editing.id });
              setEditing(null);
            }}
          />
          {editing !== "new" ? (
            <button
              type="button"
              className="mt-3 w-full rounded-xl border border-expense/30 px-4 py-2 text-sm text-expense hover:bg-expense/10"
              onClick={() => {
                deleteTransaction(editing.id);
                setEditing(null);
              }}
            >
              Delete transaction
            </button>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function SortButton({
  label,
  active,
  direction,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDir;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${active ? `, ${direction}ending` : ""}`}
      className={`inline-flex items-center gap-1 font-medium tracking-wide uppercase hover:text-foreground ${
        align === "right" ? "w-full justify-end" : ""
      } ${active ? "text-foreground" : "text-muted"}`}
    >
      {label}
      <ChevronDown
        size={14}
        className={`shrink-0 ${active && direction === "asc" ? "rotate-180" : ""} ${
          active ? "opacity-100" : "opacity-40"
        }`}
      />
    </button>
  );
}
