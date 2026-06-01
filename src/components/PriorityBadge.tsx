import {
  formatDueDateLabel,
  getPriorityLabel,
  getTaskPriority,
  type TaskPriority,
} from "@/utils/priority";
import type { Task } from "@/types";

interface PriorityBadgeProps {
  task: Pick<Task, "dueDate" | "completed">;
  showDueLabel?: boolean;
}

export function PriorityBadge({ task, showDueLabel = true }: PriorityBadgeProps) {
  const priority = getTaskPriority(task);
  if (priority === "none" && !task.dueDate) return null;

  return (
    <span className={`priority-badge priority-badge--${priority}`}>
      <span className="priority-badge-level">{getPriorityLabel(priority)}</span>
      {showDueLabel && task.dueDate && (
        <span className="priority-badge-due">{formatDueDateLabel(task.dueDate)}</span>
      )}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: TaskPriority }) {
  if (priority === "none") return null;
  return <span className={`priority-dot priority-dot--${priority}`} title={getPriorityLabel(priority)} />;
}
