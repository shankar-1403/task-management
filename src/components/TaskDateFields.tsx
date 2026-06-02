import { IconCalendar } from "@tabler/icons-react";
import { isInvalidDateRange, isOverdueEndDate } from "@/utils/taskDates";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";

interface TaskDateFieldsProps {
  startDate: string | null;
  endDate: string | null;
  completed?: boolean;
  onChange: (patch: { startDate?: string | null; endDate?: string | null }) => void;
  layout?: "row" | "stack";
  size?: "default" | "compact";
}

export function TaskDateFields({
  startDate,
  endDate,
  completed = false,
  onChange,
  layout = "row",
  size = "default",
}: TaskDateFieldsProps) {
  const invalid = isInvalidDateRange(startDate, endDate);
  const overdue = isOverdueEndDate(endDate, completed);

  return (
    <div
      className={`task-date-fields task-date-fields--${layout} task-date-fields--${size} ${invalid ? "task-date-fields--invalid" : ""}`}
    >
      <div className="task-date-field">
        <label className="task-date-label">
          <IconCalendar size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
          Start
        </label>
        <input
          type="date"
          className="task-card-date"
          value={startDate ?? ""}
          onChange={(e) => onChange({ startDate: e.target.value || null })}
          aria-label="Start date"
        />
      </div>
      <div className="task-date-field">
        <label className="task-date-label">
          <IconCalendar size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
          End
        </label>
        <input
          type="date"
          className={`task-card-date ${overdue ? "overdue" : ""}`}
          value={endDate ?? ""}
          min={startDate ?? undefined}
          onChange={(e) => onChange({ endDate: e.target.value || null })}
          aria-label="End date"
        />
      </div>
      {invalid && (
        <span className="task-date-error" role="alert">
          End date must be on or after start date
        </span>
      )}
    </div>
  );
}
