import type { Task } from "@/types";

/** Supports legacy tasks that only have `dueDate` stored as end date. */
export function getTaskEndDate(task: {
  endDate?: string | null;
  dueDate?: string | null;
}): string | null {
  return task.endDate ?? task.dueDate ?? null;
}

export function getTaskStartDate(task: {
  startDate?: string | null;
}): string | null {
  return task.startDate ?? null;
}

export function isOverdueEndDate(
  endDate: string | null,
  completed: boolean,
): boolean {
  if (!endDate || completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${endDate}T00:00:00`) < today;
}

export function isInvalidDateRange(
  startDate: string | null,
  endDate: string | null,
): boolean {
  if (!startDate || !endDate) return false;
  return startDate > endDate;
}

export function formatShortDate(date: string | null): string {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatDateRangeLabel(
  task: Pick<Task, "startDate" | "endDate" | "dueDate">,
): string {
  const start = getTaskStartDate(task);
  const end = getTaskEndDate(task);
  if (start && end) return `${formatShortDate(start)} → ${formatShortDate(end)}`;
  if (end) return `Ends ${formatShortDate(end)}`;
  if (start) return `Starts ${formatShortDate(start)}`;
  return "No dates";
}

export type TaskForPriority = Pick<Task, "startDate" | "endDate" | "dueDate" | "completed">;
