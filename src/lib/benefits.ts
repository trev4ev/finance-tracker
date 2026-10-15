import { addMonths, monthLabel, shortMonthLabel, todayISO } from "./dates";
import type {
  BenefitFrequency,
  BenefitRedemption,
  CardBenefit,
  FinanceState,
  Transaction,
} from "./types";

export const CYCLE_MONTHS: { value: number; label: string }[] = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function padMonth(month: number): string {
  return String(month).padStart(2, "0");
}

function clampCycleMonth(month: number): number {
  if (!Number.isFinite(month)) return 1;
  const rounded = Math.round(month);
  if (rounded < 1 || rounded > 12) return 1;
  return rounded;
}

/** YYYY-MM of the period that contains `date`. */
export function benefitPeriodStart(
  frequency: BenefitFrequency,
  cycleStartMonth: number,
  date: string,
): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const start = clampCycleMonth(cycleStartMonth);

  if (frequency === "monthly") {
    return date.slice(0, 7);
  }

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

export function benefitPeriodEndMonth(
  frequency: BenefitFrequency,
  periodStart: string,
): string {
  if (frequency === "monthly") return periodStart;
  if (frequency === "semiannual") return addMonths(periodStart, 5);
  return addMonths(periodStart, 11);
}

export function benefitPeriodLabel(
  frequency: BenefitFrequency,
  periodStart: string,
): string {
  if (frequency === "monthly") return monthLabel(periodStart);
  const end = benefitPeriodEndMonth(frequency, periodStart);
  const startYear = periodStart.slice(0, 4);
  const endYear = end.slice(0, 4);
  if (frequency === "annual" && periodStart.endsWith("-01") && end.endsWith("-12")) {
    return startYear;
  }
  if (startYear === endYear) {
    return `${shortMonthLabel(periodStart)} – ${shortMonthLabel(end)} ${endYear}`;
  }
  return `${shortMonthLabel(periodStart)} ${startYear} – ${shortMonthLabel(end)} ${endYear}`;
}

export function frequencyLabel(frequency: BenefitFrequency): string {
  if (frequency === "monthly") return "Monthly";
  if (frequency === "semiannual") return "Every 6 months";
  return "Yearly";
}

export type BenefitStatus = {
  benefit: CardBenefit;
  periodStart: string;
  periodLabel: string;
  used: boolean;
  redemptions: BenefitRedemption[];
  redeemedAmount: number;
};

export function benefitStatus(
  benefit: CardBenefit,
  redemptions: BenefitRedemption[],
  asOf = todayISO(),
): BenefitStatus {
  const periodStart = benefitPeriodStart(
    benefit.frequency,
    benefit.cycleStartMonth,
    asOf,
  );
  const periodRedemptions = redemptions.filter(
    (row) => row.benefitId === benefit.id && row.periodStart === periodStart,
  );
  return {
    benefit,
    periodStart,
    periodLabel: benefitPeriodLabel(benefit.frequency, periodStart),
    used: periodRedemptions.length > 0,
    redemptions: periodRedemptions,
    redeemedAmount: periodRedemptions.reduce(
      (sum, row) => sum + (row.amount ?? 0),
      0,
    ),
  };
}

export function benefitStatuses(
  benefits: CardBenefit[],
  redemptions: BenefitRedemption[],
  asOf = todayISO(),
): BenefitStatus[] {
  return benefits.map((benefit) =>
    benefitStatus(benefit, redemptions, asOf),
  );
}

export function redemptionForTransaction(
  redemptions: BenefitRedemption[],
  transactionId: string | null | undefined,
): BenefitRedemption | undefined {
  if (!transactionId) return undefined;
  return redemptions.find((row) => row.transactionId === transactionId);
}

export function creditAccounts(state: Pick<FinanceState, "accounts">) {
  const cards = state.accounts.filter((account) => account.type === "credit");
  return cards.length > 0 ? cards : [...state.accounts];
}

