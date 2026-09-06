export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "cash"
  | "investment"
  | "loan"
  | "other";

export type TransactionType = "income" | "expense" | "transfer";

export type CategoryKind = "income" | "expense";

export type DataSource = "manual" | "plaid";

export type BenefitFrequency = "monthly" | "semiannual" | "annual";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number;
  currentBalance: number | null;
  availableBalance: number | null;
  currency: string;
  source: DataSource;
  plaidAccountId: string | null;
  plaidItemId: string | null;
  institutionName: string | null;
  mask: string | null;
  lastSyncedAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  /** Bank/posted amount. Stays put when you lower `amount` to your share. */
  originalAmount: number;
  type: TransactionType;
  accountId: string;
  categoryId: string | null;
  toAccountId: string | null;
  notes: string;
  source: DataSource;
  plaidTransactionId: string | null;
  pending: boolean;
  merchantName: string | null;
  plaidCategory: string | null;
}

/** Form and seed payloads; `normalizeTransaction` fills Plaid/source fields. */
export type TransactionInput = Pick<
  Transaction,
  | "date"
  | "description"
  | "amount"
  | "type"
  | "accountId"
  | "categoryId"
  | "toAccountId"
  | "notes"
> &
  Partial<Transaction>;

export interface CardBenefit {
  id: string;
  accountId: string;
  name: string;
  frequency: BenefitFrequency;
  expectedAmount: number | null;
  /** 1–12. Start month for annual/semiannual cycles; ignored for monthly. */
  cycleStartMonth: number;
  notes: string;
  active: boolean;
}

export interface BenefitRedemption {
  id: string;
  benefitId: string;
  /** YYYY-MM for the period this redemption counts toward. */
  periodStart: string;
  usedOn: string;
  transactionId: string | null;
  amount: number | null;
  notes: string;
}

export interface PlaidItem {
  id: string;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
}

export interface FinanceState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  cardBenefits: CardBenefit[];
  benefitRedemptions: BenefitRedemption[];
  plaidItems: PlaidItem[];
}

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit card" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
];

export const BENEFIT_FREQUENCIES: { value: BenefitFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "semiannual", label: "Every 6 months" },
  { value: "annual", label: "Yearly" },
];
