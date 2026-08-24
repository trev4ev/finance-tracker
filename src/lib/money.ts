const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatMoney(amount: number): string {
  const value = formatter.format(Math.abs(amount));
  if (amount < 0) return `-${value}`;
  return value;
}

export function formatSignedMoney(amount: number): string {
  const value = formatter.format(Math.abs(amount));
  if (amount > 0) return `+${value}`;
  if (amount < 0) return `-${value}`;
  return value;
}

export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}
