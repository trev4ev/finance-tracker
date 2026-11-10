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

export function applyNameToSimilar(
  transactions: Transaction[],
  sample: Pick<Transaction, "id" | "type">,
  previousKey: string,
  description: string,
): Transaction[] {
  if (!previousKey || !description.trim()) return transactions;
  return transactions.map((tx) => {
    if (tx.id === sample.id) return tx;
    if (tx.pending) return tx;
    if (tx.type !== sample.type) return tx;
    if (transactionMerchantKey(tx) !== previousKey) return tx;
    if (tx.description === description) return tx;
    return { ...tx, description, reviewed: true };
  });
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

export function nameOrCategoryChanged(
  previous: Pick<Transaction, "description" | "categoryId">,
  next: Pick<Transaction, "description" | "categoryId">,
): { nameChanged: boolean; categoryChanged: boolean } {
  return {
    nameChanged: previous.description.trim() !== next.description.trim(),
    categoryChanged: (previous.categoryId ?? "") !== (next.categoryId ?? ""),
  };
}

/** Amount, date, and other edits never fan out. Name and category can. */
export function shouldPromptApplyToAll(
  rules: CategoryRule[],
  next: Pick<Transaction, "type" | "description" | "categoryId"> & {
    merchantName?: string | null;
  },
  previous?: Pick<Transaction, "description" | "categoryId">,
  similarCount = 0,
): boolean {
  if (previous) {
    const { nameChanged, categoryChanged } = nameOrCategoryChanged(previous, next);
    if (!nameChanged && !categoryChanged) return false;
    if (nameChanged && similarCount > 0) return true;
    if (!categoryChanged) return false;
  }
  return shouldPromptCategoryRule(rules, next);
}
