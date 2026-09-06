"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  accountToRow,
  benefitRedemptionToRow,
  cardBenefitToRow,
  categoryToRow,
  loadFinanceState,
  replaceFinanceState,
  transactionToRow,
} from "./cloud";
import {
  clearPeriodRedemptions,
  linkTransactionBenefit,
  upsertPeriodRedemption,
  type RedemptionPatch,
} from "./benefits";
import {
  hasUserData,
  normalizeAccount,
  normalizeCardBenefit,
  normalizeState,
  normalizeTransaction,
  remapStateToUuids,
} from "./normalize";
import { createDemoState, emptyState } from "./seed";
import { invokeFunction } from "./functions";
import { createClient } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/env";
import { plaidAccountsNeedSync } from "./plaid/stale";
import type {
  Account,
  CardBenefit,
  Category,
  FinanceState,
  Transaction,
  TransactionInput,
} from "./types";

const STORAGE_KEY = "ledger-finance-v1";
let plaidAutoSyncStarted = false;

type FinanceContextValue = {
  state: FinanceState;
  hydrated: boolean;
  user: User | null;
  cloudEnabled: boolean;
  syncing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  syncPlaid: () => Promise<void>;
  addAccount: (
    account: Pick<Account, "name" | "type" | "startingBalance"> & Partial<Account>,
  ) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  addCategory: (category: Omit<Category, "id">) => void;
  updateCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  addTransaction: (tx: TransactionInput, benefitId?: string | null) => string;
  updateTransaction: (
    tx: TransactionInput & { id: string },
    benefitId?: string | null,
  ) => void;
  deleteTransaction: (id: string) => void;
  addBenefit: (
    benefit: Omit<CardBenefit, "id"> & { id?: string },
  ) => string;
  updateBenefit: (benefit: CardBenefit) => void;
  deleteBenefit: (id: string) => void;
  markBenefitUsed: (input: {
    benefitId: string;
    usedOn: string;
    transactionId: string | null;
    amount: number | null;
    notes: string;
  }) => void;
  unmarkBenefit: (benefitId: string, periodStart: string) => void;
  setTransactionBenefit: (
    transactionId: string,
    benefitId: string | null,
  ) => void;
  importTransactions: (txs: Transaction[]) => void;
  loadDemo: () => void;
  resetAll: () => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

function persistLocal(state: FinanceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function applyRedemptionPatch(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  patch: RedemptionPatch,
) {
  if (patch.removeIds.length > 0) {
    const { error } = await supabase
      .from("benefit_redemptions")
      .delete()
      .in("id", patch.removeIds);
    if (error) return { error };
  }
  if (patch.upsert) {
    return supabase
      .from("benefit_redemptions")
      .upsert(benefitRedemptionToRow(patch.upsert, userId));
  }
  return { error: null };
}

function readLocal(): FinanceState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw) as FinanceState);
  } catch {
    return null;
  }
}

const SEEDED_KEY = "ledger-finance-seeded";

function markSeeded() {
  localStorage.setItem(SEEDED_KEY, "1");
}

function clearSeeded() {
  localStorage.removeItem(SEEDED_KEY);
}

