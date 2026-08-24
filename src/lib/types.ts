export type AccountType = "checking" | "savings" | "credit" | "cash" | "investment";

export type TransactionType = "income" | "expense" | "transfer";

export type CategoryKind = "income" | "expense";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number;
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
  type: TransactionType;
  accountId: string;
  categoryId: string | null;
  toAccountId: string | null;
  notes: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  amount: number;
}

export interface FinanceState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
}

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit card" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
];
