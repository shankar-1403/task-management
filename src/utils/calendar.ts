export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  return startOfDay(new Date(`${key}T00:00:00`));
}

export function addMonths(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return d;
}

export interface CalendarDay {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getWeekdayLabels(): string[] {
  return WEEKDAY_LABELS;
}

/** Build a 6-row month grid (Sun–Sat) including leading/trailing days. */
export function buildMonthGrid(month: Date): CalendarDay[] {
  const todayKey = toDateKey(new Date());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, monthIndex, 1 - startOffset);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const dateKey = toDateKey(date);
    days.push({
      date,
      dateKey,
      inCurrentMonth: date.getMonth() === monthIndex,
      isToday: dateKey === todayKey,
    });
  }
  return days;
}

export function formatMonthYear(month: Date): string {
  return month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
