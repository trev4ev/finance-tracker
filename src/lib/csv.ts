import { lookup } from "./finance";
import { normalizeTransaction } from "./normalize";
import type { FinanceState, Transaction, TransactionType } from "./types";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function transactionsToCsv(state: FinanceState): string {
  const header = [
    "date",
    "description",
    "amount",
    "type",
    "account",
    "category",
    "to_account",
    "notes",
  ];
  const rows = state.transactions.map((tx) =>
    [
      tx.date,
      tx.description,
      tx.amount.toFixed(2),
      tx.type,
      lookup(state.accounts, tx.accountId)?.name ?? "",
      lookup(state.categories, tx.categoryId)?.name ?? "",
      lookup(state.accounts, tx.toAccountId)?.name ?? "",
      tx.notes,
    ]
      .map(escapeCsv)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function parseTransactionsCsv(
  text: string,
  state: FinanceState,
): Transaction[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const accountByName = new Map(
    state.accounts.map((account) => [account.name.toLowerCase(), account.id]),
  );
  const categoryByName = new Map(
    state.categories.map((category) => [category.name.toLowerCase(), category.id]),
  );

  const imported: Transaction[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const date = cols[idx("date")]?.trim();
    const description = cols[idx("description")]?.trim();
    const amount = Number(cols[idx("amount")]);
    const type = cols[idx("type")]?.trim() as TransactionType;
    const accountName = cols[idx("account")]?.trim().toLowerCase();
    const categoryName = cols[idx("category")]?.trim().toLowerCase();
    const toAccountName = cols[idx("to_account")]?.trim().toLowerCase();
    const notes = cols[idx("notes")]?.trim() ?? "";
    if (!date || !description || !Number.isFinite(amount) || amount < 0) continue;
    if (!["income", "expense", "transfer"].includes(type)) continue;
    const accountId = accountByName.get(accountName ?? "");
    if (!accountId) continue;
    imported.push(
      normalizeTransaction({
        id: crypto.randomUUID(),
        date,
        description,
        amount: Math.round(amount * 100) / 100,
        type,
        accountId,
        categoryId: categoryByName.get(categoryName ?? "") ?? null,
        toAccountId: accountByName.get(toAccountName ?? "") ?? null,
        notes,
      }),
    );
  }
  return imported;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}
