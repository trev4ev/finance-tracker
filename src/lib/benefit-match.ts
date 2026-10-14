import {
  benefitStatus,
  redemptionForTransaction,
} from "./benefits";
import { catalogMatchersForName } from "./card-benefit-catalog";
import type {
  CardBenefit,
  FinanceState,
  Transaction,
  TransactionType,
} from "./types";

export type BenefitMatchInput = {
  id?: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  pending?: boolean;
  merchantName?: string | null;
};

const AMOUNT_TOLERANCE = 1;

function haystack(tx: BenefitMatchInput): string {
  return `${tx.merchantName ?? ""} ${tx.description}`.toLowerCase();
}

function matchesKeywords(text: string, matchers: string[]): boolean {
  return matchers.some((matcher) => matcher.length > 0 && text.includes(matcher));
}

function amountNearExpected(
  amount: number,
  expected: number | null,
): boolean {
  if (expected == null) return false;
  return Math.abs(amount - expected) <= AMOUNT_TOLERANCE;
}

function unusedOnAccount(
  state: Pick<FinanceState, "cardBenefits" | "benefitRedemptions">,
  accountId: string,
  asOf: string,
  ignoreTransactionId?: string,
): CardBenefit[] {
  const redemptions = ignoreTransactionId
    ? state.benefitRedemptions.filter(
        (row) => row.transactionId !== ignoreTransactionId,
      )
    : state.benefitRedemptions;
  return state.cardBenefits.filter((benefit) => {
    if (benefit.accountId !== accountId || !benefit.active) return false;
    if (catalogMatchersForName(benefit.name).length === 0) return false;
    return !benefitStatus(benefit, redemptions, asOf).used;
  });
}

/**
 * Best unused catalog-matched benefit for this charge or statement credit.
 * Never auto-links — callers should prompt before writing a redemption.
 */
export function suggestBenefit(
  state: Pick<FinanceState, "cardBenefits" | "benefitRedemptions">,
  tx: BenefitMatchInput,
): CardBenefit | null {
  if (tx.pending) return null;
  if (tx.type === "transfer") return null;
  if (!tx.accountId) return null;
  if (tx.id && redemptionForTransaction(state.benefitRedemptions, tx.id)) {
    return null;
  }

  const text = haystack(tx);
  const matching = unusedOnAccount(
    state,
    tx.accountId,
    tx.date,
    tx.id,
  ).filter((benefit) =>
    matchesKeywords(text, catalogMatchersForName(benefit.name)),
  );
  if (matching.length === 0) return null;

  if (tx.type === "income") {
    const near = matching.filter((benefit) =>
      amountNearExpected(tx.amount, benefit.expectedAmount),
    );
    if (near.length > 0) return near[0] ?? null;
  }

  return matching[0] ?? null;
}

export function suggestedBenefitName(
  state: Pick<FinanceState, "cardBenefits" | "benefitRedemptions">,
  tx: Pick<
    Transaction,
    | "id"
    | "date"
    | "description"
    | "amount"
    | "type"
    | "accountId"
    | "pending"
    | "merchantName"
  >,
): string | undefined {
  return suggestBenefit(state, tx)?.name;
}
