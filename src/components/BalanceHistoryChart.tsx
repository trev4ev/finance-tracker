"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  accountChartColor,
  formatAccountBalance,
  type BalanceSnapshot,
} from "@/lib/finance";
import { formatChartDate, formatChartTick } from "@/lib/dates";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import type { Account, AccountType } from "@/lib/types";

type Layer = {
  id: string;
  name: string;
  color: string;
  type: AccountType;
  kind: "asset" | "liability";
};

export function BalanceHistoryChart({
  accounts,
  points,
  selectedAccountId,
  onSelectAccount,
}: {
  accounts: Account[];
  points: BalanceSnapshot[];
  selectedAccountId: string | "all";
  onSelectAccount?: (id: string | "all") => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const capturing = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const sync = () => setWidth(el.clientWidth);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layers = useMemo<Layer[]>(() => {
    const visible =
      selectedAccountId === "all"
        ? accounts
        : accounts.filter((account) => account.id === selectedAccountId);
    return visible.map((account) => ({
      id: account.id,
      name: account.name,
      color: accountChartColor(account, accounts),
      type: account.type,
      kind:
        account.type === "credit" || account.type === "loan"
          ? "liability"
          : "asset",
    }));
  }, [accounts, selectedAccountId]);

  const lastIndex = Math.max(0, points.length - 1);
  const index = activeIndex ?? lastIndex;
  const active = points[index];
  const start = points[0];
  const selectedAccount =
    selectedAccountId === "all"
      ? undefined
      : accounts.find((account) => account.id === selectedAccountId);

  const headlineValue = active
    ? selectedAccount
      ? (active.balances[selectedAccount.id] ?? 0)
      : active.netWorth
    : 0;
  const startValue = start
    ? selectedAccount
      ? (start.balances[selectedAccount.id] ?? 0)
      : start.netWorth
    : 0;
  const delta = headlineValue - startValue;

  const height = 220;
  const pad = { l: 8, r: 8, t: 12, b: 28 };
  const innerW = Math.max(1, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;

  const geometry = useMemo(() => {
    if (points.length === 0 || width === 0) {
      return {
        yAt: () => pad.t + innerH,
        xAt: () => pad.l,
        yMin: 0,
        yMax: 1,
        zeroY: null as number | null,
      };
    }

    let yMin = 0;
    let yMax = 0;
    for (const point of points) {
      if (selectedAccount) {
        const value = point.balances[selectedAccount.id] ?? 0;
        yMin = Math.min(yMin, value);
        yMax = Math.max(yMax, value);
      } else {
        let assets = 0;
        let debts = 0;
        for (const layer of layers) {
          const value = point.balances[layer.id] ?? 0;
          if (layer.kind === "asset") assets += Math.max(0, value);
          else debts += Math.min(0, value);
        }
        yMin = Math.min(yMin, debts, point.netWorth);
        yMax = Math.max(yMax, assets, point.netWorth);
      }
    }
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }
    const padY = (yMax - yMin) * 0.12;
    yMin -= padY;
    yMax += padY;
    const yAt = (value: number) =>
      pad.t + ((yMax - value) / (yMax - yMin)) * innerH;
    const xAt = (i: number) =>
      pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const zeroY = yMin < 0 && yMax > 0 ? yAt(0) : null;
    return { yAt, xAt, yMin, yMax, zeroY };
  }, [innerH, innerW, layers, pad.l, pad.t, points, selectedAccount, width]);

  const stacked = useMemo(() => {
    if (points.length === 0 || width === 0) return [];
    return layers.map((layer) => {
      const tops: string[] = [];
      const bottoms: string[] = [];
      const line: string[] = [];
      for (let i = 0; i < points.length; i += 1) {
        const point = points[i]!;
        let y0 = 0;
        let y1 = 0;
        if (selectedAccount) {
          y0 = 0;
          y1 = point.balances[layer.id] ?? 0;
        } else {
          let pos = 0;
          let neg = 0;
          for (const item of layers) {
            const value = point.balances[item.id] ?? 0;
            if (item.kind === "asset") {
              const next = pos + Math.max(0, value);
              if (item.id === layer.id) {
                y0 = pos;
                y1 = next;
              }
              pos = next;
            } else {
              const next = neg + Math.min(0, value);
              if (item.id === layer.id) {
                y1 = neg;
                y0 = next;
              }
              neg = next;
            }
          }
        }
        const x = geometry.xAt(i);
        tops.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${geometry.yAt(y1).toFixed(2)}`);
        bottoms.push(`L ${x.toFixed(2)} ${geometry.yAt(y0).toFixed(2)}`);
        line.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${geometry.yAt(y1).toFixed(2)}`);
      }
      return {
        ...layer,
        area: `${tops.join(" ")} ${bottoms.reverse().join(" ")} Z`,
        line: line.join(" "),
      };
    });
  }, [geometry, layers, points, selectedAccount, width]);

  const netLine = useMemo(() => {
    if (points.length === 0 || width === 0) return "";
    return points
      .map((point, i) => {
        const value = selectedAccount
          ? (point.balances[selectedAccount.id] ?? 0)
          : point.netWorth;
        const cmd = i === 0 ? "M" : "L";
        return `${cmd} ${geometry.xAt(i).toFixed(2)} ${geometry.yAt(value).toFixed(2)}`;
      })
      .join(" ");
  }, [geometry, points, selectedAccount, width]);

  const ticks = useMemo(() => {
    if (points.length === 0) return [];
    if (points.length === 1) {
      return [{ i: 0, date: points[0]!.date }];
    }
    const mid = Math.round((points.length - 1) / 2);
    return [
      { i: 0, date: points[0]!.date },
      { i: mid, date: points[mid]!.date },
      { i: lastIndex, date: points[lastIndex]!.date },
    ];
  }, [lastIndex, points]);

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const el = wrapRef.current;
      if (!el || points.length === 0) return lastIndex;
      const rect = el.getBoundingClientRect();
      const t = (clientX - rect.left - pad.l) / innerW;
      const clamped = Math.min(1, Math.max(0, t));
      return Math.round(clamped * (points.length - 1));
    },
    [innerW, lastIndex, pad.l, points.length],
  );

  const inspectAt = useCallback(
    (clientX: number) => {
      setActiveIndex(indexFromClientX(clientX));
    },
    [indexFromClientX],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    capturing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    inspectAt(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || capturing.current) {
      inspectAt(event.clientX);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    capturing.current = false;
    if (event.pointerType === "mouse") return;
    inspectAt(event.clientX);
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && !capturing.current) {
      setActiveIndex(null);
    }
  };

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Add transactions to see balances over time.
      </p>
    );
  }

  const activeX = geometry.xAt(index);
  const activeY = geometry.yAt(headlineValue);
  const headline =
    selectedAccount
      ? formatAccountBalance(selectedAccount.type, headlineValue)
      : formatMoney(headlineValue);
  const inspecting = activeIndex !== null;

  return (
    <div className="space-y-3">
      <div aria-live="polite" className="min-h-[4.5rem]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {inspecting
              ? formatChartDate(active!.date)
              : selectedAccount
                ? selectedAccount.name
                : "Net worth"}
          </p>
          {inspecting && activeIndex !== lastIndex ? (
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="text-xs font-medium text-accent"
            >
              Latest
            </button>
          ) : null}
        </div>
        <p
          className={`mt-0.5 font-mono text-3xl font-semibold ${
            headlineValue < 0 ? "text-expense" : "text-foreground"
          }`}
        >
          {headline}
        </p>
        <p className={`text-sm ${delta < 0 ? "text-expense" : "text-income"}`}>
          {formatSignedMoney(delta)}
          <span className="text-muted">
            {inspecting ? " vs start of range" : " this range"}
          </span>
        </p>
      </div>

      <div
        ref={wrapRef}
        className="relative select-none"
        style={{ touchAction: "none" }}
      >
        <svg
          width={width || "100%"}
          height={height}
          viewBox={width ? `0 0 ${width} ${height}` : undefined}
          aria-hidden
          className="pointer-events-none h-[220px] w-full"
        >
          <defs>
            {layers.map((layer) => (
              <linearGradient
                key={layer.id}
                id={`${gradientId}-${layer.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={layer.color} stopOpacity="0.55" />
                <stop offset="100%" stopColor={layer.color} stopOpacity="0.06" />
              </linearGradient>
            ))}
          </defs>

          {geometry.zeroY != null ? (
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={geometry.zeroY}
              y2={geometry.zeroY}
              stroke="var(--color-border)"
              strokeDasharray="4 4"
            />
          ) : null}

          {stacked.map((layer) => (
            <path
              key={layer.id}
              d={layer.area}
              fill={
                selectedAccount
                  ? `url(#${gradientId}-${layer.id})`
                  : layer.color
              }
              fillOpacity={selectedAccount ? 1 : 0.5}
              stroke="none"
            />
          ))}

          <path
            d={netLine}
            fill="none"
            stroke={
              selectedAccount
                ? (layers[0]?.color ?? "var(--color-accent)")
                : "var(--color-foreground)"
            }
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {inspecting ? (
            <g>
              <line
                x1={activeX}
                x2={activeX}
                y1={pad.t}
                y2={height - pad.b}
                stroke="var(--color-foreground)"
                strokeOpacity={0.55}
                strokeWidth={1.25}
              />
              <circle
                cx={activeX}
                cy={activeY}
                r={5.5}
                fill="var(--color-background)"
                stroke={layers[0]?.color ?? "var(--color-accent)"}
                strokeWidth={2.5}
              />
            </g>
          ) : (
            <circle
              cx={geometry.xAt(lastIndex)}
              cy={geometry.yAt(headlineValue)}
              r={4}
              fill={layers[0]?.color ?? "var(--color-accent)"}
            />
          )}

          {ticks.map((tick) => (
            <text
              key={`${tick.i}-${tick.date}`}
              x={geometry.xAt(tick.i)}
              y={height - 8}
              textAnchor={
                tick.i === 0 ? "start" : tick.i === lastIndex ? "end" : "middle"
              }
              className="fill-muted"
              fontSize="11"
            >
              {formatChartTick(tick.date)}
            </text>
          ))}
        </svg>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Account balance history"
          aria-valuemin={0}
          aria-valuemax={lastIndex}
          aria-valuenow={index}
          aria-valuetext={`${formatChartDate(active!.date)} ${headline}`}
          className="absolute inset-0 cursor-crosshair touch-none outline-none"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            capturing.current = false;
          }}
          onPointerLeave={handlePointerLeave}
          onClick={(event) => inspectAt(event.clientX)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setActiveIndex(Math.max(0, index - 1));
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              setActiveIndex(Math.min(lastIndex, index + 1));
            } else if (event.key === "Escape" || event.key === "Home") {
              setActiveIndex(null);
            } else if (event.key === "End") {
              setActiveIndex(lastIndex);
            }
          }}
        />
      </div>

      <p className="text-center text-[11px] text-muted">
        Drag across the chart to inspect a date
      </p>

      {selectedAccountId === "all" && layers.length > 1 ? (
        <ul className="divide-y divide-border/70">
          {layers.map((layer) => {
            const value = active?.balances[layer.id] ?? 0;
            return (
              <li key={layer.id}>
                <button
                  type="button"
                  onClick={() => onSelectAccount?.(layer.id)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm active:bg-surface-2/60"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: layer.color }}
                    />
                    <span className="truncate">{layer.name}</span>
                  </span>
                  <span
                    className={`shrink-0 font-mono ${
                      value < 0 ? "text-expense" : "text-muted"
                    }`}
                  >
                    {formatAccountBalance(layer.type, value)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
