"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TransactionRow } from "@/components/TransactionRow";
import { lookup } from "@/lib/finance";
import { transactionsHref } from "@/lib/transactions-href";
import type { FinanceState, Transaction } from "@/lib/types";

const INITIAL_COUNT = 5;

export function TopTransactions({
  month,
  transactions,
  state,
  onSelect,
}: {
  month: string;
  transactions: Transaction[];
  state: FinanceState;
  onSelect: (tx: Transaction) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  useEffect(() => {
    setVisibleCount(INITIAL_COUNT);
  }, [month]);

  const visible = transactions.slice(0, visibleCount);
  const hiddenCount = Math.max(0, transactions.length - visibleCount);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-medium">Top transactions</h3>
        <Link
          href={transactionsHref({ type: "expense", month })}
          className="inline-flex items-center text-sm text-accent"
        >
          View all
          <ChevronRight size={16} className="lg:hidden" />
        </Link>
      </div>
      {transactions.length === 0 ? (
        <p className="py-6 text-sm text-muted">No expenses this month.</p>
      ) : (
        <>
          <ul className="-mx-2 divide-y divide-border/70">
            {visible.map((tx) => (
              <li key={tx.id}>
                <TransactionRow
                  tx={tx}
                  category={lookup(state.categories, tx.categoryId)}
                  account={lookup(state.accounts, tx.accountId)}
                  toAccount={lookup(state.accounts, tx.toAccountId)}
                  onClick={() => onSelect(tx)}
                />
              </li>
            ))}
          </ul>
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + INITIAL_COUNT)}
              className="mt-2 text-xs text-accent"
            >
              Show more ({hiddenCount})
            </button>
          ) : null}
          {hiddenCount === 0 && transactions.length > INITIAL_COUNT ? (
            <button
              type="button"
              onClick={() => setVisibleCount(INITIAL_COUNT)}
              className="mt-2 text-xs text-muted"
            >
              Show less
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
