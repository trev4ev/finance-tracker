"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createDemoState, emptyState } from "./seed";
import type {
  Account,
  Budget,
  Category,
  FinanceState,
  Transaction,
} from "./types";

const STORAGE_KEY = "ledger-finance-v1";

type FinanceContextValue = {
  state: FinanceState;
  hydrated: boolean;
  addAccount: (account: Omit<Account, "id">) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  addCategory: (category: Omit<Category, "id">) => void;
  updateCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  addTransaction: (tx: Omit<Transaction, "id">) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  upsertBudget: (budget: Omit<Budget, "id"> & { id?: string }) => void;
  deleteBudget: (id: string) => void;
  importTransactions: (txs: Transaction[]) => void;
  loadDemo: () => void;
  resetAll: () => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

function persist(state: FinanceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount to avoid a server/client mismatch.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- persist store hydration
        setState(JSON.parse(raw) as FinanceState);
      } else {
        const demo = createDemoState();
        persist(demo);
        setState(demo);
      }
    } catch {
      setState(createDemoState());
    }
    setHydrated(true);
  }, []);

  const commit = useCallback((updater: (prev: FinanceState) => FinanceState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      hydrated,
      addAccount: (account) =>
        commit((prev) => ({
          ...prev,
          accounts: [...prev.accounts, { ...account, id: crypto.randomUUID() }],
        })),
      updateAccount: (account) =>
        commit((prev) => ({
          ...prev,
          accounts: prev.accounts.map((item) =>
            item.id === account.id ? account : item,
          ),
        })),
      deleteAccount: (id) =>
        commit((prev) => ({
          ...prev,
          accounts: prev.accounts.filter((item) => item.id !== id),
          transactions: prev.transactions.filter(
            (tx) => tx.accountId !== id && tx.toAccountId !== id,
          ),
        })),
      addCategory: (category) =>
        commit((prev) => ({
          ...prev,
          categories: [
            ...prev.categories,
            { ...category, id: crypto.randomUUID() },
          ],
        })),
      updateCategory: (category) =>
        commit((prev) => ({
          ...prev,
          categories: prev.categories.map((item) =>
            item.id === category.id ? category : item,
          ),
        })),
      deleteCategory: (id) =>
        commit((prev) => ({
          ...prev,
          categories: prev.categories.filter((item) => item.id !== id),
          transactions: prev.transactions.map((tx) =>
            tx.categoryId === id ? { ...tx, categoryId: null } : tx,
          ),
          budgets: prev.budgets.filter((budget) => budget.categoryId !== id),
        })),
      addTransaction: (tx) =>
        commit((prev) => ({
          ...prev,
          transactions: [
            ...prev.transactions,
            { ...tx, id: crypto.randomUUID() },
          ],
        })),
      updateTransaction: (tx) =>
        commit((prev) => ({
          ...prev,
          transactions: prev.transactions.map((item) =>
            item.id === tx.id ? tx : item,
          ),
        })),
      deleteTransaction: (id) =>
        commit((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((tx) => tx.id !== id),
        })),
      upsertBudget: (budget) =>
        commit((prev) => {
          const existing = prev.budgets.find(
            (item) =>
              item.id === budget.id ||
              (item.categoryId === budget.categoryId &&
                item.month === budget.month),
          );
          if (existing) {
            return {
              ...prev,
              budgets: prev.budgets.map((item) =>
                item.id === existing.id
                  ? { ...existing, amount: budget.amount }
                  : item,
              ),
            };
          }
          return {
            ...prev,
            budgets: [
              ...prev.budgets,
              { ...budget, id: crypto.randomUUID() },
            ],
          };
        }),
      deleteBudget: (id) =>
        commit((prev) => ({
          ...prev,
          budgets: prev.budgets.filter((item) => item.id !== id),
        })),
      importTransactions: (txs) =>
        commit((prev) => ({
          ...prev,
          transactions: [...prev.transactions, ...txs],
        })),
      loadDemo: () => {
        const demo = createDemoState();
        persist(demo);
        setState(demo);
      },
      resetAll: () => {
        const next = emptyState();
        persist(next);
        setState(next);
      },
    }),
    [commit, hydrated, state],
  );

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
