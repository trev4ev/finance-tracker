"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Children,
  isValidElement,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  daysInMonth,
  formatDisplayDate,
  monthLabel,
  todayISO,
} from "@/lib/dates";

type Tone = "surface" | "raised";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function triggerClass(tone: Tone, open: boolean) {
  const bg = tone === "surface" ? "bg-surface" : "bg-surface-2";
  return `flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm outline-none ${bg} ${
    open ? "border-accent" : "border-border focus:border-accent"
  }`;
}

function emitChange(
  onChange: ((event: { target: { value: string } }) => void) | undefined,
  value: string,
) {
  onChange?.({ target: { value } });
}

function optionsFromChildren(children: React.ReactNode) {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: React.ReactNode }>(child)) {
      return [];
    }
    if (typeof child.type !== "string" || child.type !== "option") return [];
    return [
      {
        value: String(child.props.value ?? ""),
        label: String(child.props.children ?? ""),
      },
    ];
  });
}

function usePopover() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    width: 256,
    maxHeight: 280,
  });

  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(rect.width, 256);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      const panelHeight = 320;
      const openUp =
        window.innerHeight - rect.bottom < panelHeight && rect.top > panelHeight;
      const top = openUp
        ? Math.max(8, rect.top - panelHeight - 6)
        : Math.min(rect.bottom + 6, window.innerHeight - 8);
      const maxHeight = openUp
        ? Math.min(320, rect.top - 16)
        : Math.min(320, window.innerHeight - rect.bottom - 16);
      setCoords({
        top,
        left: Math.max(8, left),
        width,
        maxHeight: Math.max(160, maxHeight),
      });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  return { triggerRef, panelRef, open, setOpen, coords };
}

function PopoverLayer({
  coords,
  panelRef,
  labelledBy,
  role,
  listId,
  ariaLabel,
  onClose,
  children,
}: {
  coords: { top: number; left: number; width: number; maxHeight: number };
  panelRef: React.RefObject<HTMLDivElement | null>;
  labelledBy?: string;
  role: "listbox" | "dialog";
  listId?: string;
  ariaLabel?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[79]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id={listId}
        role={role}
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
        data-popover=""
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
          maxHeight: coords.maxHeight,
        }}
        className="fixed z-[80] overflow-y-auto rounded-xl border border-border bg-surface-2 p-1 shadow-2xl"
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export function NativeSelect({
  children,
  className,
  tone = "raised",
  value,
  onChange,
  disabled,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
  value?: string | number | readonly string[];
  onChange?: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  id?: string;
}) {
  const listId = useId();
  const { triggerRef, panelRef, open, setOpen, coords } = usePopover();
  const options = useMemo(() => optionsFromChildren(children), [children]);
  const selected = String(value ?? "");
  const label = options.find((option) => option.value === selected)?.label ?? "Select";

  return (
    <div className={`relative min-w-0 ${className ?? "w-full"}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={triggerClass(tone, open)}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={16} className={`shrink-0 text-muted ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <PopoverLayer
          coords={coords}
          panelRef={panelRef}
          role="listbox"
          listId={listId}
          onClose={() => setOpen(false)}
        >
          {options.map((option) => {
            const active = option.value === selected;
            return (
              <button
                key={option.value || option.label}
                type="button"
                role="option"
                aria-selected={active}
                className={`flex w-full rounded-lg px-3 py-2 text-left text-sm ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-foreground hover:bg-surface"
                }`}
                onClick={() => {
                  emitChange(onChange, option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </PopoverLayer>
      ) : null}
    </div>
  );
}

export function NativeDateInput({
  className,
  tone = "raised",
  value,
  onChange,
  disabled,
  id,
  allowEmpty = false,
}: {
  className?: string;
  tone?: Tone;
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  id?: string;
  allowEmpty?: boolean;
}) {
  const { triggerRef, panelRef, open, setOpen, coords } = usePopover();
  const selected = value ?? "";
  const [viewMonth, setViewMonth] = useState(() =>
    (selected || todayISO()).slice(0, 7),
  );

  useEffect(() => {
    if (open) setViewMonth((selected || todayISO()).slice(0, 7));
  }, [open, selected]);

  const [year, month] = viewMonth.split("-").map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const count = daysInMonth(viewMonth);
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: count }, (_, index) => index + 1),
  ];

  return (
    <div className={`relative min-w-0 ${className ?? "w-full"}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={triggerClass(tone, open)}
      >
        <span className={selected ? "truncate" : "truncate text-muted"}>
          {selected ? formatDisplayDate(selected) : "Any date"}
        </span>
        <Calendar size={16} className="shrink-0 text-muted" />
      </button>
      {open ? (
        <PopoverLayer
          coords={{ ...coords, width: Math.max(coords.width, 280) }}
          panelRef={panelRef}
          role="dialog"
          ariaLabel="Choose date"
          onClose={() => setOpen(false)}
        >
          <div className="p-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                className="rounded-lg p-1 text-muted hover:bg-surface hover:text-foreground"
                onClick={() => setViewMonth(addMonths(viewMonth, -1))}
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm font-medium">{monthLabel(viewMonth)}</p>
              <button
                type="button"
                aria-label="Next month"
                className="rounded-lg p-1 text-muted hover:bg-surface hover:text-foreground"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] tracking-wide text-muted uppercase">
              {WEEKDAYS.map((day) => (
                <span key={day} className="py-1">
                  {day}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((day, index) => {
                if (day == null) {
                  return <span key={`empty-${index}`} />;
                }
                const iso = `${viewMonth}-${String(day).padStart(2, "0")}`;
                const isSelected = iso === selected;
                const isToday = iso === todayISO();
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`h-8 rounded-lg text-sm ${
                      isSelected
                        ? "bg-accent font-medium text-background"
                        : isToday
                          ? "text-accent hover:bg-surface"
                          : "text-foreground hover:bg-surface"
                    }`}
                    onClick={() => {
                      emitChange(onChange, iso);
                      setOpen(false);
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            {allowEmpty ? (
              <button
                type="button"
                className="mt-2 w-full rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface hover:text-foreground"
                onClick={() => {
                  emitChange(onChange, "");
                  setOpen(false);
                }}
              >
                Clear date
              </button>
            ) : null}
          </div>
        </PopoverLayer>
      ) : null}
    </div>
  );
}
