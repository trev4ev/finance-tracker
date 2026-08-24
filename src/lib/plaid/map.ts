import type { AccountType, CategoryKind, TransactionType } from "@/lib/types";

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

/** Plaid: positive amount is money leaving the account. */
export function mapPlaidTransactionType(
  plaidAmount: number,
  primaryCategory: string | null | undefined,
): TransactionType {
  const primary = primaryCategory?.toUpperCase() ?? "";
  if (primary === "INCOME") return "income";
  return plaidAmount < 0 ? "income" : "expense";
}

export function mapPlaidAmount(plaidAmount: number): number {
  return Math.round(Math.abs(plaidAmount) * 100) / 100;
}

const PRIMARY_TO_CATEGORY: Record<
  string,
  { name: string; kind: CategoryKind }
> = {
  INCOME: { name: "Salary", kind: "income" },
  TRANSFER_IN: { name: "Salary", kind: "income" },
  FOOD_AND_DRINK: { name: "Dining", kind: "expense" },
  GENERAL_MERCHANDISE: { name: "Shopping", kind: "expense" },
  RENT_AND_UTILITIES: { name: "Rent", kind: "expense" },
  TRANSPORTATION: { name: "Transport", kind: "expense" },
  TRAVEL: { name: "Transport", kind: "expense" },
  ENTERTAINMENT: { name: "Entertainment", kind: "expense" },
  MEDICAL: { name: "Healthcare", kind: "expense" },
  PERSONAL_CARE: { name: "Healthcare", kind: "expense" },
  GENERAL_SERVICES: { name: "Subscriptions", kind: "expense" },
  BANK_FEES: { name: "Utilities", kind: "expense" },
};

const DETAILED_TO_NAME: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "Utilities",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "Utilities",
  RENT_AND_UTILITIES_TELEPHONE: "Utilities",
  RENT_AND_UTILITIES_WATER: "Utilities",
  GENERAL_SERVICES_SUBSCRIPTION: "Subscriptions",
};

export function mapPlaidCategoryName(
  primary: string | null | undefined,
  detailed: string | null | undefined,
): { name: string; kind: CategoryKind } | null {
  const detailedKey = detailed?.toUpperCase() ?? "";
  const primaryKey = primary?.toUpperCase() ?? "";
  if (DETAILED_TO_NAME[detailedKey]) {
    return { name: DETAILED_TO_NAME[detailedKey], kind: "expense" };
  }
  return PRIMARY_TO_CATEGORY[primaryKey] ?? null;
}
