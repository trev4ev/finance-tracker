import {
  addDays,
  datesInMonth,
  daysBetween,
  timestampToISODate,
  todayISO,
} from "./dates";
import { formatMoney, roundMoney, sameMoney } from "./money";
import type {
  Account,
  AccountBalance,
  AccountType,
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
  snapshots: AccountBalance[] = [],
): string {
  let earliest: string | null = null;
  for (const tx of transactions) {
    if (!earliest || tx.date < earliest) earliest = tx.date;
  }
  for (const snap of snapshots) {
    if (snap.current == null) continue;
    const date = timestampToISODate(snap.asOf);
    if (!earliest || date < earliest) earliest = date;
  }
  const opening = earliest
    ? addDays(earliest, -1)
    : addDays(endDate, -90);

  if (range === "all") {
    return opening < endDate ? opening : addDays(endDate, -90);
  }

  const start = addDays(endDate, -RANGE_DAYS[range]);
  return start < opening ? opening : start;
}

export function historyRangeEnd(
  transactions: Transaction[],
  endDate = todayISO(),
): string {
  let latest = endDate;
  for (const tx of transactions) {
    if (tx.date > latest) latest = tx.date;
  }
  return latest;
}

export function historicalBalances(
  accounts: Account[],
  transactions: Transaction[],
  fromDate: string,
  toDate: string,
  snapshots: AccountBalance[] = [],
): BalanceSnapshot[] {
  if (accounts.length === 0) return [];
  if (fromDate > toDate) return [];

  const running = new Map<string, number>();
  const snapByAccountDate = new Map<string, Map<string, number>>();
  const skipTxUntil = new Map<string, string>();

  for (const account of accounts) {
    const byDate = snapshotValuesByDate(account, snapshots, toDate);
    snapByAccountDate.set(account.id, byDate);
    const opening = openingHistoricalBalance(
      account,
      transactions,
      fromDate,
      byDate,
    );
    running.set(account.id, opening.balance);
    if (opening.skipTxUntil) skipTxUntil.set(account.id, opening.skipTxUntil);
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
  const snapEvents = snapshotEventsInRange(
    snapByAccountDate,
    fromDate,
    toDate,
  );

  const points: BalanceSnapshot[] = [];
  let txCursor = 0;
  let snapCursor = 0;

  const pointAt = (date: string): BalanceSnapshot => {
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
    while (true) {
      const tx = dated[txCursor];
      const snap = snapEvents[snapCursor];
      const txReady = tx != null && tx.date <= date;
      const snapReady = snap != null && snap.date <= date;
      if (!txReady && !snapReady) break;
      if (txReady && (!snapReady || tx.date <= snap.date)) {
        applyTransaction(running, tx, skipTxUntil);
        txCursor += 1;
      } else if (snap) {
        running.set(snap.accountId, roundMoney(snap.value));
        const skip = skipTxUntil.get(snap.accountId);
        if (skip && snap.date >= skip) skipTxUntil.delete(snap.accountId);
        snapCursor += 1;
      } else {
        break;
      }
    }
    points.push(pointAt(date));
  }

  return points;
}

function snapshotValuesByDate(
  account: Account,
  snapshots: AccountBalance[],
  toDate: string,
): Map<string, number> {
  const dated: { date: string; asOf: string; value: number }[] = [];
  for (const snap of snapshots) {
    if (snap.accountId !== account.id || snap.current == null) continue;
    dated.push({
      date: timestampToISODate(snap.asOf),
      asOf: snap.asOf,
      value: snap.current,
    });
  }
  dated.sort(
    (a, b) => a.asOf.localeCompare(b.asOf) || a.date.localeCompare(b.date),
  );
  const byDate = new Map<string, number>();
  for (const row of dated) byDate.set(row.date, row.value);

  if (
    byDate.size > 0 &&
    account.source === "plaid" &&
    account.currentBalance != null
  ) {
    const raw = account.lastSyncedAt
      ? timestampToISODate(account.lastSyncedAt)
      : toDate;
    const date = raw > toDate ? toDate : raw;
    byDate.set(date, account.currentBalance);
  }
  return byDate;
}

function openingHistoricalBalance(
  account: Account,
  transactions: Transaction[],
  fromDate: string,
  byDate: Map<string, number>,
): { balance: number; skipTxUntil: string | null } {
  if (byDate.size === 0) {
    const live = accountBalance(account, transactions);
    const reconstructed = ledgerBalance(account, transactions);
    const offset = live - reconstructed;
    let balance = account.startingBalance + offset;
    for (const tx of transactions) {
      if (tx.date < fromDate) {
        balance += transactionEffectOnAccount(tx, account.id);
      }
    }
    return { balance: roundMoney(balance), skipTxUntil: null };
  }

  const dates = [...byDate.keys()].sort();
  const firstDate = dates[0]!;
  if (firstDate >= fromDate) {
    return {
      balance: roundMoney(byDate.get(firstDate)!),
      skipTxUntil: firstDate,
    };
  }

  let priorDate = firstDate;
  for (const date of dates) {
    if (date < fromDate) priorDate = date;
    else break;
  }
  let balance = byDate.get(priorDate)!;
  for (const tx of transactions) {
    if (tx.date > priorDate && tx.date < fromDate) {
      balance += transactionEffectOnAccount(tx, account.id);
    }
  }
  return { balance: roundMoney(balance), skipTxUntil: null };
}

function snapshotEventsInRange(
  snapByAccountDate: Map<string, Map<string, number>>,
  fromDate: string,
  toDate: string,
): { date: string; accountId: string; value: number }[] {
  const events: { date: string; accountId: string; value: number }[] = [];
  for (const [accountId, byDate] of snapByAccountDate) {
    for (const [date, value] of byDate) {
      if (date < fromDate || date > toDate) continue;
      events.push({ date, accountId, value });
    }
  }
  events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.accountId.localeCompare(b.accountId),
  );
  return events;
}

