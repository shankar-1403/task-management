import { useMemo, type ReactNode } from "react";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCheckbox,
  IconClock,
  IconFolder,
} from "@tabler/icons-react";
import type { Project, Task } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useAllMyTasks } from "@/hooks/useAllMyTasks";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import { getTaskPriority } from "@/utils/priority";
import { getTaskEndDate } from "@/utils/taskDates";

interface DashboardPageProps {
  projects: Project[];
  onOpenMyTasks: () => void;
  onOpenCalendar: () => void;
  onSelectProject: (projectId: string) => void;
}

export function DashboardPage({
  projects,
  onOpenMyTasks,
  onOpenCalendar,
  onSelectProject,
}: DashboardPageProps) {
  const { user } = useAuth();
  const { myTasks } = useAllMyTasks(projects, user?.uid);

  const stats = useMemo(() => {
    const open = myTasks.filter((t) => !t.completed);
    const overdue = open.filter((t) => getTaskPriority(t) === "urgent");
    const dueToday = open.filter((t) => getTaskPriority(t) === "high");
    const completed = myTasks.filter((t) => t.completed);
    return {
      open: open.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      completed: completed.length,
      total: myTasks.length,
    };
  }, [myTasks]);

  const upcoming = useMemo(() => {
    return myTasks
      .filter((t) => !t.completed && getTaskEndDate(t))
      .slice(0, 8);
  }, [myTasks]);

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

  return (
    <>
      <header className="project-header">
        <div>
          <h1 className="project-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your assigned work</p>
        </div>
      </header>

      <div className="board-scroll dashboard-scroll">
        <div className="dashboard-stats">
          <StatCard
            icon={<IconCheckbox size={ICON_SIZE.lg} stroke={ICON_STROKE} />}
            label="Open tasks"
            value={stats.open}
            onClick={onOpenMyTasks}
          />
          <StatCard
            icon={<IconAlertTriangle size={ICON_SIZE.lg} stroke={ICON_STROKE} />}
            label="Overdue"
            value={stats.overdue}
            tone="danger"
            onClick={onOpenMyTasks}
          />
          <StatCard
            icon={<IconClock size={ICON_SIZE.lg} stroke={ICON_STROKE} />}
            label="Due today"
            value={stats.dueToday}
            tone="warning"
            onClick={onOpenMyTasks}
          />
          <StatCard
            icon={<IconCalendarEvent size={ICON_SIZE.lg} stroke={ICON_STROKE} />}
            label="Completed"
            value={stats.completed}
            tone="success"
          />
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h2>Upcoming</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenCalendar}>
                Open calendar
              </button>
            </div>
            {upcoming.length === 0 ? (
              <p className="dashboard-empty">No scheduled tasks. Add end dates to see them here.</p>
            ) : (
              <ul className="dashboard-task-list">
                {upcoming.map((task) => (
                  <DashboardTaskRow key={`${task.projectId}-${task.id}`} task={task} project={projectById[task.projectId]} />
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h2>Projects</h2>
              <span className="dashboard-panel-meta">{projects.length} total</span>
            </div>
            {projects.length === 0 ? (
              <p className="dashboard-empty">Create a project to get started.</p>
            ) : (
              <ul className="dashboard-project-list">
                {projects.map((project) => {
                  const count = myTasks.filter(
                    (t) => t.projectId === project.id && !t.completed,
                  ).length;
                  return (
                    <li key={project.id}>
                      <button
                        type="button"
                        className="dashboard-project-btn"
                        onClick={() => onSelectProject(project.id)}
                      >
                        <span className={`project-dot ${project.color}`} />
                        <span className="dashboard-project-name">{project.name}</span>
                        <span className="dashboard-project-count">{count} open</span>
                        <IconFolder size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: "danger" | "warning" | "success";
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`dashboard-stat ${tone ? `dashboard-stat--${tone}` : ""} ${onClick ? "dashboard-stat--clickable" : ""}`}
      onClick={onClick}
    >
      <span className="dashboard-stat-icon">{icon}</span>
      <span className="dashboard-stat-value">{value}</span>
      <span className="dashboard-stat-label">{label}</span>
    </Tag>
  );
}

function DashboardTaskRow({ task, project }: { task: Task; project?: Project }) {
  return (
    <li className={`dashboard-task-row task-row--priority-${getTaskPriority(task)} ${task.completed ? "completed" : ""}`}>
      <span className="dashboard-task-title">{task.title}</span>
      {project && (
        <span className="dashboard-task-project">
          <span className={`project-dot ${project.color}`} />
          {project.name}
        </span>
      )}
      <PriorityBadge task={task} showDateLabel />
    </li>
  );
}
