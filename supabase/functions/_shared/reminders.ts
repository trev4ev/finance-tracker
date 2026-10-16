export type ReminderFrequency = "monthly" | "semiannual" | "annual";

export type ReminderBenefit = {
  id: string;
  name: string;
  frequency: ReminderFrequency;
  expectedAmount: number | null;
  cycleStartMonth: number;
  active: boolean;
};

export type ReminderRedemption = {
  benefitId: string;
  periodStart: string;
};

function padMonth(month: number): string {
  return String(month).padStart(2, "0");
}

function clampCycleMonth(month: number): number {
  if (!Number.isFinite(month)) return 1;
  const rounded = Math.round(month);
  if (rounded < 1 || rounded > 12) return 1;
  return rounded;
}

function addMonths(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}`;
}

function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(year, m, 0).getDate();
}

export function lastDateOfMonth(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function isCreditReminderDay(isoDate: string): boolean {
  const month = isoDate.slice(0, 7);
  const day = Number(isoDate.slice(8, 10));
  return daysInMonth(month) - day === 7;
}

function benefitPeriodStart(
  frequency: ReminderFrequency,
  cycleStartMonth: number,
  date: string,
): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const start = clampCycleMonth(cycleStartMonth);
  if (frequency === "monthly") return date.slice(0, 7);
  if (frequency === "annual") {
    if (month >= start) return `${year}-${padMonth(start)}`;
    return `${year - 1}-${padMonth(start)}`;
  }
  const monthIndex = year * 12 + (month - 1);
  const origin = 2000 * 12 + (start - 1);
  const periodIndex = Math.floor((monthIndex - origin) / 6);
  const periodMonthIndex = origin + periodIndex * 6;
  const periodYear = Math.floor(periodMonthIndex / 12);
  const periodMonth = (periodMonthIndex % 12) + 1;
  return `${periodYear}-${padMonth(periodMonth)}`;
}

function benefitPeriodEndMonth(
  frequency: ReminderFrequency,
  periodStart: string,
): string {
  if (frequency === "monthly") return periodStart;
  if (frequency === "semiannual") return addMonths(periodStart, 5);
  return addMonths(periodStart, 11);
}

export type UnusedCredit = {
  name: string;
  expectedAmount: number | null;
};

export function unusedExpiringCredits(
  benefits: ReminderBenefit[],
  redemptions: ReminderRedemption[],
  asOf: string,
): UnusedCredit[] {
  const month = asOf.slice(0, 7);
  const unused: UnusedCredit[] = [];
  for (const benefit of benefits) {
    if (!benefit.active) continue;
    const periodStart = benefitPeriodStart(
      benefit.frequency,
      benefit.cycleStartMonth,
      asOf,
    );
    if (benefitPeriodEndMonth(benefit.frequency, periodStart) !== month) {
      continue;
    }
    const used = redemptions.some(
      (row) => row.benefitId === benefit.id && row.periodStart === periodStart,
    );
    if (used) continue;
    unused.push({
      name: benefit.name,
      expectedAmount: benefit.expectedAmount,
    });
  }
  return unused;
}

function amountLabel(amount: number | null): string {
  if (amount == null) return "";
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return `$${rounded}`;
  return `$${rounded.toFixed(2)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function expiryLabel(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  return `${MONTHS[month - 1] ?? isoDate.slice(5, 7)} ${day}`;
}

export type ReminderEmail = {
  subject: string;
  text: string;
  html: string;
};

export function formatCreditReminderEmail(
  unused: UnusedCredit[],
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

export function todayISO(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
