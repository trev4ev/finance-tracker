import assert from "node:assert/strict";
import { normalizeCardBenefit } from "./normalize";
import {
  formatCreditReminderEmail,
  isCreditReminderDay,
  lastDateOfMonth,
  unusedExpiringBenefits,
} from "./reminders";
import type { BenefitRedemption, CardBenefit } from "./types";

{
  assert.equal(lastDateOfMonth("2026-10"), "2026-10-31");
  assert.equal(lastDateOfMonth("2026-02"), "2026-02-28");
  assert.equal(lastDateOfMonth("2028-02"), "2028-02-29");
}

{
  assert.equal(isCreditReminderDay("2026-10-24"), true);
  assert.equal(isCreditReminderDay("2026-10-23"), false);
  assert.equal(isCreditReminderDay("2026-10-31"), false);
  assert.equal(isCreditReminderDay("2026-09-23"), true);
  assert.equal(isCreditReminderDay("2026-02-21"), true);
  assert.equal(isCreditReminderDay("2028-02-22"), true);
}

function benefit(
  input: Pick<CardBenefit, "id" | "name" | "frequency"> & Partial<CardBenefit>,
): CardBenefit {
  return normalizeCardBenefit({
    accountId: "acc",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "",
    active: true,
    ...input,
  });
}

const monthly = benefit({
  id: "ben-dd",
  name: "DoorDash grocery",
  frequency: "monthly",
});
const lyft = benefit({ id: "ben-lyft", name: "Lyft", frequency: "monthly" });
const travel = benefit({
  id: "ben-travel",
  name: "Travel",
  frequency: "annual",
  expectedAmount: 300,
});
const stubhub = benefit({
  id: "ben-stub",
  name: "StubHub / viagogo",
  frequency: "semiannual",
  expectedAmount: 150,
});

{
  const asOf = "2026-10-24";
  const unused = unusedExpiringBenefits(
    [monthly, lyft, travel, stubhub],
    [],
    asOf,
  );
  assert.deepEqual(
    unused.map((row) => row.benefit.id).sort(),
    [monthly.id, lyft.id].sort(),
  );
}

{
  const used: BenefitRedemption = {
    id: "red",
    benefitId: monthly.id,
    periodStart: "2026-10",
    usedOn: "2026-10-02",
    transactionId: null,
    amount: 10,
    notes: "",
  };
  const unused = unusedExpiringBenefits([monthly, lyft], [used], "2026-10-24");
  assert.deepEqual(
    unused.map((row) => row.benefit.id),
    [lyft.id],
  );
}

{
  const december = unusedExpiringBenefits([travel], [], "2026-12-24");
  assert.equal(december.length, 1);
  assert.equal(december[0]?.benefit.id, travel.id);
}

{
  const june = unusedExpiringBenefits([stubhub], [], "2026-06-23");
  assert.equal(june.length, 1);
  const january = unusedExpiringBenefits([stubhub], [], "2026-01-24");
  assert.equal(january.length, 0);
}

{
  const unused = unusedExpiringBenefits([monthly, lyft], [], "2026-10-24");
  const email = formatCreditReminderEmail(
    unused.map((row) => ({
      name: row.benefit.name,
      expectedAmount: row.benefit.expectedAmount,
    })),
    "2026-10-31",
  );
  assert.equal(email?.subject, "Unused credits expire Oct 31");
  assert.match(email?.text ?? "", /DoorDash grocery — \$10/);
  assert.match(email?.text ?? "", /Lyft — \$10/);
  assert.match(email?.html ?? "", /<li>DoorDash grocery — \$10<\/li>/);
  assert.equal(formatCreditReminderEmail([], "2026-10-31"), null);
}

console.log("reminders.test.ts passed");
