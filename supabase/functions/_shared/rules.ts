export function merchantKey(
  merchantName: string | null | undefined,
  description: string | null | undefined,
): string {
  return (merchantName?.trim() || description?.trim() || "").toLowerCase();
}
