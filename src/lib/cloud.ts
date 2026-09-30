import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeState } from "./normalize";
import type {
  Account,
  AccountBalance,
  BenefitRedemption,
  CardBenefit,
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

function isJwtClockError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST303" ||
    (error.message ?? "").toLowerCase().includes("jwt issued at future")
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadFinanceState(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinanceState> {
  let lastError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(800 * attempt);
    const [
      accounts,
      categories,
      transactions,
      cardBenefits,
      benefitRedemptions,
      plaidItems,
      accountBalances,
    ] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", userId),
      supabase.from("categories").select("*").eq("user_id", userId),
      supabase.from("transactions").select("*").eq("user_id", userId),
      supabase.from("card_benefits").select("*").eq("user_id", userId),
      supabase.from("benefit_redemptions").select("*").eq("user_id", userId),
      supabase
        .from("plaid_items")
        .select("id, institution_name, status, last_synced_at")
        .eq("user_id", userId),
      supabase
        .from("account_balances")
        .select("*")
        .eq("user_id", userId)
        .order("as_of", { ascending: true }),
    ]);

    const error =
      accounts.error ||
      categories.error ||
      transactions.error ||
      cardBenefits.error ||
      benefitRedemptions.error ||
      plaidItems.error ||
      accountBalances.error;
    if (!error) {
      return normalizeState({
        accounts: (accounts.data ?? []).map(accountFromRow),
        categories: (categories.data ?? []).map(categoryFromRow),
        transactions: (transactions.data ?? []).map(transactionFromRow),
        cardBenefits: (cardBenefits.data ?? []).map(cardBenefitFromRow),
        benefitRedemptions: (benefitRedemptions.data ?? []).map(
          benefitRedemptionFromRow,
        ),
        plaidItems: (plaidItems.data ?? []).map(plaidItemFromRow),
        accountBalances: (accountBalances.data ?? []).map(
          accountBalanceFromRow,
        ),
      });
    }
    lastError = error;
    if (!isJwtClockError(error)) break;
  }
  throw new Error(lastError?.message ?? "Could not load cloud data");
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
  await del("benefit_redemptions");
  await del("card_benefits");
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
  if (state.cardBenefits.length > 0) {
    const { error } = await supabase.from("card_benefits").insert(
      state.cardBenefits.map((benefit) => cardBenefitToRow(benefit, userId)),
    );
    if (error) throw error;
  }
  if (state.transactions.length > 0) {
    const { error } = await supabase.from("transactions").insert(
      state.transactions.map((tx) => transactionToRow(tx, userId)),
    );
    if (error) throw error;
  }
  if (state.benefitRedemptions.length > 0) {
    const { error } = await supabase.from("benefit_redemptions").insert(
      state.benefitRedemptions.map((row) =>
        benefitRedemptionToRow(row, userId),
      ),
    );
    if (error) throw error;
  }
  if (state.accountBalances.length > 0) {
    const { error } = await supabase.from("account_balances").insert(
      state.accountBalances.map((row) => accountBalanceToRow(row, userId)),
    );
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
    original_amount: tx.originalAmount,
    type: tx.type,
    account_id: tx.accountId,
    category_id: tx.categoryId,
    to_account_id: tx.toAccountId,
    notes: tx.notes,
    source: tx.source,
    plaid_transaction_id: tx.plaidTransactionId,
    pending: tx.pending,
    merchant_name: tx.merchantName,
    plaid_category: tx.plaidCategory,
  };
}

export function accountBalanceToRow(row: AccountBalance, userId: string) {
  return {
    id: row.id,
    user_id: userId,
    account_id: row.accountId,
    current: row.current,
    available: row.available,
    iso_currency_code: row.currency,
    source: row.source,
    as_of: row.asOf,
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

export function cardBenefitToRow(benefit: CardBenefit, userId: string) {
  return {
    id: benefit.id,
    user_id: userId,
    account_id: benefit.accountId,
    name: benefit.name,
    frequency: benefit.frequency,
    expected_amount: benefit.expectedAmount,
    cycle_start_month: benefit.cycleStartMonth,
    notes: benefit.notes,
    active: benefit.active,
  };
}

export function benefitRedemptionToRow(
  row: BenefitRedemption,
  userId: string,
) {
  return {
    id: row.id,
    user_id: userId,
    benefit_id: row.benefitId,
    period_start: row.periodStart,
    used_on: row.usedOn,
    transaction_id: row.transactionId,
    amount: row.amount,
    notes: row.notes,
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
    originalAmount: num(
      (row.original_amount as number | undefined) ?? (row.amount as number),
    ),
    type: row.type as Transaction["type"],
    accountId: String(row.account_id),
    categoryId: (row.category_id as string | null) ?? null,
    toAccountId: (row.to_account_id as string | null) ?? null,
    notes: String(row.notes ?? ""),
    source: (row.source as Transaction["source"]) ?? "manual",
    plaidTransactionId: (row.plaid_transaction_id as string | null) ?? null,
    pending: Boolean(row.pending),
    merchantName: (row.merchant_name as string | null) ?? null,
    plaidCategory: (row.plaid_category as string | null) ?? null,
  };
}

function cardBenefitFromRow(row: Record<string, unknown>): CardBenefit {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    name: String(row.name),
    frequency: row.frequency as CardBenefit["frequency"],
    expectedAmount: numOrNull(row.expected_amount as number | null),
    cycleStartMonth: num(row.cycle_start_month as number, 1),
    notes: String(row.notes ?? ""),
    active: row.active === undefined ? true : Boolean(row.active),
  };
}

function benefitRedemptionFromRow(
  row: Record<string, unknown>,
): BenefitRedemption {
  return {
    id: String(row.id),
    benefitId: String(row.benefit_id),
    periodStart: String(row.period_start),
    usedOn: String(row.used_on).slice(0, 10),
    transactionId: (row.transaction_id as string | null) ?? null,
    amount: numOrNull(row.amount as number | null),
    notes: String(row.notes ?? ""),
  };
}

function accountBalanceFromRow(row: Record<string, unknown>): AccountBalance {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    current: numOrNull(row.current as number | null),
    available: numOrNull(row.available as number | null),
    currency: String(row.iso_currency_code ?? "USD"),
    source: (row.source as AccountBalance["source"]) ?? "plaid",
    asOf: String(row.as_of),
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
