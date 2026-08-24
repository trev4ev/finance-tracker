import { currentMonth, daysInMonth, lastNMonths } from "./dates";
import type { FinanceState, Transaction } from "./types";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function createDemoState(): FinanceState {
  const accounts = [
    {
      id: "acc-checking",
      name: "Everyday Checking",
      type: "checking" as const,
      startingBalance: 4280,
    },
    {
      id: "acc-savings",
      name: "High-Yield Savings",
      type: "savings" as const,
      startingBalance: 18640,
    },
    {
      id: "acc-credit",
      name: "Visa Rewards",
      type: "credit" as const,
      startingBalance: -640,
    },
    {
      id: "acc-brokerage",
      name: "Brokerage",
      type: "investment" as const,
      startingBalance: 12450,
    },
  ];

  const categories = [
    { id: "cat-salary", name: "Salary", kind: "income" as const, color: "#34d399" },
    {
      id: "cat-freelance",
      name: "Freelance",
      kind: "income" as const,
      color: "#6ee7b7",
    },
    { id: "cat-rent", name: "Rent", kind: "expense" as const, color: "#fb7185" },
    {
      id: "cat-groceries",
      name: "Groceries",
      kind: "expense" as const,
      color: "#fbbf24",
    },
    { id: "cat-dining", name: "Dining", kind: "expense" as const, color: "#f97316" },
    {
      id: "cat-transport",
      name: "Transport",
      kind: "expense" as const,
      color: "#38bdf8",
    },
    {
      id: "cat-utilities",
      name: "Utilities",
      kind: "expense" as const,
      color: "#818cf8",
    },
    {
      id: "cat-subs",
      name: "Subscriptions",
      kind: "expense" as const,
      color: "#c084fc",
    },
    {
      id: "cat-health",
      name: "Healthcare",
      kind: "expense" as const,
      color: "#2dd4bf",
    },
    {
      id: "cat-shopping",
      name: "Shopping",
      kind: "expense" as const,
      color: "#f472b6",
    },
    {
      id: "cat-fun",
      name: "Entertainment",
      kind: "expense" as const,
      color: "#a3e635",
    },
  ];

  const rand = mulberry32(20260824);
  const months = lastNMonths(4);
  const transactions: Transaction[] = [];
  let txn = 0;
  const id = () => `tx-${++txn}`;

  const groceryMerchants = [
    "Trader Joe's",
    "Whole Foods",
    "Safeway",
    "Farmers Market",
  ];
  const diningMerchants = [
    "Tartine",
    "Burma Superstar",
    "Blue Bottle",
    "Nopa",
    "The Mill",
  ];
  const shoppingMerchants = ["Uniqlo", "REI", "Amazon", "Target"];

  for (const month of months) {
    const dim = daysInMonth(month);

    transactions.push({
      id: id(),
      date: `${month}-01`,
      description: "Payroll",
      amount: 4200,
      type: "income",
      accountId: "acc-checking",
      categoryId: "cat-salary",
      toAccountId: null,
      notes: "",
    });
    transactions.push({
      id: id(),
      date: `${month}-15`,
      description: "Payroll",
      amount: 4200,
      type: "income",
      accountId: "acc-checking",
      categoryId: "cat-salary",
      toAccountId: null,
      notes: "",
    });

    if (rand() > 0.4) {
      transactions.push({
        id: id(),
        date: `${month}-${String(8 + Math.floor(rand() * 12)).padStart(2, "0")}`,
        description: "Design contract",
        amount: roundMoney(650 + rand() * 900),
        type: "income",
        accountId: "acc-checking",
        categoryId: "cat-freelance",
        toAccountId: null,
        notes: "",
      });
    }

    transactions.push({
      id: id(),
      date: `${month}-01`,
      description: "Apartment rent",
      amount: 2450,
      type: "expense",
      accountId: "acc-checking",
      categoryId: "cat-rent",
      toAccountId: null,
      notes: "",
    });
    transactions.push({
      id: id(),
      date: `${month}-04`,
      description: "PG&E",
      amount: roundMoney(78 + rand() * 40),
      type: "expense",
      accountId: "acc-checking",
      categoryId: "cat-utilities",
      toAccountId: null,
      notes: "",
    });
    transactions.push({
      id: id(),
      date: `${month}-06`,
      description: "Internet",
      amount: 80,
      type: "expense",
      accountId: "acc-checking",
      categoryId: "cat-utilities",
      toAccountId: null,
      notes: "",
    });
    transactions.push({
      id: id(),
      date: `${month}-03`,
      description: "Netflix",
      amount: 17.99,
      type: "expense",
      accountId: "acc-credit",
      categoryId: "cat-subs",
      toAccountId: null,
      notes: "",
    });
    transactions.push({
      id: id(),
      date: `${month}-03`,
      description: "Spotify",
      amount: 11.99,
      type: "expense",
      accountId: "acc-credit",
      categoryId: "cat-subs",
      toAccountId: null,
      notes: "",
    });

    for (let i = 0; i < 5; i += 1) {
      const day = String(2 + Math.floor(rand() * (dim - 2))).padStart(2, "0");
      transactions.push({
        id: id(),
        date: `${month}-${day}`,
        description: pick(rand, groceryMerchants),
        amount: roundMoney(28 + rand() * 75),
        type: "expense",
        accountId: rand() > 0.35 ? "acc-credit" : "acc-checking",
        categoryId: "cat-groceries",
        toAccountId: null,
        notes: "",
      });
    }

    for (let i = 0; i < 4; i += 1) {
      const day = String(2 + Math.floor(rand() * (dim - 2))).padStart(2, "0");
      transactions.push({
        id: id(),
        date: `${month}-${day}`,
        description: pick(rand, diningMerchants),
        amount: roundMoney(12 + rand() * 68),
        type: "expense",
        accountId: "acc-credit",
        categoryId: "cat-dining",
        toAccountId: null,
        notes: "",
      });
    }

    transactions.push({
      id: id(),
      date: `${month}-12`,
      description: "Clipper card",
      amount: 45,
      type: "expense",
      accountId: "acc-checking",
      categoryId: "cat-transport",
      toAccountId: null,
      notes: "",
    });

    if (rand() > 0.45) {
      transactions.push({
        id: id(),
        date: `${month}-${String(10 + Math.floor(rand() * 14)).padStart(2, "0")}`,
        description: pick(rand, shoppingMerchants),
        amount: roundMoney(32 + rand() * 140),
        type: "expense",
        accountId: "acc-credit",
        categoryId: "cat-shopping",
        toAccountId: null,
        notes: "",
      });
    }

    if (rand() > 0.5) {
      transactions.push({
        id: id(),
        date: `${month}-${String(6 + Math.floor(rand() * 18)).padStart(2, "0")}`,
        description: rand() > 0.5 ? "Movie tickets" : "Concert",
        amount: roundMoney(18 + rand() * 90),
        type: "expense",
        accountId: "acc-credit",
        categoryId: "cat-fun",
        toAccountId: null,
        notes: "",
      });
    }

    transactions.push({
      id: id(),
      date: `${month}-20`,
      description: "Pharmacy",
      amount: roundMoney(14 + rand() * 40),
      type: "expense",
      accountId: "acc-checking",
      categoryId: "cat-health",
      toAccountId: null,
      notes: "",
    });

    transactions.push({
      id: id(),
      date: `${month}-22`,
      description: "Credit card payment",
      amount: roundMoney(420 + rand() * 280),
      type: "transfer",
      accountId: "acc-checking",
      categoryId: null,
      toAccountId: "acc-credit",
      notes: "",
    });

    transactions.push({
      id: id(),
      date: `${month}-25`,
      description: "Savings transfer",
      amount: 800,
      type: "transfer",
      accountId: "acc-checking",
      categoryId: null,
      toAccountId: "acc-savings",
      notes: "Monthly auto-save",
    });
  }

  const month = currentMonth();
  const budgets = [
    { id: "bud-rent", categoryId: "cat-rent", month, amount: 2450 },
    { id: "bud-groc", categoryId: "cat-groceries", month, amount: 450 },
    { id: "bud-dine", categoryId: "cat-dining", month, amount: 280 },
    { id: "bud-trans", categoryId: "cat-transport", month, amount: 120 },
    { id: "bud-util", categoryId: "cat-utilities", month, amount: 180 },
    { id: "bud-shop", categoryId: "cat-shopping", month, amount: 200 },
  ];

  return { accounts, categories, transactions, budgets };
}

export function emptyState(): FinanceState {
  return {
    accounts: [],
    categories: [
      { id: crypto.randomUUID(), name: "Salary", kind: "income", color: "#34d399" },
      { id: crypto.randomUUID(), name: "Groceries", kind: "expense", color: "#fbbf24" },
      { id: crypto.randomUUID(), name: "Rent", kind: "expense", color: "#fb7185" },
      { id: crypto.randomUUID(), name: "Dining", kind: "expense", color: "#f97316" },
    ],
    transactions: [],
    budgets: [],
  };
}
