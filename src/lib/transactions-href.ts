import { monthDateRange } from "./dates";
import type { TransactionType } from "./types";

export function transactionsHref(filters: {
  type?: TransactionType | "all";
  category?: string;
  account?: string;
  month?: string;
  from?: string;
  to?: string;
}): string {
  const params = new URLSearchParams();
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.category && filters.category !== "all") {
    params.set("category", filters.category);
  }
  if (filters.account && filters.account !== "all") {
    params.set("account", filters.account);
  }
  if (filters.month) {
    const range = monthDateRange(filters.month);
    params.set("from", range.from);
    params.set("to", range.to);
  }
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return query ? `/transactions?${query}` : "/transactions";
}
