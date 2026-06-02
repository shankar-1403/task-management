import { useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { Project, Task } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useAllMyTasks } from "@/hooks/useAllMyTasks";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import {
  addMonths,
  buildMonthGrid,
  formatMonthYear,
  getWeekdayLabels,
  toDateKey,
} from "@/utils/calendar";
import { getTaskEndDate, getTaskStartDate } from "@/utils/taskDates";
import { getTaskPriority } from "@/utils/priority";

interface CalendarPageProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
}

export function CalendarPage({ projects, onSelectProject }: CalendarPageProps) {
  const { user } = useAuth();
  const { myTasks } = useAllMyTasks(projects, user?.uid);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() =>
    toDateKey(new Date()),
  );

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of myTasks) {
      const end = getTaskEndDate(task);
      const start = getTaskStartDate(task);
      const key = end ?? start;
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [myTasks]);

  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const weekdays = getWeekdayLabels();

  const selectedTasks = selectedDateKey ? (tasksByDate.get(selectedDateKey) ?? []) : [];

  return (
    <>
      <header className="project-header">
        <div>
          <h1 className="project-title">Calendar</h1>
          <p className="page-subtitle">Tasks by start or end date</p>
        </div>
      </header>

      <div className="board-scroll calendar-scroll">
        <div className="calendar-toolbar">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            aria-label="Previous month"
          >
            <IconChevronLeft size={ICON_SIZE.md} stroke={ICON_STROKE} className="app-icon app-icon--md" />
          </button>
          <h2 className="calendar-month-label">{formatMonthYear(month)}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <IconChevronRight size={ICON_SIZE.md} stroke={ICON_STROKE} className="app-icon app-icon--md" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm calendar-today-btn"
            onClick={() => {
              const today = new Date();
              today.setDate(1);
              setMonth(today);
              setSelectedDateKey(toDateKey(new Date()));
            }}
          >
            Today
          </button>
        </div>

        <div className="calendar-layout">
          <div className="calendar-grid-wrap">
            <div className="calendar-weekdays">
              {weekdays.map((label) => (
                <span key={label} className="calendar-weekday">
                  {label}
                </span>
              ))}
            </div>
            <div className="calendar-grid">
              {grid.map((day) => {
                const dayTasks = tasksByDate.get(day.dateKey) ?? [];
                const isSelected = selectedDateKey === day.dateKey;
                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    className={`calendar-day ${!day.inCurrentMonth ? "calendar-day--muted" : ""} ${day.isToday ? "calendar-day--today" : ""} ${isSelected ? "calendar-day--selected" : ""}`}
                    onClick={() => setSelectedDateKey(day.dateKey)}
                  >
                    <span className="calendar-day-num">{day.date.getDate()}</span>
                    {dayTasks.length > 0 && (
                      <span className="calendar-day-dots" aria-hidden>
                        {dayTasks.slice(0, 3).map((task) => (
                          <span
                            key={`${task.projectId}-${task.id}`}
                            className={`calendar-dot priority-dot--${getTaskPriority(task)}`}
                          />
                        ))}
                      </span>
                    )}
                    {dayTasks.length > 3 && (
                      <span className="calendar-day-more">+{dayTasks.length - 3}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="calendar-sidebar">
            <h3 className="calendar-sidebar-title">
              {selectedDateKey
                ? parseDateKeyLabel(selectedDateKey)
                : "Select a day"}
            </h3>
            {selectedTasks.length === 0 ? (
              <p className="dashboard-empty">No tasks on this day.</p>
            ) : (
              <ul className="calendar-day-tasks">
                {selectedTasks.map((task) => {
                  const project = projectById[task.projectId];
                  return (
                    <li key={`${task.projectId}-${task.id}`}>
                      <button
                        type="button"
                        className={`calendar-task-card ${task.completed ? "completed" : ""}`}
                        onClick={() => onSelectProject(task.projectId)}
                      >
                        <span className="calendar-task-title">{task.title}</span>
                        {project && (
                          <span className="calendar-task-project">
                            <span className={`project-dot ${project.color}`} />
                            {project.name}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function parseDateKeyLabel(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
