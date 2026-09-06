"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Pencil, Plus, Undo2 } from "lucide-react";
import { NativeDateInput, NativeSelect } from "@/components/form-controls";
import { Fab } from "@/components/Fab";
import { Modal } from "@/components/Modal";
import {
  benefitStatuses,
  candidateCreditTransactions,
  creditAccounts,
  CYCLE_MONTHS,
  frequencyLabel,
  type BenefitStatus,
} from "@/lib/benefits";
import { formatDisplayDate, todayISO } from "@/lib/dates";
import { lookup } from "@/lib/finance";
import { formatMoney, parseAmount } from "@/lib/money";
import { useFinance } from "@/lib/store";
import { BENEFIT_FREQUENCIES, type CardBenefit } from "@/lib/types";

export default function BenefitsPage() {
  const {
    state,
    hydrated,
    addBenefit,
    updateBenefit,
    deleteBenefit,
    markBenefitUsed,
    unmarkBenefit,
  } = useFinance();
  const [editing, setEditing] = useState<CardBenefit | "new" | null>(null);
  const [marking, setMarking] = useState<BenefitStatus | null>(null);

  const cards = useMemo(() => creditAccounts(state), [state]);
  const statuses = useMemo(
    () =>
      benefitStatuses(
        state.cardBenefits.filter((benefit) => benefit.active),
        state.benefitRedemptions,
      ),
    [state.cardBenefits, state.benefitRedemptions],
  );
  const hiddenCount = state.cardBenefits.filter((benefit) => !benefit.active).length;

  const groups = useMemo(() => {
    const byAccount = new Map<string, BenefitStatus[]>();
    for (const status of statuses) {
      const list = byAccount.get(status.benefit.accountId) ?? [];
      list.push(status);
      byAccount.set(status.benefit.accountId, list);
    }
    const accountIds = [
      ...cards.map((account) => account.id),
      ...[...byAccount.keys()].filter(
        (id) => !cards.some((account) => account.id === id),
      ),
    ];
    return accountIds
      .map((accountId) => {
        const items = (byAccount.get(accountId) ?? []).sort((a, b) => {
          if (a.used !== b.used) return a.used ? 1 : -1;
          return a.benefit.name.localeCompare(b.benefit.name);
        });
        return {
          account: lookup(state.accounts, accountId),
          items,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [cards, state.accounts, statuses]);

  const available = statuses.filter((row) => !row.used);
  const used = statuses.filter((row) => row.used);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="hidden lg:block">
          <h2 className="text-2xl font-semibold tracking-tight">Benefits</h2>
          <p className="text-sm text-muted">
            Credit card credits by month, half-year, or year.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="hidden h-11 shrink-0 items-center gap-2 rounded-2xl bg-accent px-4 text-sm font-medium text-background lg:inline-flex"
        >
          <Plus size={16} />
          Add benefit
        </button>
      </header>

      {state.cardBenefits.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Available now
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold">
            {available.length}
            <span className="ml-2 text-base font-medium text-muted">
              of {statuses.length}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {used.length === 0
              ? "None used in the current period."
              : `${used.length} used this period.`}
            {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
          </p>
        </section>
      ) : null}

      {state.accounts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Add a credit card in{" "}
          <Link href="/accounts" className="text-accent">
            Accounts
          </Link>{" "}
          first, then define its benefits here.
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No benefits yet. Add the credits you want to track for each card.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map(({ account, items }) => (
            <section key={account?.id ?? "unknown"}>
              <h3 className="mb-2 px-1 text-sm font-medium">
                {account?.name ?? "Card"}
              </h3>
              <div className="space-y-3">
                {items.map((status) => (
                  <BenefitCard
                    key={status.benefit.id}
                    status={status}
                    transactionLabel={linkedTransactionLabel(state, status)}
                    onEdit={() => setEditing(status.benefit)}
                    onMark={() => setMarking(status)}
                    onUnmark={() =>
                      unmarkBenefit(status.benefit.id, status.periodStart)
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {hiddenCount > 0 ? (
        <HiddenBenefits
          benefits={state.cardBenefits.filter((benefit) => !benefit.active)}
          accounts={state.accounts}
          onEdit={setEditing}
        />
      ) : null}

      {editing ? null : (
        <Fab label="Add benefit" onClick={() => setEditing("new")} />
      )}

      {editing ? (
        <BenefitModal
          initial={editing === "new" ? undefined : editing}
          accounts={cards.length > 0 ? cards : state.accounts}
          onClose={() => setEditing(null)}
          onSave={(benefit) => {
            if (editing === "new") addBenefit(benefit);
            else updateBenefit({ ...benefit, id: editing.id });
            setEditing(null);
          }}
          onDelete={
            editing === "new"
              ? undefined
              : () => {
                  deleteBenefit(editing.id);
                  setEditing(null);
                }
          }
        />
      ) : null}

      {marking ? (
        <MarkUsedModal
          status={marking}
          candidates={candidateCreditTransactions(state, marking.benefit)}
          onClose={() => setMarking(null)}
          onSave={(input) => {
            markBenefitUsed({
              benefitId: marking.benefit.id,
              ...input,
            });
            setMarking(null);
          }}
        />
      ) : null}
    </div>
  );
}

function linkedTransactionLabel(
  state: ReturnType<typeof useFinance>["state"],
  status: BenefitStatus,
): string | null {
  const redemption = status.redemptions.find((row) => row.transactionId);
  const tx = lookup(state.transactions, redemption?.transactionId);
  if (!tx) return null;
  return `${tx.description} · ${formatDisplayDate(tx.date)}`;
}

function BenefitCard({
  status,
  transactionLabel,
  onEdit,
  onMark,
  onUnmark,
}: {
  status: BenefitStatus;
  transactionLabel: string | null;
  onEdit: () => void;
  onMark: () => void;
  onUnmark: () => void;
}) {
  const { benefit, used, periodLabel, redeemedAmount } = status;
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{benefit.name}</p>
          <p className="text-xs text-muted">
            {frequencyLabel(benefit.frequency)} · {periodLabel}
            {benefit.expectedAmount != null
              ? ` · ${formatMoney(benefit.expectedAmount)}`
              : ""}
          </p>
          {used ? (
            <p className="mt-1 text-xs text-income">
              Used
              {redeemedAmount > 0 ? ` · ${formatMoney(redeemedAmount)}` : ""}
              {transactionLabel ? ` · ${transactionLabel}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-xs text-accent">Available</p>
          )}
        </div>
        <button
          type="button"
          aria-label={`Edit ${benefit.name}`}
          onClick={onEdit}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted active:bg-surface-2 active:text-foreground"
        >
          <Pencil size={16} />
        </button>
      </div>
      {used ? (
        <button
          type="button"
          onClick={onUnmark}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-sm text-muted active:bg-surface-2"
        >
          <Undo2 size={14} />
          Undo
        </button>
      ) : (
        <button
          type="button"
          onClick={onMark}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent/15 text-sm font-medium text-accent active:bg-accent/25"
        >
          <Check size={14} />
          Mark used
        </button>
      )}
    </div>
  );
}

function HiddenBenefits({
  benefits,
  accounts,
  onEdit,
}: {
  benefits: CardBenefit[];
  accounts: { id: string; name: string }[];
  onEdit: (benefit: CardBenefit) => void;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-border p-3.5">
      <h3 className="mb-2 text-sm font-medium text-muted">Hidden benefits</h3>
      <ul className="space-y-1">
        {benefits.map((benefit) => (
          <li key={benefit.id}>
            <button
              type="button"
              onClick={() => onEdit(benefit)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 text-left text-sm active:bg-surface-2"
            >
              <span className="truncate">{benefit.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {lookup(accounts, benefit.accountId)?.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BenefitModal({
  initial,
  accounts,
  onClose,
  onSave,
  onDelete,
}: {
  initial?: CardBenefit;
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onSave: (benefit: Omit<CardBenefit, "id">) => void;
  onDelete?: () => void;
}) {
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? accounts[0]?.id ?? "",
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "monthly");
  const [amount, setAmount] = useState(
    initial?.expectedAmount != null ? String(initial.expectedAmount) : "",
  );
  const [cycleStartMonth, setCycleStartMonth] = useState(
    String(initial?.cycleStartMonth ?? 1),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState("");

  return (
    <Modal title={initial ? "Edit benefit" : "Add benefit"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!accountId) {
            setError("Choose a card.");
            return;
          }
          if (!name.trim()) {
            setError("Add a name.");
            return;
          }
          const parsed = amount.trim() ? parseAmount(amount) : null;
          if (amount.trim() && parsed === null) {
            setError("Enter a valid amount, or leave it blank.");
            return;
          }
          onSave({
            accountId,
            name: name.trim(),
            frequency,
            expectedAmount: parsed,
            cycleStartMonth: Number(cycleStartMonth) || 1,
            notes: notes.trim(),
            active,
          });
        }}
      >
        <div className="block text-sm">
          <span className="mb-1 block text-muted">Card</span>
          <NativeSelect
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
            placeholder="Dining credit, Uber Cash…"
          />
        </label>
        <div className="block text-sm">
          <span className="mb-1 block text-muted">How often</span>
          <NativeSelect
            value={frequency}
            onChange={(event) =>
              setFrequency(event.target.value as CardBenefit["frequency"])
            }
          >
            {BENEFIT_FREQUENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        {frequency !== "monthly" ? (
          <div className="block text-sm">
            <span className="mb-1 block text-muted">Period starts in</span>
            <NativeSelect
              value={cycleStartMonth}
              onChange={(event) => setCycleStartMonth(event.target.value)}
            >
              {CYCLE_MONTHS.map((month) => (
                <option key={month.value} value={String(month.value)}>
                  {month.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Expected amount</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 font-mono text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
            placeholder="Optional"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base outline-none focus:border-accent sm:text-sm"
            placeholder="Optional"
          />
        </label>
        {initial ? (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Show in the available list
          </label>
        ) : null}
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl px-4 py-2 text-sm text-muted active:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Save benefit
          </button>
        </div>
      </form>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 min-h-11 w-full rounded-xl border border-expense/30 px-4 py-2 text-sm text-expense active:bg-expense/10"
        >
          Remove benefit
        </button>
      ) : null}
    </Modal>
  );
}

function MarkUsedModal({
  status,
  candidates,
  onClose,
  onSave,
}: {
  status: BenefitStatus;
  candidates: { id: string; date: string; description: string; amount: number }[];
  onClose: () => void;
  onSave: (input: {
    usedOn: string;
    transactionId: string | null;
    amount: number | null;
    notes: string;
  }) => void;
}) {
  const [transactionId, setTransactionId] = useState("");
  const [usedOn, setUsedOn] = useState(todayISO());
  const [amount, setAmount] = useState(
    status.benefit.expectedAmount != null
      ? String(status.benefit.expectedAmount)
      : "",
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  return (
    <Modal title={`Mark ${status.benefit.name} used`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = amount.trim() ? parseAmount(amount) : null;
          if (amount.trim() && parsed === null) {
            setError("Enter a valid amount, or leave it blank.");
            return;
          }
          onSave({
            usedOn,
            transactionId: transactionId || null,
            amount: parsed,
            notes: notes.trim(),
          });
        }}
      >
        <p className="text-sm text-muted">{status.periodLabel}</p>
        {candidates.length > 0 ? (
          <div className="block text-sm">
            <span className="mb-1 block text-muted">Linked credit</span>
            <NativeSelect
              value={transactionId}
              onChange={(event) => {
                const nextId = event.target.value;
                setTransactionId(nextId);
                const tx = candidates.find((item) => item.id === nextId);
                if (tx) {
                  setUsedOn(tx.date);
                  setAmount(String(tx.amount));
                }
              }}
            >
              <option value="">None — just mark used</option>
              {candidates.map((tx) => (
                <option key={tx.id} value={tx.id}>
                  {tx.description} · {formatDisplayDate(tx.date)} ·{" "}
                  {formatMoney(tx.amount)}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No unused statement credits on this card. You can still mark it used.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="block text-sm">
            <span className="mb-1 block text-muted">Date</span>
            <NativeDateInput
              value={usedOn}
              onChange={(event) => setUsedOn(event.target.value)}
            />
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Amount</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 font-mono text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
              placeholder="Optional"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Notes</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent sm:h-11 sm:text-sm"
            placeholder="Optional"
          />
        </label>
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl px-4 py-2 text-sm text-muted active:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Mark used
          </button>
        </div>
      </form>
    </Modal>
  );
}
