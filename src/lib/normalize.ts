import type {
  Account,
  AccountBalance,
  BenefitRedemption,
  CardBenefit,
  DataSource,
  FinanceState,
  PlaidItem,
  Transaction,
  TransactionInput,
} from "./types";

const ACCOUNT_DEFAULTS = {
  currentBalance: null as number | null,
  availableBalance: null as number | null,
  currency: "USD",
  source: "manual" as DataSource,
  plaidAccountId: null as string | null,
  plaidItemId: null as string | null,
  institutionName: null as string | null,
  mask: null as string | null,
  lastSyncedAt: null as string | null,
};

const TRANSACTION_DEFAULTS = {
  source: "manual" as DataSource,
  plaidTransactionId: null as string | null,
  pending: false,
  merchantName: null as string | null,
  plaidCategory: null as string | null,
};

const BENEFIT_DEFAULTS = {
  expectedAmount: null as number | null,
  cycleStartMonth: 1,
  notes: "",
  active: true,
};

export function normalizeAccount(
  account: Pick<Account, "id" | "name" | "type" | "startingBalance"> &
    Partial<Account>,
): Account {
  return { ...ACCOUNT_DEFAULTS, ...account };
}

export function normalizeTransaction(
  tx: TransactionInput & { id: string },
): Transaction {
  const merged = { ...TRANSACTION_DEFAULTS, ...tx };
  return {
    ...merged,
    originalAmount: merged.originalAmount ?? merged.amount,
  };
}

export function normalizeCardBenefit(
  benefit: Pick<CardBenefit, "id" | "accountId" | "name" | "frequency"> &
    Partial<CardBenefit>,
): CardBenefit {
  const cycle = Number(benefit.cycleStartMonth ?? BENEFIT_DEFAULTS.cycleStartMonth);
  return {
    ...BENEFIT_DEFAULTS,
    ...benefit,
    cycleStartMonth:
      Number.isFinite(cycle) && cycle >= 1 && cycle <= 12 ? Math.round(cycle) : 1,
    expectedAmount:
      benefit.expectedAmount === undefined
        ? BENEFIT_DEFAULTS.expectedAmount
        : benefit.expectedAmount,
    notes: benefit.notes ?? "",
    active: benefit.active ?? true,
  };
}

export function normalizeBenefitRedemption(
  row: BenefitRedemption,
): BenefitRedemption {
  return {
    ...row,
    transactionId: row.transactionId ?? null,
    amount: row.amount ?? null,
    notes: row.notes ?? "",
  };
}

export function normalizeAccountBalance(row: AccountBalance): AccountBalance {
  return {
    id: row.id,
    accountId: row.accountId,
    current: row.current,
    available: row.available,
    currency: row.currency || "USD",
    source: row.source ?? "plaid",
    asOf: row.asOf,
  };
}

export function normalizeState(state: {
  accounts:
    | Account[]
    | Array<Pick<Account, "id" | "name" | "type" | "startingBalance"> & Partial<Account>>;
  categories: FinanceState["categories"];
  transactions: Transaction[] | Array<TransactionInput & { id: string }>;
  cardBenefits?: Array<
    Pick<CardBenefit, "id" | "accountId" | "name" | "frequency"> & Partial<CardBenefit>
  >;
  benefitRedemptions?: BenefitRedemption[];
  plaidItems?: PlaidItem[];
  accountBalances?: AccountBalance[];
}): FinanceState {
  return {
    accounts: state.accounts.map(normalizeAccount),
    categories: state.categories,
    transactions: state.transactions.map(normalizeTransaction),
    cardBenefits: (state.cardBenefits ?? []).map(normalizeCardBenefit),
    benefitRedemptions: (state.benefitRedemptions ?? []).map(
      normalizeBenefitRedemption,
    ),
    plaidItems: state.plaidItems ?? [],
    accountBalances: (state.accountBalances ?? []).map(normalizeAccountBalance),
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/** Rewrites non-UUID ids so the state can be inserted into Postgres uuid columns. */
export function remapStateToUuids(state: FinanceState): FinanceState {
  const map = new Map<string, string>();
  const id = (old: string | null) => {
    if (!old) return old;
    if (isUuid(old)) return old;
    const existing = map.get(old);
    if (existing) return existing;
    const next = crypto.randomUUID();
    map.set(old, next);
    return next;
  };

  return {
    accounts: state.accounts.map((account) => ({
      ...account,
      id: id(account.id)!,
      plaidItemId: account.plaidItemId ? id(account.plaidItemId) : null,
    })),
    categories: state.categories.map((category) => ({
      ...category,
      id: id(category.id)!,
    })),
    transactions: state.transactions.map((tx) => ({
      ...tx,
      id: id(tx.id)!,
      accountId: id(tx.accountId)!,
      categoryId: tx.categoryId ? id(tx.categoryId) : null,
      toAccountId: tx.toAccountId ? id(tx.toAccountId) : null,
    })),
    cardBenefits: state.cardBenefits.map((benefit) => ({
      ...benefit,
      id: id(benefit.id)!,
      accountId: id(benefit.accountId)!,
    })),
    benefitRedemptions: state.benefitRedemptions.map((row) => ({
      ...row,
      id: id(row.id)!,
      benefitId: id(row.benefitId)!,
      transactionId: row.transactionId ? id(row.transactionId) : null,
    })),
    plaidItems: state.plaidItems.map((item) => ({
      ...item,
      id: id(item.id)!,
    })),
    accountBalances: state.accountBalances.map((row) => ({
      ...row,
      id: id(row.id)!,
      accountId: id(row.accountId)!,
    })),
  };
}

export function hasUserData(state: FinanceState): boolean {
  return (
    state.accounts.length > 0 ||
    state.transactions.length > 0 ||
    state.cardBenefits.length > 0
  );
}
