import { addDays, daysBetween, todayISO } from "./dates";
import { formatMoney, roundMoney, sameMoney } from "./money";
import type {
  Account,
  AccountType,
  Budget,
  Category,
  FinanceState,
  Transaction,
} from "./types";

export function transactionEffectOnAccount(
  tx: Transaction,
  accountId: string,
): number {
  const amount = cashAmount(tx);
  if (tx.type === "income" && tx.accountId === accountId) return amount;
  if (tx.type === "expense" && tx.accountId === accountId) return -amount;
  if (tx.type === "transfer") {
    if (tx.accountId === accountId) return -amount;
    if (tx.toAccountId === accountId) return amount;
  }
  return 0;
}

/** Starting balance plus every posted movement, ignoring a live Plaid snapshot. */
export function ledgerBalance(
  account: Account,
  transactions: Transaction[],
): number {
  let balance = account.startingBalance;
  for (const tx of transactions) {
    balance += transactionEffectOnAccount(tx, account.id);
  }
  return roundMoney(balance);
}

export function accountBalance(
  account: Account,
  transactions: Transaction[],
): number {
  if (account.source === "plaid" && account.currentBalance != null) {
    return account.currentBalance;
  }
  return ledgerBalance(account, transactions);
}

export function formatAccountBalance(
  type: AccountType,
  balance: number,
): string {
  if ((type === "credit" || type === "loan") && balance < 0) {
    return `${formatMoney(Math.abs(balance))} owed`;
  }
  return formatMoney(balance);
}

export type HistoryRange = "3m" | "6m" | "1y" | "all";

export const HISTORY_RANGES: { value: HistoryRange; label: string }[] = [
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

export type BalanceSnapshot = {
  date: string;
  balances: Record<string, number>;
  netWorth: number;
};

const RANGE_DAYS: Record<Exclude<HistoryRange, "all">, number> = {
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

const MAX_HISTORY_POINTS = 180;

export function historyRangeStart(
  range: HistoryRange,
  transactions: Transaction[],
  endDate = todayISO(),
): string {
  let earliestTx: string | null = null;
  for (const tx of transactions) {
    if (!earliestTx || tx.date < earliestTx) earliestTx = tx.date;
  }
  const opening = earliestTx
    ? addDays(earliestTx, -1)
    : addDays(endDate, -90);

  if (range === "all") {
    return opening < endDate ? opening : addDays(endDate, -90);
  }

  const start = addDays(endDate, -RANGE_DAYS[range]);
  return start < opening ? opening : start;
}

export function historicalBalances(
  accounts: Account[],
  transactions: Transaction[],
  fromDate: string,
  toDate: string,
): BalanceSnapshot[] {
  if (accounts.length === 0) return [];
  if (fromDate > toDate) return [];

  const running = new Map<string, number>();
  for (const account of accounts) {
    const live = accountBalance(account, transactions);
    const reconstructed = ledgerBalance(account, transactions);
    const offset = live - reconstructed;
    let balance = account.startingBalance + offset;
    for (const tx of transactions) {
      if (tx.date < fromDate) {
        balance += transactionEffectOnAccount(tx, account.id);
      }
    }
    running.set(account.id, roundMoney(balance));
  }

  const span = Math.max(1, daysBetween(fromDate, toDate));
  const step = Math.max(1, Math.ceil(span / MAX_HISTORY_POINTS));
  const sampleDates: string[] = [];
  for (
    let date = fromDate;
    date < toDate;
    date = addDays(date, step)
  ) {
    sampleDates.push(date);
  }
  if (sampleDates[sampleDates.length - 1] !== toDate) {
    sampleDates.push(toDate);
  }

  const dated = transactions
    .filter((tx) => tx.date >= fromDate && tx.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const points: BalanceSnapshot[] = [];
  let cursor = 0;

  const snapshot = (date: string): BalanceSnapshot => {
    const balances: Record<string, number> = {};
    let total = 0;
    for (const account of accounts) {
      const value = running.get(account.id) ?? 0;
      balances[account.id] = value;
      total += value;
    }
    return { date, balances, netWorth: roundMoney(total) };
  };

  for (const date of sampleDates) {
    while (cursor < dated.length && dated[cursor]!.date <= date) {
      applyTransaction(running, dated[cursor]!);
      cursor += 1;
    }
    points.push(snapshot(date));
  }

  return points;
}

function applyTransaction(running: Map<string, number>, tx: Transaction) {
  const fromDelta = transactionEffectOnAccount(tx, tx.accountId);
  if (fromDelta !== 0 && running.has(tx.accountId)) {
    running.set(
      tx.accountId,
      roundMoney((running.get(tx.accountId) ?? 0) + fromDelta),
    );
  }
  if (!tx.toAccountId) return;
  const toDelta = transactionEffectOnAccount(tx, tx.toAccountId);
  if (toDelta !== 0 && running.has(tx.toAccountId)) {
    running.set(
      tx.toAccountId,
      roundMoney((running.get(tx.toAccountId) ?? 0) + toDelta),
    );
  }
}

const TYPE_COLORS: Record<AccountType, string> = {
  checking: "#38bdf8",
  savings: "#2dd4bf",
  credit: "#fb7185",
  cash: "#fbbf24",
  investment: "#a78bfa",
  loan: "#fb923c",
  other: "#94a3b8",
};

const FALLBACK_COLORS = [
  "#2dd4bf",
  "#38bdf8",
  "#a78bfa",
  "#fbbf24",
  "#fb7185",
  "#34d399",
  "#fb923c",
  "#94a3b8",
];

export function accountChartColor(
  account: Account,
  accounts: Account[],
): string {
  const sameType = accounts.filter((item) => item.type === account.type);
  if (sameType.length <= 1) return TYPE_COLORS[account.type];
  const index = accounts.findIndex((item) => item.id === account.id);
  return FALLBACK_COLORS[index < 0 ? 0 : index % FALLBACK_COLORS.length]!;
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

export function groupTransactionsByDate(
  transactions: Transaction[],
): { date: string; items: Transaction[] }[] {
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const tx of transactions) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) last.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  }
  return groups;
}
