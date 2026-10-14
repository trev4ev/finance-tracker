import {
  benefitPeriodEndMonth,
  benefitStatuses,
  type BenefitStatus,
} from "./benefits";
import { daysBetween, daysInMonth, shortMonthLabel } from "./dates";
import type { BenefitRedemption, CardBenefit } from "./types";

export function lastDateOfMonth(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

/** True on the calendar day one week before month-end. */
export function isCreditReminderDay(isoDate: string): boolean {
  const month = isoDate.slice(0, 7);
  return daysBetween(isoDate, lastDateOfMonth(month)) === 7;
}

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function unusedExpiringBenefits(
  benefits: CardBenefit[],
  redemptions: BenefitRedemption[],
  asOf: string,
): BenefitStatus[] {
  const month = asOf.slice(0, 7);
  return benefitStatuses(
    benefits.filter((benefit) => benefit.active),
    redemptions,
    asOf,
  ).filter(
    (row) =>
      !row.used &&
      benefitPeriodEndMonth(row.benefit.frequency, row.periodStart) === month,
  );
}

function amountLabel(amount: number | null): string {
  if (amount == null) return "";
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return ` $${rounded}`;
  return ` $${rounded.toFixed(2)}`;
}

function expiryLabel(isoDate: string): string {
  const day = Number(isoDate.slice(8, 10));
  return `${shortMonthLabel(isoDate.slice(0, 7))} ${day}`;
}

/** SMS body, or null when there is nothing to remind about. */
export function formatCreditReminderSms(
  unused: BenefitStatus[],
  monthEnd: string,
): string | null {
  if (unused.length === 0) return null;
  const until = expiryLabel(monthEnd);
  const named = unused.map(
    (row) => `${row.benefit.name}${amountLabel(row.benefit.expectedAmount)}`,
  );
  const listed = `Ledger: unused credits expire ${until} — ${named.join(", ")}.`;
  if (listed.length <= 300) return listed;
  return `Ledger: ${unused.length} unused credits expire ${until}. Open Ledger to use them.`;
}
