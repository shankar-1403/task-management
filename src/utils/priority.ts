import type { Task } from "@/types";

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
  none: "No date",
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getTaskPriority(task: Pick<Task, "dueDate" | "completed">): TaskPriority {
  if (task.completed || !task.dueDate) return "none";

  const today = startOfDay(new Date());
  const due = startOfDay(new Date(`${task.dueDate}T00:00:00`));
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

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

export function formatDueDateLabel(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(`${dueDate}T00:00:00`));
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function compareTasksByPriority(a: Task, b: Task): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;

  const priorityDiff =
    getPriorityRank(getTaskPriority(a)) - getPriorityRank(getTaskPriority(b));
  if (priorityDiff !== 0) return priorityDiff;

  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;

  return a.order - b.order;
}

export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort(compareTasksByPriority);
}