function isSeeded() {
  return localStorage.getItem(SEEDED_KEY) === "1";
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>(() => normalizeState(emptyState()));
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);
  const cloudEnabled = isSupabaseConfigured();

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const loadCloud = useCallback(async (userId: string) => {
    const supabase = createClient();
    const remote = await loadFinanceState(supabase, userId);
    if (!hasUserData(remote)) {
      const local = readLocal();
      if (local && hasUserData(local) && !isSeeded()) {
        const remapped = remapStateToUuids(local);
        await replaceFinanceState(supabase, userId, remapped);
        setState(remapped);
        return;
      }
    }
    setState(remote);
  }, []);

  const refresh = useCallback(async () => {
    const current = userRef.current;
    if (!current || !cloudEnabled) return;
    setSyncing(true);
    setError(null);
    try {
      await loadCloud(current.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load cloud data");
    } finally {
      setSyncing(false);
    }
  }, [cloudEnabled, loadCloud]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!cloudEnabled) {
        const local = readLocal();
        if (local) setState(local);
        else {
          const demo = normalizeState(createDemoState());
          persistLocal(demo);
          markSeeded();
          setState(demo);
        }
        setHydrated(true);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const nextUser = data.user ?? null;
      setUser(nextUser);
      try {
        if (nextUser) await loadCloud(nextUser.id);
        else {
          const local = readLocal();
          if (local) setState(local);
          else {
            const demo = normalizeState(createDemoState());
            persistLocal(demo);
            markSeeded();
            setState(demo);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load cloud data");
          const local = readLocal();
          if (local) setState(local);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void init();

    if (!cloudEnabled) return () => {
      cancelled = true;
    };

    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        void loadCloud(nextUser.id).catch((err) => {
          setError(err instanceof Error ? err.message : "Could not load cloud data");
        });
      } else {
        const local = readLocal();
        setState(local ?? normalizeState(emptyState()));
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [cloudEnabled, loadCloud]);

  const writeCloud = useCallback(
    async (
      run: (
        supabase: ReturnType<typeof createClient>,
        userId: string,
      ) => PromiseLike<{ error: { message: string } | null }>,
    ) => {
      const current = userRef.current;
      if (!current || !cloudEnabled) return;
      const supabase = createClient();
      const { error: writeError } = await run(supabase, current.id);
      if (writeError) {
        setError(writeError.message);
        void refresh();
      }
    },
    [cloudEnabled, refresh],
  );

  const writeRedemptionPatch = useCallback(
    (patch: RedemptionPatch) => {
      void writeCloud((supabase, userId) =>
        applyRedemptionPatch(supabase, userId, patch),
      );
    },
    [writeCloud],
  );

  const commit = useCallback(
    (updater: (prev: FinanceState) => FinanceState) => {
      setState((prev) => {
        const next = normalizeState(updater(prev));
        if (!userRef.current) {
          persistLocal(next);
          clearSeeded();
        }
        return next;
      });
    },
    [],
  );

  const syncPlaid = useCallback(async () => {
    const current = userRef.current;
    if (!current || !cloudEnabled) return;
    setSyncing(true);
    setError(null);
    try {
      await invokeFunction("plaid", { action: "sync" });
      await loadCloud(current.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plaid sync failed");
    } finally {
      setSyncing(false);
    }
  }, [cloudEnabled, loadCloud]);

  useEffect(() => {
    if (!hydrated || !user || !cloudEnabled || plaidAutoSyncStarted) return;
    if (!plaidAccountsNeedSync(state)) return;
    plaidAutoSyncStarted = true;
    void syncPlaid();
  }, [cloudEnabled, hydrated, state, syncPlaid, user]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      hydrated,
      user,
      cloudEnabled,
      syncing,
      error,
      refresh,
      syncPlaid,
      addAccount: (account) => {
        const row = normalizeAccount({ ...account, id: crypto.randomUUID() });
        commit((prev) => ({ ...prev, accounts: [...prev.accounts, row] }));
        void writeCloud((supabase, userId) =>
          supabase.from("accounts").insert(accountToRow(row, userId)),
        );
      },
      updateAccount: (account) => {
        const row = normalizeAccount(account);
        commit((prev) => ({
          ...prev,
          accounts: prev.accounts.map((item) => (item.id === row.id ? row : item)),
        }));
        void writeCloud((supabase) =>
          supabase
            .from("accounts")
            .update({
              name: row.name,
              type: row.type,
              starting_balance: row.startingBalance,
            })
            .eq("id", row.id),
        );
      },
      deleteAccount: (id) => {
        commit((prev) => ({
          ...prev,
          accounts: prev.accounts.filter((item) => item.id !== id),
          transactions: prev.transactions.filter(
            (tx) => tx.accountId !== id && tx.toAccountId !== id,
          ),
          cardBenefits: prev.cardBenefits.filter(
            (benefit) => benefit.accountId !== id,
          ),
          benefitRedemptions: prev.benefitRedemptions.filter((row) => {
            const benefit = prev.cardBenefits.find(
              (item) => item.id === row.benefitId,
            );
            return benefit?.accountId !== id;
          }),
        }));
        void writeCloud((supabase) => supabase.from("accounts").delete().eq("id", id));
      },
      addCategory: (category) => {
        const row = { ...category, id: crypto.randomUUID() };
        commit((prev) => ({ ...prev, categories: [...prev.categories, row] }));
        void writeCloud((supabase, userId) =>
          supabase.from("categories").insert(categoryToRow(row, userId)),
        );
      },
      updateCategory: (category) => {
        commit((prev) => ({
          ...prev,
          categories: prev.categories.map((item) =>
            item.id === category.id ? category : item,
          ),
        }));
        void writeCloud((supabase, userId) =>
          supabase.from("categories").update(categoryToRow(category, userId)).eq("id", category.id),
        );
      },
      deleteCategory: (id) => {
        commit((prev) => ({
          ...prev,
          categories: prev.categories.filter((item) => item.id !== id),
          transactions: prev.transactions.map((tx) =>
            tx.categoryId === id ? { ...tx, categoryId: null } : tx,
          ),
        }));
        void writeCloud((supabase) => supabase.from("categories").delete().eq("id", id));
      },
      addTransaction: (tx, benefitId) => {
        const row = normalizeTransaction({ ...tx, id: crypto.randomUUID() });
        let patch: RedemptionPatch | null = null;
        commit((prev) => {
          const withTx = {
            ...prev,
            transactions: [...prev.transactions, row],
          };
          if (!benefitId) return withTx;
          const next = linkTransactionBenefit(withTx, row.id, benefitId);
          patch = next;
          return { ...withTx, benefitRedemptions: next.redemptions };
        });
        void writeCloud(async (supabase, userId) => {
          const inserted = await supabase
            .from("transactions")
            .insert(transactionToRow(row, userId));
          if (inserted.error) return inserted;
          if (!patch) return { error: null };
          return applyRedemptionPatch(supabase, userId, patch);
        });
        return row.id;
      },
      updateTransaction: (tx, benefitId) => {
        const existing = state.transactions.find((item) => item.id === tx.id);
        if (existing?.pending) return;
        const row = normalizeTransaction(tx);
        let patch: RedemptionPatch | null = null;
        commit((prev) => {
          const withTx = {
            ...prev,
            transactions: prev.transactions.map((item) =>
              item.id === row.id ? row : item,
            ),
          };
          if (benefitId === undefined) return withTx;
          const next = linkTransactionBenefit(withTx, row.id, benefitId);
          patch = next;
          return { ...withTx, benefitRedemptions: next.redemptions };
        });
        void writeCloud(async (supabase, userId) => {
          const updated = await supabase
            .from("transactions")
            .update(transactionToRow(row, userId))
            .eq("id", row.id);
          if (updated.error) return updated;
          if (!patch) return { error: null };
          return applyRedemptionPatch(supabase, userId, patch);
        });
      },
      deleteTransaction: (id) => {
        commit((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((tx) => tx.id !== id),
          benefitRedemptions: prev.benefitRedemptions.map((row) =>
            row.transactionId === id ? { ...row, transactionId: null } : row,
          ),
        }));
        void writeCloud((supabase) => supabase.from("transactions").delete().eq("id", id));
      },
      addBenefit: (benefit) => {
        const row = normalizeCardBenefit({
          ...benefit,
          id: benefit.id ?? crypto.randomUUID(),
        });
        commit((prev) => ({
          ...prev,
          cardBenefits: [...prev.cardBenefits, row],
        }));
        void writeCloud((supabase, userId) =>
          supabase.from("card_benefits").insert(cardBenefitToRow(row, userId)),
        );
        return row.id;
      },
      updateBenefit: (benefit) => {
        const row = normalizeCardBenefit(benefit);
        commit((prev) => ({
          ...prev,
          cardBenefits: prev.cardBenefits.map((item) =>
            item.id === row.id ? row : item,
          ),
        }));
        void writeCloud((supabase, userId) =>
          supabase
            .from("card_benefits")
            .update(cardBenefitToRow(row, userId))
            .eq("id", row.id),
        );
      },
      deleteBenefit: (id) => {
        commit((prev) => ({
          ...prev,
          cardBenefits: prev.cardBenefits.filter((item) => item.id !== id),
          benefitRedemptions: prev.benefitRedemptions.filter(
            (row) => row.benefitId !== id,
          ),
        }));
        void writeCloud((supabase) =>
          supabase.from("card_benefits").delete().eq("id", id),
        );
      },
      markBenefitUsed: (input) => {
        let patch: RedemptionPatch | null = null;
        commit((prev) => {
          const next = upsertPeriodRedemption(prev, input);
          patch = next;
          return { ...prev, benefitRedemptions: next.redemptions };
        });
        if (patch) writeRedemptionPatch(patch);
      },
      unmarkBenefit: (benefitId, periodStart) => {
        let patch: RedemptionPatch | null = null;
        commit((prev) => {
          const next = clearPeriodRedemptions(prev, benefitId, periodStart);
          patch = next;
          return { ...prev, benefitRedemptions: next.redemptions };
        });
        if (patch) writeRedemptionPatch(patch);
      },
      setTransactionBenefit: (transactionId, benefitId) => {
        let patch: RedemptionPatch | null = null;
        commit((prev) => {
          const next = linkTransactionBenefit(prev, transactionId, benefitId);
          patch = next;
          return { ...prev, benefitRedemptions: next.redemptions };
        });
        if (patch) writeRedemptionPatch(patch);
      },
      importTransactions: (txs) => {
        const rows = txs.map((tx) => normalizeTransaction(tx));
        commit((prev) => ({
          ...prev,
          transactions: [...prev.transactions, ...rows],
        }));
        void writeCloud((supabase, userId) =>
          supabase.from("transactions").insert(rows.map((row) => transactionToRow(row, userId))),
        );
      },
      loadDemo: () => {
        const demo = remapStateToUuids(normalizeState(createDemoState()));
        setState(demo);
        if (userRef.current && cloudEnabled) {
          void replaceFinanceState(createClient(), userRef.current.id, demo).catch((err) =>
            setError(err instanceof Error ? err.message : "Could not save demo data"),
          );
        } else {
          persistLocal(demo);
          markSeeded();
        }
      },
      resetAll: () => {
        const next = normalizeState(emptyState());
        setState(next);
        if (userRef.current && cloudEnabled) {
          void replaceFinanceState(createClient(), userRef.current.id, next).catch((err) =>
            setError(err instanceof Error ? err.message : "Could not reset cloud data"),
          );
        } else {
          persistLocal(next);
          clearSeeded();
        }
      },
    }),
    [commit, cloudEnabled, error, hydrated, refresh, state, syncPlaid, syncing, user, writeCloud, writeRedemptionPatch],
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
