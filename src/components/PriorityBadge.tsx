import { getPriorityLabel, getTaskPriority, type TaskPriority } from "@/utils/priority";
import { formatDateRangeLabel, getTaskEndDate } from "@/utils/taskDates";
import type { Task } from "@/types";

interface PriorityBadgeProps {
  task: Pick<Task, "startDate" | "endDate" | "dueDate" | "completed">;
  showDateLabel?: boolean;
}

export function PriorityBadge({ task, showDateLabel = true }: PriorityBadgeProps) {
  const priority = getTaskPriority(task);
  const endDate = getTaskEndDate(task);
  if (priority === "none" && !endDate && !task.startDate) return null;

  return (
    <span className={`priority-badge priority-badge--${priority}`}>
      <span className="priority-badge-level">{getPriorityLabel(priority)}</span>
      {showDateLabel && (endDate || task.startDate) && (
        <span className="priority-badge-due">{formatDateRangeLabel(task)}</span>
      )}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: TaskPriority }) {
  if (priority === "none") return null;
  return <span className={`priority-dot priority-dot--${priority}`} title={getPriorityLabel(priority)} />;
}
