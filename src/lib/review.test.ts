import assert from "node:assert/strict";
import { needsReview } from "./finance";
import { normalizeTransaction } from "./normalize";

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

console.log("review.test.ts passed");
