import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decryptSecret } from "./crypto.ts";
import { sameMoney } from "./money.ts";
import { plaidRequest } from "./plaid-api.ts";
import {
  colorForCategory,
  mapPlaidAccountType,
  mapPlaidAmount,
  mapPlaidCategoryName,
  mapNonSpendingCategory,
  mapPlaidTransactionType,
} from "./plaid-map.ts";

type PlaidAccount = {
  account_id: string;
  name?: string | null;
  official_name?: string | null;
  type?: string | null;
  subtype?: string | null;
  mask?: string | null;
  balances: {
    current?: number | null;
    available?: number | null;
    iso_currency_code?: string | null;
  };
};

type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name?: string | null;
  merchant_name?: string | null;
  pending?: boolean;
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
  } | null;
};

type CategoryRow = { id: string; name: string; kind: string };

type ItemRow = {
  id: string;
  access_token_encrypted: string;
  transactions_cursor: string | null;
};

type ExistingTransaction = {
  id: string;
  category_id: string | null;
  type: string;
  amount: number;
  original_amount: number;
  notes: string;
  to_account_id: string | null;
};

type TransactionWrite = {
  id?: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  original_amount: number;
  type: string;
  account_id: string;
  category_id: string | null;
  to_account_id: string | null;
  notes: string;
  source: "plaid";
  plaid_transaction_id: string;
  pending: boolean;
  merchant_name: string | null;
  plaid_category: string | null;
};

const WRITE_CHUNK = 100;
const PLAID_SYNC_PAGE = 500;

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function signedBalance(type: string, current: number | null): number | null {
  if (current === null) return null;
  if (type === "credit" || type === "loan") return -Math.abs(current);
  return current;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

export async function syncPlaidItem(
  supabase: SupabaseClient,
  userId: string,
  itemRow: ItemRow,
): Promise<{ added: number; modified: number; removed: number }> {
  const accessToken = await decryptSecret(itemRow.access_token_encrypted);
  const asOf = new Date().toISOString();

  const accountsResponse = await plaidRequest<{ accounts: PlaidAccount[] }>(
    "/accounts/get",
    { access_token: accessToken },
  );

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, kind")
    .eq("user_id", userId);
  if (categoriesError) throw categoriesError;
  const categoryRows = (categories ?? []) as CategoryRow[];

  const accountByPlaidId = await upsertPlaidAccounts(
    supabase,
    userId,
    itemRow.id,
    accountsResponse.accounts,
    asOf,
  );

  let cursor = itemRow.transactions_cursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  while (hasMore) {
    const data = await plaidRequest<{
      added: PlaidTransaction[];
      modified: PlaidTransaction[];
      removed: { transaction_id?: string }[];
      next_cursor: string;
      has_more: boolean;
    }>("/transactions/sync", {
      access_token: accessToken,
      cursor,
      count: PLAID_SYNC_PAGE,
      options: { include_personal_finance_category: true },
    });

    await applyPlaidTransactions(
      supabase,
      userId,
      [...data.added, ...data.modified],
      accountByPlaidId,
      categoryRows,
    );
    added += data.added.length;
    modified += data.modified.length;

    const removedIds = data.removed
      .map((item) => item.transaction_id)
      .filter(Boolean) as string[];
    for (const ids of chunk(removedIds, WRITE_CHUNK)) {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId)
        .in("plaid_transaction_id", ids);
      if (error) throw error;
    }
    removed += removedIds.length;

    hasMore = data.has_more;
    cursor = data.next_cursor;
  }

  const { error: itemError } = await supabase
    .from("plaid_items")
    .update({
      transactions_cursor: cursor ?? null,
      last_synced_at: asOf,
      status: "active",
      error_message: null,
    })
    .eq("id", itemRow.id)
    .eq("user_id", userId);
  if (itemError) throw itemError;

  const { error: accountSyncError } = await supabase
    .from("accounts")
    .update({ last_synced_at: asOf })
    .eq("plaid_item_id", itemRow.id)
    .eq("user_id", userId);
  if (accountSyncError) throw accountSyncError;

  return { added, modified, removed };
}

export async function syncAllPlaidItems(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: items, error } = await supabase
    .from("plaid_items")
    .select("id, access_token_encrypted, transactions_cursor")
    .eq("user_id", userId)
    .neq("status", "revoked");
  if (error) throw error;

  let added = 0;
  let modified = 0;
  let removed = 0;
  for (const item of items ?? []) {
    try {
      const result = await syncPlaidItem(supabase, userId, item);
      added += result.added;
      modified += result.modified;
      removed += result.removed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      await supabase
        .from("plaid_items")
        .update({ status: "error", error_message: message })
        .eq("id", item.id);
      throw error;
    }
  }
  return { added, modified, removed, itemCount: items?.length ?? 0 };
}

