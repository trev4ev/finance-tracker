import { sameMoney } from "./money";
import type {
  Account,
  Budget,
  Category,
  FinanceState,
  Transaction,
} from "./types";

export function accountBalance(
  account: Account,
  transactions: Transaction[],
): number {
  if (account.source === "plaid" && account.currentBalance != null) {
    return account.currentBalance;
  }
  let balance = account.startingBalance;
  for (const tx of transactions) {
    if (tx.type === "income" && tx.accountId === account.id) {
      balance += cashAmount(tx);
    } else if (tx.type === "expense" && tx.accountId === account.id) {
      balance -= cashAmount(tx);
    } else if (tx.type === "transfer") {
      if (tx.accountId === account.id) balance -= cashAmount(tx);
      if (tx.toAccountId === account.id) balance += cashAmount(tx);
    }
  }
  return balance;
}

export function netWorth(state: FinanceState): number {
  return state.accounts.reduce(
    (sum, account) => sum + accountBalance(account, state.transactions),
    0,
  );
}

export function inMonth(tx: Transaction, month: string): boolean {
  return tx.date.startsWith(month);
}

export function monthTotals(transactions: Transaction[], month: string) {
  let income = 0;
  let expenses = 0;
  for (const tx of transactions) {
    if (!inMonth(tx, month)) continue;
    if (tx.type === "income") income += tx.amount;
    if (tx.type === "expense") expenses += tx.amount;
  }
  return { income, expenses, net: income - expenses };
}

export function spendingByCategory(
  state: FinanceState,
  month: string,
): { category: Category; amount: number }[] {
  const totals = new Map<string, number>();
  for (const tx of state.transactions) {
    if (!inMonth(tx, month) || tx.type !== "expense" || !tx.categoryId) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount);
  }
  return state.categories
    .filter((category) => category.kind === "expense")
    .map((category) => ({
      category,
      amount: totals.get(category.id) ?? 0,
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function spentForBudget(
  transactions: Transaction[],
  budget: Budget,
): number {
  return transactions
    .filter(
      (tx) =>
        tx.type === "expense" &&
        tx.categoryId === budget.categoryId &&
        inMonth(tx, budget.month),
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/** What actually moved in the account (bank charge), even if spending was split. */
export function cashAmount(tx: Transaction): number {
  return tx.originalAmount ?? tx.amount;
}

export function hasAdjustedAmount(tx: Transaction): boolean {
  return !sameMoney(tx.amount, cashAmount(tx));
}

export function lookup<T extends { id: string }>(
  items: T[],
  id: string | null | undefined,
): T | undefined {
  if (!id) return undefined;
  return items.find((item) => item.id === id);
}

function formatPlaidCategoryLabel(primary: string | null | undefined): string | null {
  if (!primary) return null;
  return primary
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

export function transactionDetailLabel(
  tx: Transaction,
  state: Pick<FinanceState, "accounts" | "categories">,
): string {
  if (tx.type === "transfer") {
    const from = lookup(state.accounts, tx.accountId)?.name;
    const to = lookup(state.accounts, tx.toAccountId)?.name;
    if (from && to) return `${from} → ${to}`;
    return (
      lookup(state.categories, tx.categoryId)?.name ??
      formatPlaidCategoryLabel(tx.plaidCategory) ??
      "Transfer"
    );
  }
  return (
    lookup(state.categories, tx.categoryId)?.name ??
    formatPlaidCategoryLabel(tx.plaidCategory) ??
    "Uncategorized"
  );
}

export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.id.localeCompare(a.id);
  });
}