export function benefitsForAccount(
  benefits: CardBenefit[],
  accountId: string,
  includeBenefitId?: string,
): CardBenefit[] {
  return benefits
    .filter(
      (benefit) =>
        benefit.accountId === accountId &&
        (benefit.active || benefit.id === includeBenefitId),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function candidateCreditTransactions(
  state: FinanceState,
  benefit: CardBenefit,
  options?: { includeTransactionId?: string | null },
): Transaction[] {
  const keepId = options?.includeTransactionId ?? null;
  const linkedElsewhere = new Set(
    state.benefitRedemptions
      .filter(
        (row) =>
          row.transactionId &&
          row.transactionId !== keepId &&
          row.benefitId !== benefit.id,
      )
      .map((row) => row.transactionId as string),
  );
  return [...state.transactions]
    .filter((tx) => {
      if (tx.pending) return false;
      if (tx.type !== "income") return false;
      if (tx.accountId !== benefit.accountId) return false;
      if (linkedElsewhere.has(tx.id) && tx.id !== keepId) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 50);
}

export function transactionBenefitName(
  state: Pick<FinanceState, "cardBenefits" | "benefitRedemptions">,
  transactionId: string,
): string | undefined {
  const redemption = redemptionForTransaction(
    state.benefitRedemptions,
    transactionId,
  );
  if (!redemption) return undefined;
  return state.cardBenefits.find((item) => item.id === redemption.benefitId)
    ?.name;
}

export type RedemptionPatch = {
  redemptions: BenefitRedemption[];
  upsert: BenefitRedemption | null;
  removeIds: string[];
};

function removedIds(
  previous: BenefitRedemption[],
  next: BenefitRedemption[],
): string[] {
  const keep = new Set(next.map((row) => row.id));
  return previous.filter((row) => !keep.has(row.id)).map((row) => row.id);
}

export function linkTransactionBenefit(
  state: FinanceState,
  transactionId: string,
  benefitId: string | null,
): RedemptionPatch {
  const previous = state.benefitRedemptions;
  const tx = state.transactions.find((item) => item.id === transactionId);
  const current = previous.find((row) => row.transactionId === transactionId);

  if (!benefitId || !tx) {
    const redemptions = previous.filter(
      (row) => row.transactionId !== transactionId,
    );
    return { redemptions, upsert: null, removeIds: removedIds(previous, redemptions) };
  }

  const benefit = state.cardBenefits.find((item) => item.id === benefitId);
  if (!benefit) {
    const redemptions = previous.filter(
      (row) => row.transactionId !== transactionId,
    );
    return { redemptions, upsert: null, removeIds: removedIds(previous, redemptions) };
  }

  const periodStart = benefitPeriodStart(
    benefit.frequency,
    benefit.cycleStartMonth,
    tx.date,
  );

  if (current && current.benefitId === benefitId) {
    const upsert: BenefitRedemption = {
      ...current,
      periodStart,
      usedOn: tx.date,
      amount: tx.amount,
    };
    const redemptions = previous.map((row) =>
      row.id === current.id ? upsert : row,
    );
    return { redemptions, upsert, removeIds: [] };
  }

  let redemptions = previous.filter((row) => row.transactionId !== transactionId);
  const attach = redemptions.find(
    (row) =>
      row.benefitId === benefitId &&
      row.periodStart === periodStart &&
      !row.transactionId,
  );
  if (attach) {
    const upsert: BenefitRedemption = {
      ...attach,
      transactionId,
      usedOn: tx.date,
      amount: tx.amount,
    };
    redemptions = redemptions.map((row) => (row.id === attach.id ? upsert : row));
    return {
      redemptions,
      upsert,
      removeIds: removedIds(previous, redemptions),
    };
  }

  const upsert: BenefitRedemption = {
    id: crypto.randomUUID(),
    benefitId,
    periodStart,
    usedOn: tx.date,
    transactionId,
    amount: tx.amount,
    notes: "",
  };
  redemptions = [...redemptions, upsert];
  return {
    redemptions,
    upsert,
    removeIds: removedIds(previous, redemptions),
  };
}

export function upsertPeriodRedemption(
  state: FinanceState,
  input: {
    benefitId: string;
    usedOn: string;
    transactionId: string | null;
    amount: number | null;
    notes: string;
  },
): RedemptionPatch {
  const previous = state.benefitRedemptions;
  const benefit = state.cardBenefits.find((item) => item.id === input.benefitId);
  if (!benefit) {
    return { redemptions: previous, upsert: null, removeIds: [] };
  }
  const periodStart = benefitPeriodStart(
    benefit.frequency,
    benefit.cycleStartMonth,
    input.usedOn,
  );

  let redemptions = previous;
  if (input.transactionId) {
    redemptions = previous.filter(
      (row) =>
        row.transactionId !== input.transactionId ||
        (row.benefitId === input.benefitId && row.periodStart === periodStart),
    );
  }

  const existing = redemptions.find(
    (row) => row.benefitId === input.benefitId && row.periodStart === periodStart,
  );
  const upsert: BenefitRedemption = existing
    ? {
        ...existing,
        usedOn: input.usedOn,
        transactionId: input.transactionId,
        amount: input.amount,
        notes: input.notes,
      }
    : {
        id: crypto.randomUUID(),
        benefitId: input.benefitId,
        periodStart,
        usedOn: input.usedOn,
        transactionId: input.transactionId,
        amount: input.amount,
        notes: input.notes,
      };

  redemptions = existing
    ? redemptions.map((row) => (row.id === existing.id ? upsert : row))
    : [...redemptions, upsert];

  return {
    redemptions,
    upsert,
    removeIds: removedIds(previous, redemptions),
  };
}

export function clearPeriodRedemptions(
  state: FinanceState,
  benefitId: string,
  periodStart: string,
): RedemptionPatch {
  const redemptions = state.benefitRedemptions.filter(
    (row) => !(row.benefitId === benefitId && row.periodStart === periodStart),
  );
  return {
    redemptions,
    upsert: null,
    removeIds: removedIds(state.benefitRedemptions, redemptions),
  };
}

