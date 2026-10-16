import assert from "node:assert/strict";
import {
  benefitPeriodEndMonth,
  benefitPeriodLabel,
  benefitPeriodStart,
  frequencyLabel,
} from "./benefits";

assert.equal(benefitPeriodStart("quarterly", 1, "2026-01-01"), "2026-01");
assert.equal(benefitPeriodStart("quarterly", 1, "2026-03-31"), "2026-01");
assert.equal(benefitPeriodStart("quarterly", 1, "2026-04-01"), "2026-04");
assert.equal(benefitPeriodStart("quarterly", 1, "2026-10-16"), "2026-10");
assert.equal(benefitPeriodStart("quarterly", 1, "2026-12-31"), "2026-10");
assert.equal(benefitPeriodEndMonth("quarterly", "2026-10"), "2026-12");
assert.equal(
  benefitPeriodLabel("quarterly", "2026-10"),
  "Oct – Dec 2026",
);
assert.equal(frequencyLabel("quarterly"), "Quarterly");

assert.equal(benefitPeriodStart("semiannual", 1, "2026-06-30"), "2026-01");
assert.equal(benefitPeriodStart("semiannual", 1, "2026-07-01"), "2026-07");
assert.equal(benefitPeriodStart("annual", 1, "2026-10-16"), "2026-01");
assert.equal(benefitPeriodStart("monthly", 1, "2026-10-16"), "2026-10");
