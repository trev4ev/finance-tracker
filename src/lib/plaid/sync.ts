import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountBase, Transaction as PlaidTransaction } from "plaid";
import { getPlaidClient } from "./client";
import { decryptSecret } from "./crypto";
import {
  mapPlaidAccountType,
  mapPlaidAmount,
  mapPlaidCategoryName,
  mapPlaidTransactionType,
} from "./map";

type CategoryRow = { id: string; name: string; kind: string };

type ItemRow = {
  id: string;
  access_token_encrypted: string;
  transactions_cursor: string | null;
};

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

export async function syncPlaidItem(
  supabase: SupabaseClient,
  userId: string,
  itemRow: ItemRow,
): Promise<{ added: number; modified: number; removed: number }> {
  const client = getPlaidClient();
  const accessToken = decryptSecret(itemRow.access_token_encrypted);
  const asOf = new Date().toISOString();

  const accountsResponse = await client.accountsGet({
    access_token: accessToken,
  });

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, kind")
    .eq("user_id", userId);
  const categoryRows = (categories ?? []) as CategoryRow[];

  for (const plaidAccount of accountsResponse.data.accounts) {
    await upsertPlaidAccount(supabase, userId, itemRow.id, plaidAccount, asOf);
  }

  let cursor = itemRow.transactions_cursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await client.transactionsSync({
      access_token: accessToken,
      cursor,
      options: { include_personal_finance_category: true },
    });

    for (const tx of data.added) {
      await upsertPlaidTransaction(supabase, userId, tx, categoryRows);
      added += 1;
    }
    for (const tx of data.modified) {
      await upsertPlaidTransaction(supabase, userId, tx, categoryRows);
      modified += 1;
    }
    const removedIds = data.removed
      .map((item) => item.transaction_id)
      .filter(Boolean);
    if (removedIds.length > 0) {
      await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId)
        .in("plaid_transaction_id", removedIds);
      removed += removedIds.length;
    }

    hasMore = data.has_more;
    cursor = data.next_cursor;
  }

  await supabase
    .from("plaid_items")
    .update({
      transactions_cursor: cursor ?? null,
      last_synced_at: asOf,
      status: "active",
      error_message: null,
    })
    .eq("id", itemRow.id)
    .eq("user_id", userId);

  await supabase
    .from("accounts")
    .update({ last_synced_at: asOf })
    .eq("plaid_item_id", itemRow.id)
    .eq("user_id", userId);

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

async function upsertPlaidAccount(
  supabase: SupabaseClient,
  userId: string,
  plaidItemId: string,
  plaidAccount: AccountBase,
  asOf: string,
) {
  const type = mapPlaidAccountType(plaidAccount.type, plaidAccount.subtype);
  const current = signedBalance(type, num(plaidAccount.balances.current));
  const available = num(plaidAccount.balances.available);

  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("plaid_account_id", plaidAccount.account_id)
    .maybeSingle();

  const fields = {
    name: plaidAccount.name || plaidAccount.official_name || "Linked account",
    type,
    current_balance: current,
    available_balance: available,
    currency: plaidAccount.balances.iso_currency_code || "USD",
    source: "plaid",
    plaid_item_id: plaidItemId,
    plaid_account_id: plaidAccount.account_id,
    mask: plaidAccount.mask ?? null,
    official_name: plaidAccount.official_name ?? null,
    last_synced_at: asOf,
  };

  let accountId = existing?.id as string | undefined;
  if (accountId) {
    const { error } = await supabase.from("accounts").update(fields).eq("id", accountId);
    if (error) throw error;
  } else {
    const { data: inserted, error } = await supabase
      .from("accounts")
      .insert({ user_id: userId, starting_balance: 0, ...fields })
      .select("id")
      .single();
    if (error) throw error;
    accountId = inserted.id as string;
  }

  const { error: snapshotError } = await supabase.from("account_balances").insert({
    user_id: userId,
    account_id: accountId,
    current,
    available,
    iso_currency_code: plaidAccount.balances.iso_currency_code || "USD",
    source: "plaid",
    as_of: asOf,
  });
  if (snapshotError) throw snapshotError;
}

async function upsertPlaidTransaction(
  supabase: SupabaseClient,
  userId: string,
  tx: PlaidTransaction,
  categories: CategoryRow[],
) {
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("plaid_account_id", tx.account_id)
    .maybeSingle();
  if (!account) return;

  const type = mapPlaidTransactionType(
    tx.amount,
    tx.personal_finance_category?.primary,
  );
  const mapped = mapPlaidCategoryName(
    tx.personal_finance_category?.primary,
    tx.personal_finance_category?.detailed,
  );
  const categoryId =
    mapped && type !== "transfer"
      ? (categories.find(
          (category) =>
            category.name.toLowerCase() === mapped.name.toLowerCase() &&
            category.kind === mapped.kind,
        )?.id ?? null)
      : null;

  const row = {
    user_id: userId,
    date: tx.date,
    description: tx.name || tx.merchant_name || "Plaid transaction",
    amount: mapPlaidAmount(tx.amount),
    type,
    account_id: account.id,
    category_id: categoryId,
    to_account_id: null,
    notes: "",
    source: "plaid",
    plaid_transaction_id: tx.transaction_id,
    pending: Boolean(tx.pending),
    merchant_name: tx.merchant_name ?? null,
  };

  const { data: existing } = await supabase
    .from("transactions")
    .select("id, category_id")
    .eq("user_id", userId)
    .eq("plaid_transaction_id", tx.transaction_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("transactions")
      .update({
        ...row,
        category_id: existing.category_id ?? row.category_id,
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("transactions").insert(row);
    if (error) throw error;
  }
}
