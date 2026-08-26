"use client";

import type { Category } from "@/lib/types";
import { formatMoney } from "@/lib/money";

export function CategoryDonut({
  slices,
}: {
  slices: { category: Category; amount: number }[];
}) {
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
  const size = 180;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;

  const lengths = slices.map((slice) =>
    total === 0 ? 0 : (slice.amount / total) * circ,
  );
  const arcs = slices.map((slice, index) => {
    const length = lengths[index] ?? 0;
    const offset = lengths.slice(0, index).reduce((sum, value) => sum + value, 0);
    return {
      ...slice,
      dash: `${length} ${circ - length}`,
      offset,
    };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="hidden shrink-0 sm:block"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={stroke}
        />
        {arcs.map((arc) => (
          <circle
            key={arc.category.id}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.category.color}
            strokeWidth={stroke}
            strokeDasharray={arc.dash}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          className="fill-muted"
          fontSize="11"
        >
          Spent
        </text>
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          className="fill-foreground"
          fontSize="16"
          fontFamily="var(--font-geist-mono)"
        >
          {formatMoney(total)}
        </text>
      </svg>
      <ul className="w-full space-y-3">
        {slices.slice(0, 6).map((slice) => {
          const pct = total === 0 ? 0 : (slice.amount / total) * 100;
          return (
            <li key={slice.category.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: slice.category.color }}
                  />
                  <span className="truncate">{slice.category.name}</span>
                </span>
                <span className="shrink-0 font-mono text-muted">
                  {formatMoney(slice.amount)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: slice.category.color,
                  }}
                />
              </div>
            </li>
          );
        })}
        {slices.length === 0 ? (
          <li className="text-sm text-muted">No expenses this month.</li>
        ) : null}
      </ul>
    </div>
  );
}
