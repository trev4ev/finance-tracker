import type { Category, CategoryRule, Transaction } from "./types";

export function merchantKey(
  merchantName: string | null | undefined,
  description: string,
): string {
  return (merchantName?.trim() || description.trim()).toLowerCase();
}

export function transactionMerchantKey(
  tx: Pick<Transaction, "description"> & { merchantName?: string | null },
): string {
  return merchantKey(tx.merchantName, tx.description);
}

export function findCategoryRule(
  rules: CategoryRule[],
  key: string,
): CategoryRule | undefined {
  if (!key) return undefined;
  return rules.find((rule) => rule.merchantKey === key);
}

export function similarTransactions(
  transactions: Transaction[],
  sample: Pick<Transaction, "id" | "type" | "description"> & {
    merchantName?: string | null;
  },
): Transaction[] {
  const key = transactionMerchantKey(sample);
  if (!key) return [];
  return transactions.filter(
    (tx) =>
      tx.id !== sample.id &&
      !tx.pending &&
      tx.type === sample.type &&
      transactionMerchantKey(tx) === key,
  );
}

export function applyCategoryRule(
  transactions: Transaction[],
  categories: Category[],
  key: string,
  categoryId: string,
): Transaction[] {
  const category = categories.find((item) => item.id === categoryId);
  if (!category || !key) return transactions;
  if (category.kind !== "income" && category.kind !== "expense") {
    return transactions;
  }
  return transactions.map((tx) => {
    if (tx.pending) return tx;
    if (tx.type !== category.kind) return tx;
    if (transactionMerchantKey(tx) !== key) return tx;
    if (tx.categoryId === categoryId) return tx;
    return { ...tx, categoryId };
  });
}

export function shouldPromptCategoryRule(
  rules: CategoryRule[],
  tx: Pick<Transaction, "type" | "description" | "categoryId"> & {
    merchantName?: string | null;
  },
): boolean {
  if (tx.type === "transfer" || !tx.categoryId) return false;
  const key = transactionMerchantKey(tx);
  if (!key) return false;
  const existing = findCategoryRule(rules, key);
  return existing?.categoryId !== tx.categoryId;
}
