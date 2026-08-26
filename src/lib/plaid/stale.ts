import type { FinanceState } from "@/lib/types";

export const PLAID_STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export function isTimestampStale(
  iso: string | null | undefined,
  maxAgeMs = PLAID_STALE_AFTER_MS,
): boolean {
  if (!iso) return true;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return true;
  return Date.now() - then > maxAgeMs;
}

export function plaidAccountsNeedSync(state: FinanceState): boolean {
  const linked = state.accounts.filter((account) => account.source === "plaid");
  if (state.plaidItems.length === 0 && linked.length === 0) return false;
  if (state.plaidItems.some((item) => isTimestampStale(item.lastSyncedAt))) {
    return true;
  }
  return linked.some((account) => isTimestampStale(account.lastSyncedAt));
}
