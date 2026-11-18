import assert from "node:assert/strict";
import {
  benefitStatus,
  linkTransactionBenefit,
  upsertPeriodRedemption,
} from "./benefits";
import {
  normalizeBenefitRedemption,
  normalizeCardBenefit,
  normalizeState,
  normalizeTransaction,
} from "./normalize";
import type { CardBenefit, FinanceState } from "./types";

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

const grocery = benefit({ id: "ben-dd", name: "DoorDash grocery" });

function ledger(extra: Partial<FinanceState> = {}): FinanceState {
  return normalizeState({
    accounts: [
      {
        id: "acc-csr",
        name: "CSR",
        type: "credit",
        startingBalance: 0,
      },
    ],
    categories: [],
    transactions: extra.transactions ?? [],
    cardBenefits: [grocery],
    benefitRedemptions: extra.benefitRedemptions ?? [],
  });
}

{
  const unused = benefitStatus(grocery, [], "2026-10-12");
  assert.equal(unused.usage, "available");
  assert.equal(unused.used, false);
}

{
  const inProgress = benefitStatus(
    grocery,
    [
      {
        id: "red",
        benefitId: grocery.id,
        periodStart: "2026-10",
        usedOn: "2026-10-04",
        transactionId: null,
        amount: 10,
        notes: "",
        status: "in_progress",
      },
    ],
    "2026-10-12",
  );
  assert.equal(inProgress.usage, "in_progress");
  assert.equal(inProgress.used, true);
}

{
  const used = benefitStatus(
    grocery,
    [
      {
        id: "red",
        benefitId: grocery.id,
        periodStart: "2026-10",
        usedOn: "2026-10-04",
        transactionId: null,
        amount: 10,
        notes: "",
        status: "used",
      },
    ],
    "2026-10-12",
  );
  assert.equal(used.usage, "used");
}

{
  const purchase = normalizeTransaction({
    id: "tx-purchase",
    date: "2026-10-04",
    description: "DoorDash",
    amount: 22,
    type: "expense",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: null,
    notes: "",
  });
  const patch = linkTransactionBenefit(
    ledger({ transactions: [purchase] }),
    purchase.id,
    grocery.id,
  );
  assert.equal(patch.upsert?.status, "in_progress");
  assert.equal(patch.upsert?.transactionId, purchase.id);
}

{
  const credit = normalizeTransaction({
    id: "tx-credit",
    date: "2026-10-09",
    description: "DoorDash credit",
    amount: 10,
    type: "income",
    accountId: "acc-csr",
    categoryId: null,
    toAccountId: null,
    notes: "",
  });
  const pendingState = ledger({
    transactions: [credit],
    benefitRedemptions: [
      {
        id: "red-pending",
        benefitId: grocery.id,
        periodStart: "2026-10",
        usedOn: "2026-10-04",
        transactionId: null,
        amount: 10,
        notes: "",
        status: "in_progress",
      },
    ],
  });
  const patch = linkTransactionBenefit(pendingState, credit.id, grocery.id);
  assert.equal(patch.upsert?.id, "red-pending");
  assert.equal(patch.upsert?.status, "used");
  assert.equal(patch.upsert?.transactionId, credit.id);
}

{
  const patch = upsertPeriodRedemption(ledger(), {
    benefitId: grocery.id,
    usedOn: "2026-10-05",
    transactionId: null,
    amount: 10,
    notes: "ordered",
    status: "in_progress",
  });
  assert.equal(patch.upsert?.status, "in_progress");
  assert.equal(patch.upsert?.notes, "ordered");
}

{
  const existing = ledger({
    benefitRedemptions: [
      {
        id: "red",
        benefitId: grocery.id,
        periodStart: "2026-10",
        usedOn: "2026-10-04",
        transactionId: null,
        amount: 10,
        notes: "",
        status: "in_progress",
      },
    ],
  });
  const patch = upsertPeriodRedemption(existing, {
    benefitId: grocery.id,
    usedOn: "2026-10-09",
    transactionId: null,
    amount: 10,
    notes: "",
    status: "used",
  });
  assert.equal(patch.upsert?.id, "red");
  assert.equal(patch.upsert?.status, "used");
}

{
  const legacy = normalizeBenefitRedemption({
    id: "red-legacy",
    benefitId: grocery.id,
    periodStart: "2026-10",
    usedOn: "2026-10-01",
    transactionId: null,
    amount: 10,
    notes: "",
  });
  assert.equal(legacy.status, "used");
}

console.log("benefits.status.test.ts passed");
