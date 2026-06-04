import { useState } from "react";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import type { MyTasksSection, Project, Task } from "@/types";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import { useAuth } from "@/contexts/AuthContext";
import { initials } from "@/utils/avatar";
import { getTaskPriority } from "@/utils/priority";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TaskDateFields } from "@/components/TaskDateFields";
import { updateTask } from "@/services/database";
import { isFixedMyTasksSection } from "@/utils/myTasksSections";

interface MyTasksSectionBlockProps {
  section: MyTasksSection;
  tasks: Task[];
  projects: Project[];
  projectById: Record<string, Project>;
  onToggleComplete: (task: Task) => void;
  onAddTask: (projectId: string, title: string) => Promise<void>;
  onDeleteSection?: () => void;
}

export function MyTasksSectionBlock({
  section,
  tasks,
  projects,
  projectById,
  onToggleComplete,
  onAddTask,
  onDeleteSection,
}: MyTasksSectionBlockProps) {
  const { user } = useAuth();
  const [newTitle, setNewTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [adding, setAdding] = useState(false);

  const isFixed = isFixedMyTasksSection(section.id);

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title || !projectId) return;
    setAdding(true);
    try {
      await onAddTask(projectId, title);
      setNewTitle("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="my-tasks-panel">
      {!isFixed && onDeleteSection && (
        <div className="my-tasks-panel-toolbar">
          <span className="my-tasks-section-pill">Custom section</span>
          <button
            type="button"
            className="btn btn-ghost btn-icon my-tasks-section-delete"
            onClick={onDeleteSection}
            aria-label={`Delete section ${section.name}`}
          >
            <IconX size={ICON_SIZE.md} stroke={ICON_STROKE} className="app-icon app-icon--md" />
          </button>
        </div>
      )}
      {isFixed && (
        <p className="my-tasks-panel-hint">Tasks mirror your project board columns.</p>
      )}

      <div className="my-tasks-section-body">
        {tasks.length === 0 ? (
          <p className="my-tasks-section-empty">No tasks in this section.</p>
        ) : (
          <table className="task-table my-tasks-table">
            <tbody>
              {tasks.map((task) => {
                const project = projectById[task.projectId];
                return (
                  <tr
                    key={`${task.projectId}-${task.id}`}
                    className={`task-row task-row--priority-${getTaskPriority(task)} ${task.completed ? "completed" : ""}`}
                  >
                    <td style={{ width: 36 }}>
                      <button
                        type="button"
                        className={`task-checkbox ${task.completed ? "checked" : ""}`}
                        onClick={() => onToggleComplete(task)}
                        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        {task.completed && (
                          <IconCheck size={12} stroke={2.5} className="app-icon" aria-hidden />
                        )}
                      </button>
                    </td>
                    <td>
                      <span className="task-title-btn">{task.title}</span>
                    </td>
                    <td style={{ width: 100 }}>
                      <PriorityBadge task={task} showDateLabel={false} />
                    </td>
                    <td style={{ width: 160 }}>
                      {project && (
                        <span className="my-tasks-project-label">
                          <span className={`project-dot ${project.color}`} />
                          {project.name}
                        </span>
                      )}
                    </td>
                    <td style={{ width: 200 }}>
                      <TaskDateFields
                        startDate={task.startDate}
                        endDate={task.endDate}
                        completed={task.completed}
                        layout="row"
                        size="compact"
                        onChange={(patch) => void updateTask(task.projectId, task.id, patch)}
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

        {projects.length > 0 && (
          <div className="my-tasks-add-row">
            <select
              className="my-tasks-project-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label="Project"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              className="my-tasks-add-input"
              placeholder="Add task…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd();
              }}
              disabled={adding}
            />
            <button
              type="button"
              className="btn btn-primary btn-with-icon my-tasks-add-btn"
              onClick={() => void handleAdd()}
              disabled={adding || !newTitle.trim() || !projectId}
            >
              <IconPlus size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