function applyTransaction(
  running: Map<string, number>,
  tx: Transaction,
  skipTxUntil: Map<string, string>,
) {
  const apply = (accountId: string, delta: number) => {
    if (delta === 0 || !running.has(accountId)) return;
    const skip = skipTxUntil.get(accountId);
    if (skip && tx.date <= skip) return;
    running.set(accountId, roundMoney((running.get(accountId) ?? 0) + delta));
  };
  apply(tx.accountId, transactionEffectOnAccount(tx, tx.accountId));
  if (tx.toAccountId) {
    apply(tx.toAccountId, transactionEffectOnAccount(tx, tx.toAccountId));
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

export type CashFlowTotals = {
  income: number;
  expenses: number;
  net: number;
};

export function monthTotals(
  transactions: Transaction[],
  month: string,
): CashFlowTotals {
  let income = 0;
  let expenses = 0;
  for (const tx of transactions) {
    if (!inMonth(tx, month)) continue;
    if (tx.type === "income") income += tx.amount;
    if (tx.type === "expense") expenses += tx.amount;
  }
  return { income, expenses, net: income - expenses };
}

export function monthDailyCashFlow(
  transactions: Transaction[],
  month: string,
): ({ date: string } & CashFlowTotals)[] {
  const dates = datesInMonth(month);
  const byDate = new Map(
    dates.map((date) => [date, { income: 0, expenses: 0 }]),
  );
  for (const tx of transactions) {
    if (!inMonth(tx, month)) continue;
    const row = byDate.get(tx.date);
    if (!row) continue;
    if (tx.type === "income") row.income += tx.amount;
    if (tx.type === "expense") row.expenses += tx.amount;
  }
  return dates.map((date) => {
    const row = byDate.get(date) ?? { income: 0, expenses: 0 };
    return {
      date,
      income: row.income,
      expenses: row.expenses,
      net: row.income - row.expenses,
    };
  });
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
