type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "cash"
  | "investment"
  | "loan"
  | "other";
type CategoryKind = "income" | "expense";
type TransactionType = "income" | "expense" | "transfer";

const SUBTYPE_MAP: Record<string, AccountType> = {
  checking: "checking",
  savings: "savings",
  "cash management": "checking",
  paypal: "checking",
  cd: "savings",
  "money market": "savings",
  prepaid: "cash",
  "credit card": "credit",
  brokerage: "investment",
  "mutual fund": "investment",
  ira: "investment",
  "401k": "investment",
  "403b": "investment",
  "529": "investment",
  hsa: "investment",
  mortgage: "loan",
  student: "loan",
  auto: "loan",
  loan: "loan",
};

export function mapPlaidAccountType(
  type: string | null | undefined,
  subtype: string | null | undefined,
): AccountType {
  const key = (subtype || type || "").toLowerCase();
  if (SUBTYPE_MAP[key]) return SUBTYPE_MAP[key];
  if (type === "depository") return "checking";
  if (type === "credit") return "credit";
  if (type === "investment" || type === "brokerage") return "investment";
  if (type === "loan") return "loan";
  return "other";
}

const TRANSFER_PRIMARIES = new Set([
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "LOAN_PAYMENTS",
  "INVESTMENT_AND_RETIREMENT_FUNDS",
]);

const INVESTMENT_RE =
  /\b(robinhood|vanguard|fidelity|schwab|betterment|wealthfront|coinbase|e-?trade|acorns)\b/i;
const TRANSFER_RE =
  /credit crd|crcardpmt|citi autopay|ach pmt|autopay payment|autopay pymt|automatic payment|withdrwl|withdrawal|\batm\b|\bvenmo\b|\bzelle\b|\bcash app\b|payment - thank/i;

function haystack(
  description: string | null | undefined,
  merchantName: string | null | undefined,
): string {
  return `${merchantName ?? ""} ${description ?? ""}`;
}

export function isInvestmentTransfer(
  primaryCategory: string | null | undefined,
  description?: string | null,
  merchantName?: string | null,
): boolean {
  const primary = primaryCategory?.toUpperCase() ?? "";
  if (primary === "INVESTMENT_AND_RETIREMENT_FUNDS") return true;
  return INVESTMENT_RE.test(haystack(description, merchantName));
}

export function isNonSpendingTransfer(
  primaryCategory: string | null | undefined,
  description?: string | null,
  merchantName?: string | null,
): boolean {
  const primary = primaryCategory?.toUpperCase() ?? "";
  if (TRANSFER_PRIMARIES.has(primary)) return true;
  if (isInvestmentTransfer(primaryCategory, description, merchantName)) return true;
  return TRANSFER_RE.test(haystack(description, merchantName));
}

export function mapNonSpendingCategory(
  primaryCategory: string | null | undefined,
  description?: string | null,
  merchantName?: string | null,
): { name: string; kind: CategoryKind } | null {
  if (isInvestmentTransfer(primaryCategory, description, merchantName)) {
    return { name: "Investments", kind: "expense" };
  }
  if (isNonSpendingTransfer(primaryCategory, description, merchantName)) {
    return { name: "Transfers", kind: "expense" };
  }
  return null;
}

/** Plaid: positive amount is money leaving the account. */
export function mapPlaidTransactionType(
  plaidAmount: number,
  primaryCategory: string | null | undefined,
  description?: string | null,
  merchantName?: string | null,
): TransactionType {
  const primary = primaryCategory?.toUpperCase() ?? "";
  if (isNonSpendingTransfer(primaryCategory, description, merchantName)) {
    return "transfer";
  }
  if (primary === "INCOME") return "income";
  return plaidAmount < 0 ? "income" : "expense";
}

export function mapPlaidAmount(plaidAmount: number): number {
  return Math.round(Math.abs(plaidAmount) * 100) / 100;
}

