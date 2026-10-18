import assert from "node:assert/strict";
import { needsReview } from "./finance";
import { normalizeTransaction } from "./normalize";
import { reviewedForPlaidWrite } from "../../supabase/functions/_shared/plaid-review.ts";

const base = {
  date: "2026-10-01",
  description: "Coffee",
  amount: 5,
  type: "expense" as const,
  accountId: "acc",
  categoryId: null,
  toAccountId: null,
  notes: "",
};

{
  const unseen = normalizeTransaction({
    id: "a",
    ...base,
    reviewed: false,
  });
  assert.equal(needsReview(unseen), true);
}

{
  const seen = normalizeTransaction({ id: "b", ...base, reviewed: true });
  assert.equal(needsReview(seen), false);
}

{
  const pending = normalizeTransaction({
    id: "c",
    ...base,
    pending: true,
    reviewed: false,
  });
  assert.equal(needsReview(pending), false);
}

{
  const legacy = normalizeTransaction({ id: "d", ...base });
  assert.equal(legacy.reviewed, true);
  assert.equal(needsReview(legacy), false);
}

{
  const transfer = normalizeTransaction({
    id: "e",
    ...base,
    type: "transfer",
    description: "AUTOMATIC PAYMENT - THANK",
    reviewed: false,
  });
  assert.equal(needsReview(transfer), false);
}

assert.equal(reviewedForPlaidWrite("transfer", false, undefined), true);
assert.equal(reviewedForPlaidWrite("transfer", true, false), true);
assert.equal(reviewedForPlaidWrite("expense", false, undefined), false);
assert.equal(reviewedForPlaidWrite("expense", false, true), true);
assert.equal(reviewedForPlaidWrite("expense", true, true), false);
assert.equal(reviewedForPlaidWrite("income", true, true), false);
assert.equal(reviewedForPlaidWrite("income", false, undefined), false);

console.log("review.test.ts passed");
