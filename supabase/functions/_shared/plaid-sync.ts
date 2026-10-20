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
import { reviewedForPlaidWrite } from "./plaid-review.ts";
import { merchantKey } from "./rules.ts";

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
type CategoryRuleRow = { merchant_key: string; category_id: string; kind: string };

type ItemRow = {
  id: string;
  access_token_encrypted: string;
  transactions_cursor: string | null;
  institution_name?: string | null;
};

type AccountRow = {
  id: string;
  plaid_account_id: string | null;
  plaid_item_id: string | null;
  mask: string | null;
  type: string;
  institution_name: string | null;
  official_name: string | null;
  created_at: string;
};

function accountFingerprint(
  type: string,
  mask: string | null | undefined,
  officialName: string | null | undefined,
): string | null {
  if (mask) return `${type}|mask:${mask}`;
  const name = officialName?.trim().toLowerCase();
  if (name) return `${type}|name:${name}`;
  return null;
}

type ExistingTransaction = {
  id: string;
  category_id: string | null;
  type: string;
  amount: number;
  original_amount: number;
  notes: string;
  to_account_id: string | null;
  pending: boolean;
  reviewed: boolean;
  plaid_transaction_id: string | null;
  created_at: string | null;
};

/** Reconnect / new Item often reissues Plaid tx ids; match prior rows by content. */
function transactionContentKey(
  accountId: string,
  date: string,
  description: string,
  amount: number,
): string {
  return `${accountId}|${date}|${description}|${Math.round(amount * 100)}`;
}

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
  reviewed: boolean;
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
  options?: { selectedAccountIds?: string[] },
): Promise<{ added: number; modified: number; removed: number }> {
  const accessToken = await decryptSecret(itemRow.access_token_encrypted);
  const asOf = new Date().toISOString();

  const accountsResponse = await plaidRequest<{ accounts: PlaidAccount[] }>(
    "/accounts/get",
    { access_token: accessToken },
  );

  const selected = options?.selectedAccountIds?.filter(Boolean);
  const plaidAccounts =
    selected && selected.length > 0
      ? accountsResponse.accounts.filter((account) =>
          selected.includes(account.account_id),
        )
      : accountsResponse.accounts;

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, kind")
    .eq("user_id", userId);
  if (categoriesError) throw categoriesError;
  const categoryRows = (categories ?? []) as CategoryRow[];

  const { data: ruleRows, error: rulesError } = await supabase
    .from("category_rules")
    .select("merchant_key, category_id")
    .eq("user_id", userId);
  if (rulesError) throw rulesError;
  const categoryById = new Map(categoryRows.map((row) => [row.id, row]));
  const categoryRules: CategoryRuleRow[] = (ruleRows ?? []).flatMap((row) => {
    const category = categoryById.get(String(row.category_id));
    if (!category) return [];
    return [
      {
        merchant_key: String(row.merchant_key),
        category_id: category.id,
        kind: category.kind,
      },
    ];
  });

  const accountByPlaidId = await upsertPlaidAccounts(
    supabase,
    userId,
    itemRow.id,
    plaidAccounts,
    asOf,
    itemRow.institution_name ?? null,
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
      categoryRules,
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
    .select(
      "id, access_token_encrypted, transactions_cursor, institution_name",
    )
    .eq("user_id", userId)
    .neq("status", "revoked");
  if (error) throw error;

  let added = 0;
  let modified = 0;
  let removed = 0;
  for (const item of items ?? []) {
    try {
      const result = await syncPlaidItem(supabase, userId, item as ItemRow);
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
  institutionName: string | null,
): Promise<Map<string, string>> {
  // Load all linked accounts for the user so reconnecting the same bank can
  // rematch by mask/type instead of inserting duplicates under a new Item.
  const { data: existingRows, error: existingError } = await supabase
    .from("accounts")
    .select(
      "id, plaid_account_id, plaid_item_id, mask, type, institution_name, official_name, created_at",
    )
    .eq("user_id", userId)
    .eq("source", "plaid")
    .order("created_at", { ascending: true });
  if (existingError) throw existingError;

  const rows = (existingRows ?? []) as AccountRow[];
  const existingByPlaidId = new Map<string, string>();
  const fingerprintByInstitution = new Map<string, string>();
  const fingerprintAny = new Map<string, string>();
  const claimedIds = new Set<string>();

  for (const row of rows) {
    if (row.plaid_account_id) {
      existingByPlaidId.set(row.plaid_account_id, row.id);
    }
    const fingerprint = accountFingerprint(
      row.type,
      row.mask,
      row.official_name,
    );
    if (!fingerprint) continue;
    if (!fingerprintAny.has(fingerprint)) {
      fingerprintAny.set(fingerprint, row.id);
    }
    if (
      institutionName &&
      row.institution_name === institutionName &&
      !fingerprintByInstitution.has(fingerprint)
    ) {
      fingerprintByInstitution.set(fingerprint, row.id);
    }
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: Record<string, unknown>[] = [];
  const duplicateMerges: { keepId: string; dropId: string }[] = [];
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
    const officialName =
      plaidAccount.official_name ?? plaidAccount.name ?? null;
    // `name` is the user-facing label (editable in the app). Never send it on
    // updates — Plaid nicknames like "CREDIT CARD" stay on `official_name`.
    const fields = {
      type,
      current_balance: current,
      available_balance: available,
      currency,
      source: "plaid",
      plaid_item_id: plaidItemId,
      plaid_account_id: plaidAccount.account_id,
      mask: plaidAccount.mask ?? null,
      official_name: officialName,
      institution_name: institutionName,
      last_synced_at: asOf,
    };

    const byPlaidId = existingByPlaidId.get(plaidAccount.account_id);
    const fingerprint = accountFingerprint(
      type,
      plaidAccount.mask,
      officialName,
    );
    const byFingerprint = fingerprint
      ? (fingerprintByInstitution.get(fingerprint) ??
        fingerprintAny.get(fingerprint))
      : undefined;

    let existingId: string | undefined;
    if (byPlaidId && byFingerprint && byPlaidId !== byFingerprint) {
      // A prior reconnect created a duplicate. Keep the older fingerprint match
      // and merge/remove the newer row after freeing its plaid_account_id.
      existingId = byFingerprint;
      if (!claimedIds.has(byPlaidId)) {
        duplicateMerges.push({ keepId: byFingerprint, dropId: byPlaidId });
      }
    } else {
      existingId = byPlaidId ?? byFingerprint;
    }
    if (existingId && claimedIds.has(existingId)) {
      existingId = undefined;
    }

    if (existingId) {
      claimedIds.add(existingId);
      existingByPlaidId.set(plaidAccount.account_id, existingId);
      if (fingerprint) {
        fingerprintAny.set(fingerprint, existingId);
        if (institutionName) {
          fingerprintByInstitution.set(fingerprint, existingId);
        }
      }
      toUpdate.push({ id: existingId, user_id: userId, ...fields });
      snapshots.push({
        user_id: userId,
        account_id: existingId,
        current,
        available,
        iso_currency_code: currency,
        source: "plaid",
        as_of: asOf,
      });
    } else {
      toInsert.push({
        user_id: userId,
        starting_balance: 0,
        name: plaidAccount.name || plaidAccount.official_name || "Linked account",
        ...fields,
      });
      pendingSnapshots.set(plaidAccount.account_id, {
        current,
        available,
        currency,
      });
    }
  }

  for (const merge of duplicateMerges) {
    // Free the unique (user_id, plaid_account_id) slot before updating the keeper.
    const { error: clearError } = await supabase
      .from("accounts")
      .update({
        plaid_account_id: null,
        plaid_item_id: null,
      })
      .eq("user_id", userId)
      .eq("id", merge.dropId);
    if (clearError) throw clearError;

    const { data: keepTxs, error: keepTxError } = await supabase
      .from("transactions")
      .select("plaid_transaction_id")
      .eq("user_id", userId)
      .eq("account_id", merge.keepId)
      .not("plaid_transaction_id", "is", null);
    if (keepTxError) throw keepTxError;

    const keepPlaidTxIds = (keepTxs ?? [])
      .map((row) => row.plaid_transaction_id as string | null)
      .filter((id): id is string => Boolean(id));

    for (const ids of chunk(keepPlaidTxIds, WRITE_CHUNK)) {
      const { error: dedupeError } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId)
        .eq("account_id", merge.dropId)
        .in("plaid_transaction_id", ids);
      if (dedupeError) throw dedupeError;
    }

    const { error: moveTxError } = await supabase
      .from("transactions")
      .update({ account_id: merge.keepId })
      .eq("user_id", userId)
      .eq("account_id", merge.dropId);
    if (moveTxError) throw moveTxError;

    const { error: moveTransferError } = await supabase
      .from("transactions")
      .update({ to_account_id: merge.keepId })
      .eq("user_id", userId)
      .eq("to_account_id", merge.dropId);
    if (moveTransferError) throw moveTransferError;

    // After a reconnect merge, the same charges may remain under new Plaid ids.
    await dedupeAccountTransactionsByContent(supabase, userId, merge.keepId);

    const { error: deleteError } = await supabase
      .from("accounts")
      .delete()
      .eq("user_id", userId)
      .eq("id", merge.dropId);
    if (deleteError) throw deleteError;
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
      claimedIds.add(accountId);
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

  for (const row of toUpdate) {
    const { id, user_id, ...fields } = row;
    delete fields.name;
    const { error } = await supabase
      .from("accounts")
      .update(fields)
      .eq("id", id)
      .eq("user_id", user_id);
    if (error) throw error;
  }

  for (const batch of chunk(snapshots, WRITE_CHUNK)) {
    const { error } = await supabase.from("account_balances").insert(batch);
    if (error) throw error;
  }

  return existingByPlaidId;
}

function rowToExisting(row: Record<string, unknown>): ExistingTransaction {
  return {
    id: row.id as string,
    category_id: (row.category_id as string | null) ?? null,
    type: row.type as string,
    amount: Number(row.amount),
    original_amount: Number(row.original_amount ?? row.amount),
    notes: String(row.notes ?? ""),
    to_account_id: (row.to_account_id as string | null) ?? null,
    pending: Boolean(row.pending),
    reviewed: row.reviewed === undefined ? true : Boolean(row.reviewed),
    plaid_transaction_id: (row.plaid_transaction_id as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
  };
}

const EXISTING_TX_SELECT =
  "id, account_id, date, description, category_id, type, amount, original_amount, notes, to_account_id, plaid_transaction_id, pending, reviewed, created_at";

/** Keep one row per description + amount + date on an account (oldest wins). */
async function dedupeAccountTransactionsByContent(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
) {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, date, description, amount, original_amount, created_at")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const row of data ?? []) {
    const amount = Number(row.original_amount ?? row.amount);
    const key = transactionContentKey(
      accountId,
      String(row.date),
      String(row.description ?? ""),
      amount,
    );
    if (seen.has(key)) toDelete.push(row.id as string);
    else seen.add(key);
  }

  for (const ids of chunk(toDelete, WRITE_CHUNK)) {
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("user_id", userId)
      .in("id", ids);
    if (deleteError) throw deleteError;
  }
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
      .select(EXISTING_TX_SELECT)
      .eq("user_id", userId)
      .in("plaid_transaction_id", ids);
    if (error) throw error;
    for (const row of data ?? []) {
      const plaidId = row.plaid_transaction_id as string | null;
      if (!plaidId) continue;
      existing.set(plaidId, rowToExisting(row));
    }
  }
  return existing;
}

async function fetchExistingByContent(
  supabase: SupabaseClient,
  userId: string,
  accountIds: string[],
  dates: string[],
): Promise<Map<string, ExistingTransaction>> {
  const byContent = new Map<string, ExistingTransaction>();
  if (accountIds.length === 0 || dates.length === 0) return byContent;

  const uniqueDates = [...new Set(dates)].sort();
  const uniqueAccounts = [...new Set(accountIds)];

  for (const accounts of chunk(uniqueAccounts, WRITE_CHUNK)) {
    const { data, error } = await supabase
      .from("transactions")
      .select(EXISTING_TX_SELECT)
      .eq("user_id", userId)
      .in("account_id", accounts)
      .in("date", uniqueDates);
    if (error) throw error;
    for (const row of data ?? []) {
      const accountId = row.account_id as string;
      const date = row.date as string;
      const description = String(row.description ?? "");
      const amount = Number(row.original_amount ?? row.amount);
      const key = transactionContentKey(accountId, date, description, amount);
      const mapped = rowToExisting(row);
      const current = byContent.get(key);
      // Prefer the oldest row when duplicates already exist.
      if (
        !current ||
        (mapped.created_at &&
          current.created_at &&
          mapped.created_at < current.created_at) ||
        (mapped.created_at && !current.created_at)
      ) {
        byContent.set(key, mapped);
      }
    }
  }
  return byContent;
}

async function applyPlaidTransactions(
  supabase: SupabaseClient,
  userId: string,
  transactions: PlaidTransaction[],
  accountByPlaidId: Map<string, string>,
  categories: CategoryRow[],
  categoryRules: CategoryRuleRow[],
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

  const existingByPlaidId = await fetchExistingTransactions(
    supabase,
    userId,
    txs.map((tx) => tx.transaction_id),
  );

  const contentLookups: { accountId: string; date: string }[] = [];
  for (const tx of txs) {
    const accountId = accountByPlaidId.get(tx.account_id);
    if (!accountId) continue;
    if (existingByPlaidId.has(tx.transaction_id)) continue;
    contentLookups.push({ accountId, date: tx.date });
  }
  const existingByContent = await fetchExistingByContent(
    supabase,
    userId,
    contentLookups.map((item) => item.accountId),
    contentLookups.map((item) => item.date),
  );

  // Rows already claimed by a known Plaid id should not be rematched by content.
  const claimedIds = new Set(
    [...existingByPlaidId.values()].map((row) => row.id),
  );
  const accountsNeedingDedupe = new Set<string>();

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
    const description = tx.name || tx.merchant_name || "Plaid transaction";
    const bankAmount = mapPlaidAmount(tx.amount);

    let current = existingByPlaidId.get(tx.transaction_id);
    if (!current) {
      const contentKey = transactionContentKey(
        accountId,
        tx.date,
        description,
        bankAmount,
      );
      const byContent = existingByContent.get(contentKey);
      if (byContent && !claimedIds.has(byContent.id)) {
        current = byContent;
        claimedIds.add(byContent.id);
        // Sibling rows with the same content may remain from an earlier reconnect.
        accountsNeedingDedupe.add(accountId);
      }
    }

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
    const rule = categoryRules.find((item) => {
      if (item.merchant_key !== merchantKey(tx.merchant_name, tx.name)) {
        return false;
      }
      if (type === "income") return item.kind === "income";
      if (type === "expense") return item.kind === "expense";
      return false;
    });
    const categoryId = rule
      ? rule.category_id
      : mapped
        ? (findCategoryId(categories, mapped.name, mapped.kind) ?? null)
        : null;
    const keepManualCategory =
      current != null && current.type === type && Boolean(current.category_id);

    const keepShare =
      current != null && !sameMoney(current.amount, current.original_amount);
    const posted = Boolean(current?.pending) && !tx.pending;

    const row: TransactionWrite = {
      user_id: userId,
      date: tx.date,
      description,
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
      reviewed: reviewedForPlaidWrite(type, posted, current?.reviewed),
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

  for (const accountId of accountsNeedingDedupe) {
    await dedupeAccountTransactionsByContent(supabase, userId, accountId);
  }
}
