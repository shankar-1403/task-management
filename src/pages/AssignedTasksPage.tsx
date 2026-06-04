import { useEffect, useMemo, useState, type ReactNode } from "react";
import { IconChecks, IconClock, IconProgress, IconUser } from "@tabler/icons-react";
import type { Project, Task } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeTasks } from "@/services/database";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import { PriorityBadge } from "@/components/PriorityBadge";

interface AssignedTasksPageProps {
  projects: Project[];
}

interface AssigneeProgress {
  key: string;
  label: string;
  open: number;
  completed: number;
  total: number;
}

export function AssignedTasksPage({ projects }: AssignedTasksPageProps) {
  const { user } = useAuth();
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});

  useEffect(() => {
    if (!user || projects.length === 0) {
      setTasksByProject({});
      return;
    }
    const unsubs = projects.map((project) =>
      subscribeTasks(project.id, (tasks) => {
        setTasksByProject((prev) => ({ ...prev, [project.id]: tasks }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [projects, user]);

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, project])),
    [projects],
  );

  const assignedTasks = useMemo(() => {
    if (!user) return [];
    const all = Object.values(tasksByProject).flat();
    return all.filter((task) => {
      if (task.createdBy !== user.uid) return false;
      const ids = task.assigneeIds ?? [];
      return ids.some((id) => id !== user.uid);
    });
  }, [tasksByProject, user]);

  const assigneeProgress = useMemo<AssigneeProgress[]>(() => {
    const grouped = new Map<string, AssigneeProgress>();
    for (const task of assignedTasks) {
      const nameList = (task.assigneeName ?? "").split(", ").filter(Boolean);
      const ids = task.assigneeIds ?? [];
      ids.forEach((uid, index) => {
        if (uid === user?.uid) return;
        const label = nameList[index] ?? uid;
        const existing = grouped.get(uid) ?? {
          key: uid,
          label,
          open: 0,
          completed: 0,
          total: 0,
        };
        existing.total += 1;
        if (task.completed) existing.completed += 1;
        else existing.open += 1;
        grouped.set(uid, existing);
      });
    }
    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  }, [assignedTasks, user?.uid]);

  const stats = useMemo(() => {
    const total = assignedTasks.length;
    const completed = assignedTasks.filter((task) => task.completed).length;
    const open = total - completed;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, open, completed, progress };
  }, [assignedTasks]);

  return (
    <>
      <header className="project-header">
        <div>
          <h1 className="project-title">Assigned by me</h1>
          <p className="page-subtitle">Track progress of tasks you delegated to teammates</p>
        </div>
      </header>

      <div className="board-scroll dashboard-scroll">
        <div className="dashboard-stats">
          <StatCard icon={<IconProgress size={ICON_SIZE.lg} stroke={ICON_STROKE} />} label="Progress" value={`${stats.progress}%`} />
          <StatCard icon={<IconClock size={ICON_SIZE.lg} stroke={ICON_STROKE} />} label="Open" value={stats.open} />
          <StatCard icon={<IconChecks size={ICON_SIZE.lg} stroke={ICON_STROKE} />} label="Completed" value={stats.completed} tone="success" />
          <StatCard icon={<IconUser size={ICON_SIZE.lg} stroke={ICON_STROKE} />} label="Assigned tasks" value={stats.total} />
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h2>Assignee progress</h2>
              <span className="dashboard-panel-meta">{assigneeProgress.length} teammates</span>
            </div>
            {assigneeProgress.length === 0 ? (
              <p className="dashboard-empty">No delegated tasks yet.</p>
            ) : (
              <ul className="assigned-progress-list">
                {assigneeProgress.map((row) => {
                  const percent = row.total === 0 ? 0 : Math.round((row.completed / row.total) * 100);
                  return (
                    <li key={row.key} className="assigned-progress-row">
                      <div className="assigned-progress-header">
                        <span className="assigned-progress-name">{row.label}</span>
                        <span className="assigned-progress-meta">
                          {row.completed}/{row.total} done ({percent}%)
                        </span>
                      </div>
                      <div className="assigned-progress-track">
                        <div className="assigned-progress-fill" style={{ width: `${percent}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h2>Delegated tasks</h2>
              <span className="dashboard-panel-meta">{assignedTasks.length} total</span>
            </div>
            {assignedTasks.length === 0 ? (
              <p className="dashboard-empty">Assign a task to someone to see it here.</p>
            ) : (
              <ul className="dashboard-task-list">
                {assignedTasks.map((task) => (
                  <li key={`${task.projectId}-${task.id}`} className={`dashboard-task-row ${task.completed ? "completed" : ""}`}>
                    <span className="dashboard-task-title">{task.title}</span>
                    <span className="dashboard-task-project">
                      <span className={`project-dot ${projectById[task.projectId]?.color ?? "blue"}`} />
                      {projectById[task.projectId]?.name ?? "Unknown project"}
                    </span>
                    <span className="dashboard-task-project">{task.assigneeName || task.assigneeEmail || "No assignee"}</span>
                    <PriorityBadge task={task} showDateLabel />
                  </li>
                ))}
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
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  tone?: "danger" | "warning" | "success";
}) {
  return (
    <div className={`dashboard-stat ${tone ? `dashboard-stat--${tone}` : ""}`}>
      <span className="dashboard-stat-icon">{icon}</span>
      <span className="dashboard-stat-value">{value}</span>
      <span className="dashboard-stat-label">{label}</span>
    </div>
  );
}
