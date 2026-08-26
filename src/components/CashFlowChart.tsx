"use client";

import { formatMoney } from "@/lib/money";
import { shortMonthLabel } from "@/lib/dates";

export function CashFlowChart({
  series,
}: {
  series: { month: string; income: number; expenses: number }[];
}) {
  const max = Math.max(
    1,
    ...series.flatMap((row) => [row.income, row.expenses]),
  );

  return (
    <div className="flex h-40 items-end gap-2 sm:h-56 sm:gap-3">
      {series.map((row) => (
        <div key={row.month} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end justify-center gap-1 sm:h-44">
            <div
              className="w-3.5 rounded-t bg-income/80 sm:w-4"
              style={{ height: `${(row.income / max) * 100}%` }}
              title={`Income ${formatMoney(row.income)}`}
            />
            <div
              className="w-3.5 rounded-t bg-expense/80 sm:w-4"
              style={{ height: `${(row.expenses / max) * 100}%` }}
              title={`Expenses ${formatMoney(row.expenses)}`}
            />
          </div>
          <span className="text-[11px] text-muted">{shortMonthLabel(row.month)}</span>
        </div>
      ))}
    </div>
  );
}
