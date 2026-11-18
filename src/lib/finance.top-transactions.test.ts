import assert from "node:assert/strict";
import { topTransactionsForMonth } from "./finance";
import { normalizeTransaction } from "./normalize";
import type { Transaction } from "./types";

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

const grocery = tx({
  id: "tx-groc",
  date: "2026-11-12",
  amount: 84.5,
  type: "expense",
  accountId: "acc-1",
  categoryId: "cat-groc",
});
const rent = tx({
  id: "tx-rent",
  date: "2026-11-01",
  amount: 2200,
  type: "expense",
  accountId: "acc-1",
  categoryId: "cat-rent",
});
const salary = tx({
  id: "tx-pay",
  date: "2026-11-15",
  amount: 4200,
  type: "income",
  accountId: "acc-1",
  categoryId: "cat-salary",
});
const transfer = tx({
  id: "tx-move",
  date: "2026-11-10",
  amount: 500,
  type: "transfer",
  accountId: "acc-1",
  toAccountId: "acc-2",
});
const lastMonth = tx({
  id: "tx-old",
  date: "2026-10-31",
  amount: 9000,
  type: "expense",
  accountId: "acc-1",
  categoryId: "cat-groc",
});
const diningA = tx({
  id: "tx-dine-a",
  date: "2026-11-20",
  amount: 40,
  type: "expense",
  accountId: "acc-1",
  categoryId: "cat-dine",
});
const diningB = tx({
  id: "tx-dine-b",
  date: "2026-11-08",
  amount: 40,
  type: "expense",
  accountId: "acc-1",
  categoryId: "cat-dine",
});

const ranked = topTransactionsForMonth(
  [grocery, rent, salary, transfer, lastMonth, diningA, diningB],
  "2026-11",
);

assert.deepEqual(
  ranked.map((item) => item.id),
  ["tx-rent", "tx-groc", "tx-dine-a", "tx-dine-b"],
);
assert.equal(topTransactionsForMonth([], "2026-11").length, 0);
assert.equal(topTransactionsForMonth([lastMonth], "2026-11").length, 0);
console.log("finance.top-transactions.test.ts passed");
