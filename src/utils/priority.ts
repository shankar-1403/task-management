import type { Task } from "@/types";
import { getTaskEndDate, type TaskForPriority } from "@/utils/taskDates";

export type TaskPriority = "urgent" | "high" | "medium" | "low" | "none";

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No end date",
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getTaskPriority(task: TaskForPriority): TaskPriority {
  const endDate = getTaskEndDate(task);
  if (task.completed || !endDate) return "none";

  const today = startOfDay(new Date());
  const end = startOfDay(new Date(`${endDate}T00:00:00`));
  const diffDays = Math.round((end.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return "urgent";
  if (diffDays === 0) return "high";
  if (diffDays <= 3) return "medium";
  return "low";
}

export function getPriorityLabel(priority: TaskPriority): string {
  return PRIORITY_LABELS[priority];
}

export function getPriorityRank(priority: TaskPriority): number {
  return PRIORITY_RANK[priority];
}

export function isHighOrUrgentPriority(priority: TaskPriority): boolean {
  return priority === "high" || priority === "urgent";
}

/** True when priority newly becomes high or urgent (e.g. end date is today or overdue). */
export function escalatedToHighOrUrgent(
  previous: TaskPriority,
  next: TaskPriority,
): boolean {
  return isHighOrUrgentPriority(next) && !isHighOrUrgentPriority(previous);
}

export function formatEndDateLabel(endDate: string | null): string {
  if (!endDate) return "No end date";
  const today = startOfDay(new Date());
  const end = startOfDay(new Date(`${endDate}T00:00:00`));
  const diffDays = Math.round((end.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Ends today";
  if (diffDays === 1) return "Ends tomorrow";
  if (diffDays <= 7) return `Ends in ${diffDays}d`;
  return end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function compareTasksByPriority(a: Task, b: Task): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;

  const priorityDiff =
    getPriorityRank(getTaskPriority(a)) - getPriorityRank(getTaskPriority(b));
  if (priorityDiff !== 0) return priorityDiff;

  const endA = getTaskEndDate(a);
  const endB = getTaskEndDate(b);
  if (endA && endB) return endA.localeCompare(endB);
  if (endA) return -1;
  if (endB) return 1;

  return a.order - b.order;
}

export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort(compareTasksByPriority);
}
