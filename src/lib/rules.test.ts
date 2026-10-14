import assert from "node:assert/strict";
import { normalizeTransaction } from "./normalize";
import {
  applyCategoryRule,
  merchantKey,
  shouldPromptCategoryRule,
  similarTransactions,
  transactionMerchantKey,
} from "./rules";
import type { Category, CategoryRule } from "./types";

const dining: Category = {
  id: "cat-dining",
  name: "Dining",
  kind: "expense",
  color: "#f97316",
};
const groceries: Category = {
  id: "cat-groceries",
  name: "Groceries",
  kind: "expense",
  color: "#fbbf24",
};

function tx(
  id: string,
  description: string,
  extra: Partial<ReturnType<typeof normalizeTransaction>> = {},
) {
  return normalizeTransaction({
    id,
    date: "2026-10-01",
    description,
    amount: 12,
    type: "expense",
    accountId: "acc",
    categoryId: dining.id,
    toAccountId: null,
    notes: "",
    ...extra,
  });
}

{
  assert.equal(merchantKey("DoorDash", "DOORDASH*HELP"), "doordash");
  assert.equal(merchantKey(null, "  Lyft  "), "lyft");
  assert.equal(merchantKey("  ", "Starbucks"), "starbucks");
  assert.equal(transactionMerchantKey(tx("a", "Coffee", { merchantName: "Starbucks" })), "starbucks");
}

{
  const rows = [
    tx("a", "DoorDash", { merchantName: "DoorDash", categoryId: dining.id }),
    tx("b", "DOORDASH*HELP", { merchantName: "DoorDash", categoryId: null }),
    tx("c", "Uber", { merchantName: "Uber" }),
    tx("d", "DoorDash", { merchantName: "DoorDash", pending: true }),
    tx("e", "DoorDash refund", {
      merchantName: "DoorDash",
      type: "income",
      categoryId: null,
    }),
  ];
  const similar = similarTransactions(rows, rows[0]!);
  assert.deepEqual(
    similar.map((item) => item.id),
    ["b"],
  );
}

{
  const rows = [
    tx("a", "DoorDash", { merchantName: "DoorDash", categoryId: dining.id }),
    tx("b", "DoorDash", { merchantName: "DoorDash", categoryId: dining.id }),
  ];
  const next = applyCategoryRule(rows, [dining, groceries], "doordash", groceries.id);
  assert.equal(next[0]?.categoryId, groceries.id);
  assert.equal(next[1]?.categoryId, groceries.id);
}

{
  const rules: CategoryRule[] = [
    { id: "r1", merchantKey: "doordash", categoryId: dining.id },
  ];
  assert.equal(
    shouldPromptCategoryRule(rules, {
      type: "expense",
      merchantName: "DoorDash",
      description: "DoorDash",
      categoryId: dining.id,
    }),
    false,
  );
  assert.equal(
    shouldPromptCategoryRule(rules, {
      type: "expense",
      merchantName: "DoorDash",
      description: "DoorDash",
      categoryId: groceries.id,
    }),
    true,
  );
  assert.equal(
    shouldPromptCategoryRule(rules, {
      type: "expense",
      merchantName: "Starbucks",
      description: "Coffee",
      categoryId: dining.id,
    }),
    true,
  );
  assert.equal(
    shouldPromptCategoryRule([], {
      type: "transfer",
      merchantName: "Chase",
      description: "Payment",
      categoryId: dining.id,
    }),
    false,
  );
}

console.log("rules.test.ts passed");