function findCategoryId(
  categories: CategoryRow[],
  name: string,
  kind: string,
): string | undefined {
  return categories.find(
    (category) =>
      category.name.toLowerCase() === name.toLowerCase() &&
      category.kind === kind,
  )?.id;
}

async function ensureCategories(
  supabase: SupabaseClient,
  userId: string,
  categories: CategoryRow[],
  needed: { name: string; kind: string }[],
) {
  const missing = new Map<string, { name: string; kind: string }>();
  for (const item of needed) {
    if (findCategoryId(categories, item.name, item.kind)) continue;
    missing.set(`${item.kind}:${item.name.toLowerCase()}`, item);
  }
  if (missing.size === 0) return;

  const rows = [...missing.values()].map((item) => ({
    user_id: userId,
    name: item.name,
    kind: item.kind,
    color: colorForCategory(item.name),
  }));
  const { error } = await supabase.from("categories").upsert(rows, {
    onConflict: "user_id,name,kind",
    ignoreDuplicates: true,
  });
  if (error) throw error;

  const { data, error: loadError } = await supabase
    .from("categories")
    .select("id, name, kind")
    .eq("user_id", userId);
  if (loadError) throw loadError;
  categories.splice(0, categories.length, ...((data ?? []) as CategoryRow[]));
}

async function upsertPlaidAccounts(
  supabase: SupabaseClient,
  userId: string,
  plaidItemId: string,
  plaidAccounts: PlaidAccount[],
  asOf: string,
): Promise<Map<string, string>> {
  const { data: existingRows, error: existingError } = await supabase
    .from("accounts")
    .select("id, plaid_account_id")
    .eq("user_id", userId)
    .eq("plaid_item_id", plaidItemId);
  if (existingError) throw existingError;

  const existingByPlaidId = new Map(
    (existingRows ?? [])
      .filter((row) => row.plaid_account_id)
      .map((row) => [row.plaid_account_id as string, row.id as string]),
  );

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: Record<string, unknown>[] = [];
  const snapshots: Record<string, unknown>[] = [];
  const pendingSnapshots = new Map<
    string,
    { current: number | null; available: number | null; currency: string }
  >();

  for (const plaidAccount of plaidAccounts) {
    const type = mapPlaidAccountType(plaidAccount.type, plaidAccount.subtype);
    const current = signedBalance(type, num(plaidAccount.balances.current));
    const available = num(plaidAccount.balances.available);
    const currency = plaidAccount.balances.iso_currency_code || "USD";
    const plaidName =
      plaidAccount.name || plaidAccount.official_name || "Linked account";
    // `name` is the user-facing label (editable in the app). Do not overwrite it
    // on later syncs; Plaid's names stay on `official_name`.
    const fields = {
      type,
      current_balance: current,
      available_balance: available,
      currency,
      source: "plaid",
      plaid_item_id: plaidItemId,
      plaid_account_id: plaidAccount.account_id,
      mask: plaidAccount.mask ?? null,
      official_name: plaidAccount.official_name ?? plaidAccount.name ?? null,
      last_synced_at: asOf,
    };
    const existingId = existingByPlaidId.get(plaidAccount.account_id);
    if (existingId) {
      toUpdate.push({ id: existingId, user_id: userId, ...fields });
    } else {
      toInsert.push({
        user_id: userId,
        starting_balance: 0,
        name: plaidName,
        ...fields,
      });
      pendingSnapshots.set(plaidAccount.account_id, {
        current,
        available,
        currency,
      });
    }
    if (existingId) {
      snapshots.push({
        user_id: userId,
        account_id: existingId,
        current,
        available,
        iso_currency_code: currency,
        source: "plaid",
        as_of: asOf,
      });
    }
  }

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from("accounts")
      .insert(toInsert)
      .select("id, plaid_account_id");
    if (error) throw error;
    for (const row of inserted ?? []) {
      const plaidAccountId = row.plaid_account_id as string;
      const accountId = row.id as string;
      existingByPlaidId.set(plaidAccountId, accountId);
      const snapshot = pendingSnapshots.get(plaidAccountId);
      if (!snapshot) continue;
      snapshots.push({
        user_id: userId,
        account_id: accountId,
        current: snapshot.current,
        available: snapshot.available,
        iso_currency_code: snapshot.currency,
        source: "plaid",
        as_of: asOf,
      });
    }
  }

  for (const batch of chunk(toUpdate, WRITE_CHUNK)) {
    const { error } = await supabase
      .from("accounts")
      .upsert(batch, { onConflict: "id" });
    if (error) throw error;
  }

  for (const batch of chunk(snapshots, WRITE_CHUNK)) {
    const { error } = await supabase.from("account_balances").insert(batch);
    if (error) throw error;
  }

  return existingByPlaidId;
}

