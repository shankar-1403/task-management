import { useEffect, useMemo, useState } from "react";
import type { Project, Section, Task } from "@/types";
import { subscribeSections, subscribeTasks, updateTask } from "@/services/database";
import { useAuth } from "@/contexts/AuthContext";
import { initials } from "@/utils/avatar";
import { setTaskCompletedInProject } from "@/utils/moveTask";
import { getTaskPriority, sortTasksByPriority } from "@/utils/priority";
import { PriorityBadge } from "@/components/PriorityBadge";

interface MyTasksViewProps {
  projects: Project[];
}

export function MyTasksView({ projects }: MyTasksViewProps) {
  const { user } = useAuth();
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [sectionsByProject, setSectionsByProject] = useState<Record<string, Section[]>>({});

  useEffect(() => {
    if (projects.length === 0) {
      setTasksByProject({});
      setSectionsByProject({});
      return;
    }
    const taskUnsubs = projects.map((project) =>
      subscribeTasks(project.id, (tasks) => {
        setTasksByProject((prev) => ({ ...prev, [project.id]: tasks }));
      }),
    );
    const sectionUnsubs = projects.map((project) =>
      subscribeSections(project.id, (sections) => {
        setSectionsByProject((prev) => ({ ...prev, [project.id]: sections }));
      }),
    );
    return () => {
      taskUnsubs.forEach((u) => u());
      sectionUnsubs.forEach((u) => u());
    };
  }, [projects]);

  async function handleToggleComplete(task: Task) {
    const projectTasks = tasksByProject[task.projectId] ?? [];
    const projectSections = sectionsByProject[task.projectId] ?? [];
    await setTaskCompletedInProject(
      task.projectId,
      projectTasks,
      projectSections,
      task.id,
      !task.completed,
      updateTask,
    );
  }

  const myTasks = useMemo(() => {
    const combined = Object.values(tasksByProject).flat();
    return sortTasksByPriority(combined.filter((t) => t.assigneeId === user?.uid));
  }, [tasksByProject, user?.uid]);

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

  const hasOpenTasks = myTasks.some((t) => !t.completed);

  return (
    <>
      <header className="project-header">
        <div className="project-title-row">
          <h1 className="project-title">My tasks</h1>
        </div>
      </header>
      <div className="board-scroll my-tasks-scroll">
        {myTasks.length === 0 ? (
          <div className="empty-state">
            No tasks assigned to you yet. Open a project and assign yourself a task.
          </div>
        ) : (
          <table className="task-table my-tasks-table">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Task</th>
                <th style={{ width: 100 }}>Priority</th>
                <th style={{ width: 160 }}>Project</th>
                <th style={{ width: 130 }}>Due</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {myTasks.map((task) => {
                const project = projectById[task.projectId];
                return (
                  <tr
                    key={task.id}
                    className={`task-row task-row--priority-${getTaskPriority(task)} ${task.completed ? "completed" : ""}`}
                  >
                    <td style={{ width: 36 }}>
                      <button
                        type="button"
                        className={`task-checkbox ${task.completed ? "checked" : ""}`}
                        onClick={() => void handleToggleComplete(task)}
                        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        {task.completed ? "✓" : ""}
                      </button>
                    </td>
                    <td>
                      <span className="task-title-btn" style={{ cursor: "default" }}>
                        {task.title}
                      </span>
                    </td>
                    <td>
                      <PriorityBadge task={task} showDueLabel={false} />
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {project && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span className={`project-dot ${project.color}`} />
                          {project.name}
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        type="date"
                        className="task-inline-date"
                        value={task.dueDate ?? ""}
                        onChange={(e) =>
                          void updateTask(task.projectId, task.id, {
                            dueDate: e.target.value || null,
                          })
                        }
                        aria-label="Due date"
                      />
                    </td>
                    <td style={{ width: 40 }}>
                      {user && (
                        <span className="avatar" title={user.displayName}>
                          {initials(user.displayName)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {myTasks.length > 0 && !hasOpenTasks && (
          <p className="my-tasks-all-done">All your assigned tasks are complete.</p>
        )}
      </div>
    </>
  );
}

export function useMyTasksCount(projects: Project[], userId: string | undefined): number {
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});

  useEffect(() => {
    if (!userId || projects.length === 0) {
      setTasksByProject({});
      return;
    }
    const unsubs = projects.map((project) =>
      subscribeTasks(project.id, (tasks) => {
        setTasksByProject((prev) => ({ ...prev, [project.id]: tasks }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [projects, userId]);

  return useMemo(() => {
    return Object.values(tasksByProject)
      .flat()
      .filter((t) => t.assigneeId === userId && !t.completed).length;
  }, [tasksByProject, userId]);
}