export function formatPlaidCategory(
  primary: string | null | undefined,
): string | null {
  if (!primary) return null;
  return primary
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

const CATEGORY_COLORS: Record<string, string> = {
  Salary: "#34d399",
  Freelance: "#6ee7b7",
  "Other income": "#86efac",
  Rent: "#fb7185",
  Groceries: "#fbbf24",
  Dining: "#f97316",
  Transport: "#38bdf8",
  Travel: "#22d3ee",
  Utilities: "#818cf8",
  Fees: "#94a3b8",
  Subscriptions: "#c084fc",
  Services: "#a78bfa",
  Healthcare: "#2dd4bf",
  "Personal care": "#5eead4",
  Shopping: "#f472b6",
  Entertainment: "#a3e635",
  Home: "#d97706",
  "Taxes & giving": "#e11d48",
  Investments: "#38bdf8",
  Transfers: "#94a3b8",
  Other: "#64748b",
};

export function colorForCategory(name: string): string {
  return CATEGORY_COLORS[name] ?? "#94a3b8";
}

const PRIMARY_TO_CATEGORY: Record<
  string,
  { name: string; kind: CategoryKind }
> = {
  INCOME: { name: "Salary", kind: "income" },
  FOOD_AND_DRINK: { name: "Dining", kind: "expense" },
  GENERAL_MERCHANDISE: { name: "Shopping", kind: "expense" },
  RENT_AND_UTILITIES: { name: "Rent", kind: "expense" },
  TRANSPORTATION: { name: "Transport", kind: "expense" },
  TRAVEL: { name: "Travel", kind: "expense" },
  ENTERTAINMENT: { name: "Entertainment", kind: "expense" },
  MEDICAL: { name: "Healthcare", kind: "expense" },
  PERSONAL_CARE: { name: "Personal care", kind: "expense" },
  GENERAL_SERVICES: { name: "Services", kind: "expense" },
  BANK_FEES: { name: "Fees", kind: "expense" },
  HOME_IMPROVEMENT: { name: "Home", kind: "expense" },
  GOVERNMENT_AND_NON_PROFIT: { name: "Taxes & giving", kind: "expense" },
  OTHER: { name: "Other", kind: "expense" },
};

const DETAILED_TO_CATEGORY: Record<
  string,
  { name: string; kind: CategoryKind }
> = {
  FOOD_AND_DRINK_GROCERIES: { name: "Groceries", kind: "expense" },
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: { name: "Utilities", kind: "expense" },
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: { name: "Utilities", kind: "expense" },
  RENT_AND_UTILITIES_TELEPHONE: { name: "Utilities", kind: "expense" },
  RENT_AND_UTILITIES_WATER: { name: "Utilities", kind: "expense" },
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: {
    name: "Utilities",
    kind: "expense",
  },
  GENERAL_SERVICES_SUBSCRIPTION: { name: "Subscriptions", kind: "expense" },
  INCOME_DIVIDENDS: { name: "Other income", kind: "income" },
  INCOME_INTEREST_EARNED: { name: "Other income", kind: "income" },
  INCOME_RETIREMENT_PENSION: { name: "Other income", kind: "income" },
  INCOME_TAX_REFUND: { name: "Other income", kind: "income" },
  INCOME_UNEMPLOYMENT: { name: "Other income", kind: "income" },
  INCOME_WAGES: { name: "Salary", kind: "income" },
  GOVERNMENT_AND_NON_PROFIT_DONATIONS: {
    name: "Taxes & giving",
    kind: "expense",
  },
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: {
    name: "Taxes & giving",
    kind: "expense",
  },
};

export function mapPlaidCategoryName(
  primary: string | null | undefined,
  detailed: string | null | undefined,
): { name: string; kind: CategoryKind } | null {
  const detailedKey = detailed?.toUpperCase() ?? "";
  const primaryKey = primary?.toUpperCase() ?? "";
  if (DETAILED_TO_CATEGORY[detailedKey]) return DETAILED_TO_CATEGORY[detailedKey];
  return PRIMARY_TO_CATEGORY[primaryKey] ?? null;
}
