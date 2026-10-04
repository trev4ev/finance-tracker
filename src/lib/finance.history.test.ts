import assert from "node:assert/strict";
import { historicalBalances } from "./finance";
import { normalizeAccount, normalizeTransaction } from "./normalize";
import type { Account, AccountBalance, Transaction } from "./types";

function account(
  input: Pick<Account, "id" | "name" | "type" | "startingBalance"> &
    Partial<Account>,
): Account {
  return normalizeAccount(input);
}

function tx(
  input: Pick<Transaction, "id" | "date" | "amount" | "type" | "accountId"> &
    Partial<Transaction>,
): Transaction {
  return normalizeTransaction({
    description: input.description ?? input.id,
    categoryId: null,
    toAccountId: null,
    notes: "",
    ...input,
  });
}

function snap(
  accountId: string,
  asOf: string,
  current: number,
): AccountBalance {
  return {
    id: `snap-${accountId}-${asOf}`,
    accountId,
    current,
    available: null,
    currency: "USD",
    source: "plaid",
    asOf,
  };
}

function valueOn(
  points: ReturnType<typeof historicalBalances>,
  date: string,
  accountId: string,
): number | undefined {
  const exact = points.find((point) => point.date === date);
  if (exact) return exact.balances[accountId];
  const prior = [...points].reverse().find((point) => point.date <= date);
  return prior?.balances[accountId];
}

const checking = account({
  id: "chk",
  name: "Checking",
  type: "checking",
  startingBalance: 1000,
});

{
  const points = historicalBalances(
    [checking],
    [
      tx({
        id: "e1",
        date: "2026-08-10",
        amount: 100,
        type: "expense",
        accountId: "chk",
      }),
    ],
    "2026-08-01",
    "2026-08-20",
  );
  assert.equal(valueOn(points, "2026-08-01", "chk"), 1000);
  assert.equal(valueOn(points, "2026-08-10", "chk"), 900);
  assert.equal(valueOn(points, "2026-08-20", "chk"), 900);
}

{
  const brokerage = account({
    id: "inv",
    name: "Brokerage",
    type: "investment",
    startingBalance: 0,
  });
  const points = historicalBalances(
    [brokerage],
    [],
    "2026-07-01",
    "2026-09-20",
    [
      snap("inv", "2026-07-15", 10000),
      snap("inv", "2026-08-15", 11000),
      snap("inv", "2026-09-15", 12000),
    ],
  );
  assert.equal(valueOn(points, "2026-07-01", "inv"), 10000);
  assert.equal(valueOn(points, "2026-07-15", "inv"), 10000);
  assert.equal(valueOn(points, "2026-08-15", "inv"), 11000);
  assert.equal(valueOn(points, "2026-09-15", "inv"), 12000);
  assert.equal(valueOn(points, "2026-09-20", "inv"), 12000);
}

{
  const brokerage = account({
    id: "inv",
    name: "Brokerage",
    type: "investment",
    startingBalance: 0,
  });
  const points = historicalBalances(
    [checking, brokerage],
    [
      tx({
        id: "t1",
        date: "2026-08-10",
        amount: 500,
        type: "transfer",
        accountId: "chk",
        toAccountId: "inv",
      }),
    ],
    "2026-07-20",
    "2026-08-20",
    [snap("inv", "2026-08-01", 10000)],
  );
  assert.equal(valueOn(points, "2026-07-20", "inv"), 10000);
  assert.equal(valueOn(points, "2026-08-01", "inv"), 10000);
  assert.equal(valueOn(points, "2026-08-10", "inv"), 10500);
  assert.equal(valueOn(points, "2026-08-20", "inv"), 10500);
}

{
  const linked = account({
    id: "chk-plaid",
    name: "Checking",
    type: "checking",
    startingBalance: 100,
    source: "plaid",
    currentBalance: 80,
  });
  const points = historicalBalances(
    [linked],
    [
      tx({
        id: "e2",
        date: "2026-08-05",
        amount: 40,
        type: "expense",
        accountId: "chk-plaid",
      }),
    ],
    "2026-08-01",
    "2026-08-10",
  );
  assert.equal(valueOn(points, "2026-08-01", "chk-plaid"), 120);
  assert.equal(valueOn(points, "2026-08-05", "chk-plaid"), 80);
  assert.equal(valueOn(points, "2026-08-10", "chk-plaid"), 80);
}

{
  const brokerage = account({
    id: "inv",
    name: "Brokerage",
    type: "investment",
    startingBalance: 0,
    source: "plaid",
    currentBalance: 15000,
    lastSyncedAt: "2026-09-10",
  });
  const points = historicalBalances(
    [brokerage],
    [],
    "2026-07-15",
    "2026-09-15",
    [snap("inv", "2026-08-01", 10000), snap("inv", "2026-09-01", 12000)],
  );
  assert.equal(valueOn(points, "2026-07-15", "inv"), 10000);
  assert.equal(valueOn(points, "2026-08-01", "inv"), 10000);
  assert.equal(valueOn(points, "2026-09-01", "inv"), 12000);
  assert.equal(valueOn(points, "2026-09-10", "inv"), 15000);
  assert.equal(valueOn(points, "2026-09-15", "inv"), 15000);
}

{
  const brokerage = account({
    id: "inv",
    name: "Brokerage",
    type: "investment",
    startingBalance: 0,
  });
  const points = historicalBalances(
    [brokerage],
    [
      tx({
        id: "e3",
        date: "2026-08-10",
        amount: 100,
        type: "expense",
        accountId: "inv",
      }),
    ],
    "2026-08-01",
    "2026-08-12",
    [snap("inv", "2026-08-10", 8000)],
  );
  assert.equal(valueOn(points, "2026-08-01", "inv"), 8000);
  assert.equal(valueOn(points, "2026-08-10", "inv"), 8000);
  assert.equal(valueOn(points, "2026-08-12", "inv"), 8000);
}

console.log("finance.history.test.ts passed");
