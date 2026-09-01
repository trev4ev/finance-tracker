export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function shortMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-US", {
    month: "short",
  });
}

export function formatDisplayDate(iso: string): string {
  const [year, m, d] = iso.split("-").map(Number);
  return new Date(year, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDayHeading(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toISODate(yesterday)) return "Yesterday";
  const [year, m, d] = iso.split("-").map(Number);
  const nowYear = new Date().getFullYear();
  return new Date(year, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(year === nowYear ? {} : { year: "numeric" }),
  });
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function lastNMonths(n: number, endMonth = currentMonth()): string[] {
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    months.push(addMonths(endMonth, -i));
  }
  return months;
}

export function daysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m, 0).getDate();
}

export function monthDateRange(month: string): { from: string; to: string } {
  const days = String(daysInMonth(month)).padStart(2, "0");
  return { from: `${month}-01`, to: `${month}-${days}` };
}

export function datesInMonth(month: string): string[] {
  const { from, to } = monthDateRange(month);
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function formatChartDay(iso: string): string {
  return String(parseISODate(iso).getDate());
}

export function formatRelativeTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const deltaMs = Date.now() - date.getTime();
  if (deltaMs < 45_000) return "just now";
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function parseISODate(iso: string): Date {
  const [year, m, d] = iso.split("-").map(Number);
  return new Date(year, m - 1, d);
}

export function addDays(iso: string, delta: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + delta);
  return toISODate(date);
}

export function daysBetween(from: string, to: string): number {
  const start = parseISODate(from).getTime();
  const end = parseISODate(to).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function formatChartTick(iso: string): string {
  const date = parseISODate(iso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatChartDate(iso: string): string {
  if (iso === todayISO()) return "Today";
  const date = parseISODate(iso);
  const nowYear = new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === nowYear ? {} : { year: "numeric" }),
  });
}
