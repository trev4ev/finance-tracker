"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { todayISO } from "@/lib/dates";
import { formatMoney, formatSignedMoney } from "@/lib/money";

export type CashFlowPoint = {
  key: string;
  label: string;
  title: string;
  income: number;
  expenses: number;
  net: number;
};

export function CashFlowChart({
  series,
}: {
  series: CashFlowPoint[];
}) {
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

  const lastIndex = Math.max(0, series.length - 1);
  const defaultIndex = useMemo(() => {
    const today = todayISO();
    const todayIndex = series.findIndex((row) => row.key === today);
    return todayIndex >= 0 ? todayIndex : lastIndex;
  }, [lastIndex, series]);
  const index = activeIndex ?? defaultIndex;
  const active = series[index];
  const inspecting = activeIndex !== null;

  const height = 196;
  const pad = { l: 4, r: 4, t: 12, b: 28 };
  const innerW = Math.max(1, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;

  const max = useMemo(() => {
    return Math.max(
      1,
      ...series.flatMap((row) => [row.income, row.expenses]),
    );
  }, [series]);

  const colW = series.length === 0 ? innerW : innerW / series.length;
  const barW = Math.max(
    2,
    Math.min(14, colW * (series.length > 12 ? 0.32 : 0.28)),
  );
  const gap = Math.max(1, Math.min(4, barW * 0.35));
  const xCenter = (i: number) => pad.l + colW * i + colW / 2;

  const ticks = useMemo(() => {
    if (series.length === 0) return [];
    if (series.length <= 8) {
      return series.map((row, i) => ({ i, label: row.label }));
    }
    const mid = Math.round((series.length - 1) / 2);
    return [
      { i: 0, label: series[0]!.label },
      { i: mid, label: series[mid]!.label },
      { i: lastIndex, label: series[lastIndex]!.label },
    ];
  }, [lastIndex, series]);

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const el = wrapRef.current;
      if (!el || series.length === 0) return lastIndex;
      const rect = el.getBoundingClientRect();
      const t = (clientX - rect.left - pad.l) / innerW;
      const clamped = Math.min(0.999, Math.max(0, t));
      return Math.floor(clamped * series.length);
    },
    [innerW, lastIndex, pad.l, series.length],
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

  if (series.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Add income and expenses to see cash flow.
      </p>
    );
  }

  const activeX = xCenter(index);
  const headline = active?.net ?? 0;

  return (
    <div className="space-y-3">
      <div aria-live="polite" className="min-h-[4.5rem]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {active?.title ?? "Cash flow"}
          </p>
          {inspecting && activeIndex !== defaultIndex ? (
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
            headline < 0 ? "text-expense" : "text-foreground"
          }`}
        >
          {formatMoney(headline)}
        </p>
        <p className="text-sm">
          <span className="text-income">
            {formatSignedMoney(active?.income ?? 0)}
          </span>
          <span className="text-muted"> in </span>
          <span className="text-expense">
            {formatSignedMoney(-(active?.expenses ?? 0))}
          </span>
          <span className="text-muted"> out</span>
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
          className="pointer-events-none h-[196px] w-full"
        >
          {inspecting ? (
            <rect
              x={pad.l + colW * index}
              y={pad.t}
              width={colW}
              height={innerH}
              fill="var(--color-foreground)"
              fillOpacity={0.06}
              rx={4}
            />
          ) : null}

          {series.map((row, i) => {
            const cx = xCenter(i);
            const incomeH =
              row.income > 0 ? Math.max(2, (row.income / max) * innerH) : 0;
            const expenseH =
              row.expenses > 0 ? Math.max(2, (row.expenses / max) * innerH) : 0;
            const selected = i === index && inspecting;
            return (
              <g key={row.key}>
                <rect
                  x={cx - barW - gap / 2}
                  y={pad.t + innerH - incomeH}
                  width={barW}
                  height={incomeH}
                  rx={2}
                  fill="var(--color-income)"
                  fillOpacity={selected || !inspecting ? 0.9 : 0.45}
                />
                <rect
                  x={cx + gap / 2}
                  y={pad.t + innerH - expenseH}
                  width={barW}
                  height={expenseH}
                  rx={2}
                  fill="var(--color-expense)"
                  fillOpacity={selected || !inspecting ? 0.9 : 0.45}
                />
              </g>
            );
          })}

          {inspecting ? (
            <line
              x1={activeX}
              x2={activeX}
              y1={pad.t}
              y2={height - pad.b}
              stroke="var(--color-foreground)"
              strokeOpacity={0.45}
              strokeWidth={1.25}
            />
          ) : null}

          {ticks.map((tick) => (
            <text
              key={`${tick.i}-${tick.label}`}
              x={xCenter(tick.i)}
              y={height - 8}
              textAnchor={
                tick.i === 0
                  ? "start"
                  : tick.i === lastIndex
                    ? "end"
                    : "middle"
              }
              className="fill-muted"
              fontSize="11"
            >
              {tick.label}
            </text>
          ))}
        </svg>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Cash flow"
          aria-valuemin={0}
          aria-valuemax={lastIndex}
          aria-valuenow={index}
          aria-valuetext={
            active
              ? `${active.title} net ${formatMoney(active.net)}`
              : undefined
          }
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
        Drag across the chart to inspect a{" "}
        {series.length > 12 ? "day" : "month"}
      </p>
    </div>
  );
}