async function fetchExistingTransactions(
  supabase: SupabaseClient,
  userId: string,
  plaidIds: string[],
): Promise<Map<string, ExistingTransaction>> {
  const existing = new Map<string, ExistingTransaction>();
  for (const ids of chunk(plaidIds, WRITE_CHUNK)) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, category_id, type, amount, original_amount, notes, to_account_id, plaid_transaction_id")
      .eq("user_id", userId)
      .in("plaid_transaction_id", ids);
    if (error) throw error;
    for (const row of data ?? []) {
      const plaidId = row.plaid_transaction_id as string | null;
      if (!plaidId) continue;
      existing.set(plaidId, {
        id: row.id as string,
        category_id: (row.category_id as string | null) ?? null,
        type: row.type as string,
        amount: Number(row.amount),
        original_amount: Number(row.original_amount ?? row.amount),
        notes: String(row.notes ?? ""),
        to_account_id: (row.to_account_id as string | null) ?? null,
      });
    }
  }
  return existing;
}

async function applyPlaidTransactions(
  supabase: SupabaseClient,
  userId: string,
  transactions: PlaidTransaction[],
  accountByPlaidId: Map<string, string>,
  categories: CategoryRow[],
) {
  if (transactions.length === 0) return;

  const unique = new Map<string, PlaidTransaction>();
  for (const tx of transactions) unique.set(tx.transaction_id, tx);
  const txs = [...unique.values()];

  const neededCategories: { name: string; kind: string }[] = [];
  for (const tx of txs) {
    if (!accountByPlaidId.has(tx.account_id)) continue;
    const type = mapPlaidTransactionType(
      tx.amount,
      tx.personal_finance_category?.primary,
      tx.name,
      tx.merchant_name,
    );
    const mapped =
      type === "transfer"
        ? mapNonSpendingCategory(
            tx.personal_finance_category?.primary,
            tx.name,
            tx.merchant_name,
          )
        : mapPlaidCategoryName(
            tx.personal_finance_category?.primary,
            tx.personal_finance_category?.detailed,
          );
    if (mapped) neededCategories.push(mapped);
  }
  await ensureCategories(supabase, userId, categories, neededCategories);

  const existing = await fetchExistingTransactions(
    supabase,
    userId,
    txs.map((tx) => tx.transaction_id),
  );

  const inserts: TransactionWrite[] = [];
  const updates: TransactionWrite[] = [];

  for (const tx of txs) {
    const accountId = accountByPlaidId.get(tx.account_id);
    if (!accountId) continue;

    let type = mapPlaidTransactionType(
      tx.amount,
      tx.personal_finance_category?.primary,
      tx.name,
      tx.merchant_name,
    );
    const current = existing.get(tx.transaction_id);
    if (current?.type === "transfer" && type !== "transfer") {
      type = "transfer";
    }
    const mapped =
      type === "transfer"
        ? mapNonSpendingCategory(
            tx.personal_finance_category?.primary,
            tx.name,
            tx.merchant_name,
          )
        : mapPlaidCategoryName(
            tx.personal_finance_category?.primary,
            tx.personal_finance_category?.detailed,
          );
    const categoryId = mapped
      ? (findCategoryId(categories, mapped.name, mapped.kind) ?? null)
      : null;
    const keepManualCategory =
      current != null && current.type === type && Boolean(current.category_id);

    const bankAmount = mapPlaidAmount(tx.amount);
    const keepShare =
      current != null && !sameMoney(current.amount, current.original_amount);

    const row: TransactionWrite = {
      user_id: userId,
      date: tx.date,
      description: tx.name || tx.merchant_name || "Plaid transaction",
      amount: keepShare && current ? current.amount : bankAmount,
      original_amount: bankAmount,
      type,
      account_id: accountId,
      category_id: keepManualCategory ? current.category_id : categoryId,
      to_account_id: current?.to_account_id ?? null,
      notes: current?.notes ?? "",
      source: "plaid",
      plaid_transaction_id: tx.transaction_id,
      pending: Boolean(tx.pending),
      merchant_name: tx.merchant_name ?? null,
      plaid_category: tx.personal_finance_category?.primary ?? null,
    };

    if (current) {
      updates.push({ ...row, id: current.id });
    } else {
      inserts.push(row);
    }
  }

  for (const batch of chunk(inserts, WRITE_CHUNK)) {
    const { error } = await supabase.from("transactions").insert(batch);
    if (error) throw error;
  }
  for (const batch of chunk(updates, WRITE_CHUNK)) {
    const { error } = await supabase
      .from("transactions")
      .upsert(batch, { onConflict: "id" });
    if (error) throw error;
  }
}
