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
  if (Number.isInteger(rounded)) return `$${rounded}`;
  return `$${rounded.toFixed(2)}`;
}

function expiryLabel(isoDate: string): string {
  const day = Number(isoDate.slice(8, 10));
  return `${shortMonthLabel(isoDate.slice(0, 7))} ${day}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type ReminderEmail = {
  subject: string;
  text: string;
  html: string;
};

/** Email body, or null when there is nothing to remind about. */
export function formatCreditReminderEmail(
  unused: Array<{ name: string; expectedAmount: number | null }>,
  monthEnd: string,
): ReminderEmail | null {
  if (unused.length === 0) return null;
  const until = expiryLabel(monthEnd);
  const lines = unused.map((row) => {
    const amount = amountLabel(row.expectedAmount);
    return amount ? `${row.name} — ${amount}` : row.name;
  });
  const subject = `Unused credits expire ${until}`;
  const text = `These unused credits expire ${until}:\n\n${lines
    .map((line) => `• ${line}`)
    .join("\n")}\n\nMark them used in Ledger when you spend them.`;
  const items = unused
    .map((row) => {
      const amount = amountLabel(row.expectedAmount);
      const label = amount
        ? `${escapeHtml(row.name)} — ${escapeHtml(amount)}`
        : escapeHtml(row.name);
      return `<li>${label}</li>`;
    })
    .join("");
  const html = `<p>These unused credits expire <strong>${escapeHtml(until)}</strong>:</p><ul>${items}</ul><p>Mark them used in Ledger when you spend them.</p>`;
  return { subject, text, html };
}

export function testReminderEmail(): ReminderEmail {
  return {
    subject: "Ledger credit reminder",
    text: "No unused credits expire this month.",
    html: "<p>No unused credits expire this month.</p>",
  };
}
