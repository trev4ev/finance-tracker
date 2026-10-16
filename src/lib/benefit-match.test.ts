import assert from "node:assert/strict";
import { suggestBenefit } from "./benefit-match";
import { normalizeCardBenefit, normalizeTransaction } from "./normalize";
import type { BenefitRedemption, CardBenefit, FinanceState } from "./types";

function benefit(
  input: Pick<CardBenefit, "id" | "name"> & Partial<CardBenefit>,
): CardBenefit {
  return normalizeCardBenefit({
    accountId: "acc-csr",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "",
    active: true,
    ...input,
  });
}

function state(
  benefits: CardBenefit[],
  redemptions: BenefitRedemption[] = [],
): Pick<FinanceState, "cardBenefits" | "benefitRedemptions"> {
  return { cardBenefits: benefits, benefitRedemptions: redemptions };
}

const grocery = benefit({ id: "ben-dd-groc", name: "DoorDash grocery" });
const grocery2 = benefit({
  id: "ben-dd-groc-2",
  name: "DoorDash grocery (2nd)",
});
const restaurant = benefit({
  id: "ben-dd-rest",
  name: "DoorDash restaurant",
  expectedAmount: 5,
});
const lyft = benefit({ id: "ben-lyft", name: "Lyft" });
const uber = benefit({
  id: "ben-uber",
  name: "Uber Cash",
  accountId: "acc-gold",
});
const travel = benefit({
  id: "ben-travel",
  name: "Travel",
  frequency: "annual",
  expectedAmount: 300,
});

{
  const tx = normalizeTransaction({
    id: "tx-dd",
    date: "2026-10-08",
    description: "DOORDASH*HELP",
    amount: 28.4,
    type: "expense",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: null,
    notes: "",
    merchantName: "DoorDash",
  });
  assert.equal(
    suggestBenefit(state([grocery, grocery2, restaurant, lyft]), tx)?.id,
    grocery.id,
  );
}

{
  const used: BenefitRedemption = {
    id: "red-1",
    benefitId: grocery.id,
    periodStart: "2026-10",
    usedOn: "2026-10-02",
    transactionId: "other",
    amount: 10,
    notes: "",
  };
  const tx = normalizeTransaction({
    id: "tx-dd-2",
    date: "2026-10-12",
    description: "DoorDash",
    amount: 19,
    type: "expense",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: null,
    notes: "",
    merchantName: "DoorDash",
  });
  assert.equal(
    suggestBenefit(state([grocery, grocery2, restaurant], [used]), tx)?.id,
    grocery2.id,
  );
}

{
  const credit = normalizeTransaction({
    id: "tx-credit",
    date: "2026-10-09",
    description: "DoorDash credit",
    amount: 5,
    type: "income",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: null,
    notes: "",
    merchantName: "DoorDash",
  });
  assert.equal(
    suggestBenefit(state([grocery, restaurant]), credit)?.id,
    restaurant.id,
  );
}

{
  const ten = normalizeTransaction({
    id: "tx-10",
    date: "2026-10-09",
    description: "DOORDASH PROMO",
    amount: 10,
    type: "income",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: null,
    notes: "",
  });
  assert.equal(
    suggestBenefit(state([grocery, restaurant]), ten)?.id,
    grocery.id,
  );
}

{
  const ride = normalizeTransaction({
    id: "tx-uber",
    date: "2026-10-04",
    description: "UBER *TRIP",
    amount: 18.2,
    type: "expense",
    accountId: "acc-gold",
    categoryId: null,
    toAccountId: null,
    notes: "",
    merchantName: "Uber",
  });
  assert.equal(suggestBenefit(state([uber, lyft]), ride)?.id, uber.id);
  const onOtherCard = { ...ride, accountId: "acc-csr" };
  assert.equal(suggestBenefit(state([uber, lyft]), onOtherCard), null);
}

{
  const pending = normalizeTransaction({
    id: "tx-pending",
    date: "2026-10-04",
    description: "Lyft",
    amount: 12,
    type: "expense",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: null,
    notes: "",
    pending: true,
    merchantName: "Lyft",
  });
  assert.equal(suggestBenefit(state([lyft]), pending), null);
}

{
  const transfer = normalizeTransaction({
    id: "tx-xfer",
    date: "2026-10-04",
    description: "Lyft",
    amount: 12,
    type: "transfer",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: "acc-checking",
    notes: "",
  });
  assert.equal(suggestBenefit(state([lyft]), transfer), null);
}

{
  const airline = normalizeTransaction({
    id: "tx-air",
    date: "2026-10-04",
    description: "United Airlines",
    amount: 240,
    type: "expense",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: null,
    notes: "",
  });
  assert.equal(suggestBenefit(state([travel, lyft]), airline), null);
}

{
  const linked = normalizeTransaction({
    id: "tx-linked",
    date: "2026-10-04",
    description: "Lyft",
    amount: 12,
    type: "expense",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: null,
    notes: "",
    merchantName: "Lyft",
  });
  const redemption: BenefitRedemption = {
    id: "red-lyft",
    benefitId: lyft.id,
    periodStart: "2026-10",
    usedOn: linked.date,
    transactionId: linked.id,
    amount: linked.amount,
    notes: "",
  };
  assert.equal(suggestBenefit(state([lyft], [redemption]), linked), null);
}

{
  const inactive = benefit({
    id: "ben-lyft-off",
    name: "Lyft",
    active: false,
  });
  const tx = normalizeTransaction({
    id: "tx-lyft",
    date: "2026-10-04",
    description: "Lyft",
    amount: 9,
    type: "expense",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: null,
    notes: "",
  });
  assert.equal(suggestBenefit(state([inactive]), tx), null);
}

console.log("benefit-match.test.ts passed");
