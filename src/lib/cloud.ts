import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeState } from "./normalize";
import type {
  Account,
  Budget,
  Category,
  FinanceState,
  PlaidItem,
  Transaction,
} from "./types";

function num(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numOrNull(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loadFinanceState(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinanceState> {
  const [accounts, categories, transactions, budgets, plaidItems] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", userId),
      supabase.from("categories").select("*").eq("user_id", userId),
      supabase.from("transactions").select("*").eq("user_id", userId),
      supabase.from("budgets").select("*").eq("user_id", userId),
      supabase
        .from("plaid_items")
        .select("id, institution_name, status, last_synced_at")
        .eq("user_id", userId),
    ]);

  const error =
    accounts.error ||
    categories.error ||
    transactions.error ||
    budgets.error ||
    plaidItems.error;
  if (error) throw error;

  return normalizeState({
    accounts: (accounts.data ?? []).map(accountFromRow),
    categories: (categories.data ?? []).map(categoryFromRow),
    transactions: (transactions.data ?? []).map(transactionFromRow),
    budgets: (budgets.data ?? []).map(budgetFromRow),
    plaidItems: (plaidItems.data ?? []).map(plaidItemFromRow),
  });
}

export async function replaceFinanceState(
  supabase: SupabaseClient,
  userId: string,
  state: FinanceState,
): Promise<void> {
  const del = async (table: string) => {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  };
  await del("transactions");
  await del("budgets");
  await del("account_balances");
  await del("accounts");
  await del("plaid_items");
  await del("categories");

  if (state.categories.length > 0) {
    const { error } = await supabase
      .from("categories")
      .insert(state.categories.map((category) => categoryToRow(category, userId)));
    if (error) throw error;
  }
  if (state.accounts.length > 0) {
    const { error } = await supabase
      .from("accounts")
      .insert(state.accounts.map((account) => accountToRow(account, userId)));
    if (error) throw error;
  }
  if (state.transactions.length > 0) {
    const { error } = await supabase.from("transactions").insert(
      state.transactions.map((tx) => transactionToRow(tx, userId)),
    );
    if (error) throw error;
  }
  if (state.budgets.length > 0) {
    const { error } = await supabase
      .from("budgets")
      .insert(state.budgets.map((budget) => budgetToRow(budget, userId)));
    if (error) throw error;
  }
}

export function accountToRow(account: Account, userId: string) {
  return {
    id: account.id,
    user_id: userId,
    name: account.name,
    type: account.type,
    starting_balance: account.startingBalance,
    current_balance: account.currentBalance,
    available_balance: account.availableBalance,
    currency: account.currency,
    source: account.source,
    plaid_item_id: account.plaidItemId,
    plaid_account_id: account.plaidAccountId,
    institution_name: account.institutionName,
    mask: account.mask,
    last_synced_at: account.lastSyncedAt,
  };
}

export function transactionToRow(tx: Transaction, userId: string) {
  return {
    id: tx.id,
    user_id: userId,
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
    type: tx.type,
    account_id: tx.accountId,
    category_id: tx.categoryId,
    to_account_id: tx.toAccountId,
    notes: tx.notes,
    source: tx.source,
    plaid_transaction_id: tx.plaidTransactionId,
    pending: tx.pending,
    merchant_name: tx.merchantName,
  };
}

export function categoryToRow(category: Category, userId: string) {
  return {
    id: category.id,
    user_id: userId,
    name: category.name,
    kind: category.kind,
    color: category.color,
  };
}

export function budgetToRow(budget: Budget, userId: string) {
  return {
    id: budget.id,
    user_id: userId,
    category_id: budget.categoryId,
    month: budget.month,
    amount: budget.amount,
  };
}

function accountFromRow(row: Record<string, unknown>): Account {
  return {
    id: String(row.id),
    name: String(row.name),
    type: row.type as Account["type"],
    startingBalance: num(row.starting_balance as number),
    currentBalance: numOrNull(row.current_balance as number | null),
    availableBalance: numOrNull(row.available_balance as number | null),
    currency: String(row.currency ?? "USD"),
    source: (row.source as Account["source"]) ?? "manual",
    plaidAccountId: (row.plaid_account_id as string | null) ?? null,
    plaidItemId: (row.plaid_item_id as string | null) ?? null,
    institutionName: (row.institution_name as string | null) ?? null,
    mask: (row.mask as string | null) ?? null,
    lastSyncedAt: (row.last_synced_at as string | null) ?? null,
  };
}

function categoryFromRow(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    name: String(row.name),
    kind: row.kind as Category["kind"],
    color: String(row.color),
  };
}

function transactionFromRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    date: String(row.date).slice(0, 10),
    description: String(row.description),
    amount: num(row.amount as number),
    type: row.type as Transaction["type"],
    accountId: String(row.account_id),
    categoryId: (row.category_id as string | null) ?? null,
    toAccountId: (row.to_account_id as string | null) ?? null,
    notes: String(row.notes ?? ""),
    source: (row.source as Transaction["source"]) ?? "manual",
    plaidTransactionId: (row.plaid_transaction_id as string | null) ?? null,
    pending: Boolean(row.pending),
    merchantName: (row.merchant_name as string | null) ?? null,
  };
}

function budgetFromRow(row: Record<string, unknown>): Budget {
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    month: String(row.month),
    amount: num(row.amount as number),
  };
}

function plaidItemFromRow(row: Record<string, unknown>): PlaidItem {
  return {
    id: String(row.id),
    institutionName: (row.institution_name as string | null) ?? null,
    status: String(row.status ?? "active"),
    lastSyncedAt: (row.last_synced_at as string | null) ?? null,
  };
}
