/** Transfers never enter the review inbox. Pending→posted spend/income does. */
export function reviewedForPlaidWrite(
  type: string,
  posted: boolean,
  currentReviewed: boolean | undefined,
): boolean {
  if (type === "transfer") return true;
  if (posted) return false;
  return currentReviewed ?? false;
}
