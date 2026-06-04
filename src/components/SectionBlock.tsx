import { useState, type DragEvent } from "react";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import type { AssigneeOption, Section, Task } from "@/types";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import { AssigneeMultiSelect } from "@/components/AssigneeMultiSelect";
import { initials } from "@/utils/avatar";
import { buildAssigneePatch, formatAssigneeSummary } from "@/utils/taskAssignees";
import { getTaskDragId, setTaskDragData } from "@/utils/moveTask";
import { getTaskPriority } from "@/utils/priority";
import { createTask } from "@/services/database";
import { useAuth } from "@/contexts/AuthContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TaskDateFields } from "@/components/TaskDateFields";

interface SectionBlockProps {
  section: Section;
  tasks: Task[];
  assignees: AssigneeOption[];
  assigneesLoading?: boolean;
  projectId: string;
  draggingTaskId: string | null;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDropTask: (taskId: string, sectionId: string) => void;
  onSelectTask: (task: Task) => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => Promise<void>;
  onToggleComplete: (taskId: string, completed: boolean) => void;
}

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(
    "button, select, input, textarea, a, option, label, .assignee-multi",
  );
}

function startTaskDrag(e: DragEvent, taskId: string, onDragStart: (id: string) => void): void {
  if (isInteractiveDragTarget(e.target)) {
    e.preventDefault();
    return;
  }
  setTaskDragData(e.dataTransfer, taskId);
  onDragStart(taskId);
  if (e.currentTarget instanceof HTMLElement) {
    e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
  }
}

export function SectionBlock({
  section,
  tasks,
  assignees,
  assigneesLoading = false,
  projectId,
  draggingTaskId,
  onDragStart,
  onDragEnd,
  onDropTask,
  onSelectTask,
  onUpdateTask,
  onToggleComplete,
}: SectionBlockProps) {
  const { user } = useAuth();
  const [newTitle, setNewTitle] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleAddTask() {
    const title = newTitle.trim();
    if (!title || !user) return;
    setAdding(true);
    try {
      await createTask(projectId, {
        sectionId: section.id,
        title,
        description: "",
        completed: false,
        assigneeIds: [],
        assigneeId: null,
        assigneeName: null,
        assigneeEmail: null,
        startDate: newStartDate || null,
        endDate: newEndDate || null,
        order: tasks.length,
        createdBy: user.uid,
      });
      setNewTitle("");
      setNewStartDate("");
      setNewEndDate("");
    } finally {
      setAdding(false);
    }
  }

  const canDrop = draggingTaskId !== null && !tasks.some((t) => t.id === draggingTaskId);

  function handleDragOver(e: DragEvent) {
    if (!draggingTaskId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (canDrop) setDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const taskId = getTaskDragId(e.dataTransfer);
    if (taskId) onDropTask(taskId, section.id);
  }

  return (
    <section className="board-column">
      <header className="board-column-header">
        <h2 className="board-column-title">{section.name}</h2>
        <span className="section-count">{tasks.length}</span>
      </header>

      <div
        className={`board-column-body ${dragOver && canDrop ? "board-column-body--drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="board-column-tasks">
          {tasks.map((task) => {
            const isDragging = draggingTaskId === task.id;
            const priority = getTaskPriority(task);
            return (
              <article
                key={task.id}
                draggable
                className={`task-card task-card--draggable task-card--priority-${priority} ${task.completed ? "completed" : ""} ${isDragging ? "task-card--dragging" : ""}`}
                onDragStart={(e) => startTaskDrag(e, task.id, onDragStart)}
                onDragEnd={onDragEnd}
              >
                <div className="task-card-top">
                  <PriorityBadge task={task} />
                </div>
                <div className="task-card-main">
                  <button
                    type="button"
                    className={`task-checkbox ${task.completed ? "checked" : ""}`}
                    onClick={() => onToggleComplete(task.id, !task.completed)}
                    aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                  >
                    {task.completed && (
                      <IconCheck size={12} stroke={2.5} className="app-icon" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    className="task-title-btn"
                    onClick={() => onSelectTask(task)}
                  >
                    {task.title}
                  </button>
                </div>
                <div className="task-card-meta">
                  <TaskDateFields
                    startDate={task.startDate}
                    endDate={task.endDate}
                    completed={task.completed}
                    layout="row"
                    size="compact"
                    onChange={(patch) => void onUpdateTask(task.id, patch)}
                  />
                  <AssigneeMultiSelect
                    compact
                    loading={assigneesLoading}
                    options={assignees}
                    selectedIds={task.assigneeIds ?? []}
                    onChange={(ids) =>
                      void onUpdateTask(task.id, buildAssigneePatch(ids, assignees))
                    }
                  />
                  {(task.assigneeIds?.length ?? 0) > 0 && (
                    <div className="task-card-assignee">
                      <span className="avatar" title={task.assigneeName ?? ""}>
                        {initials(formatAssigneeSummary(task) || "?")}
                      </span>
                      <span className="task-card-assignee-name">
                        {formatAssigneeSummary(task)}
                      </span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {tasks.length === 0 && draggingTaskId && canDrop && (
          <p className="section-drop-hint">Drop task here</p>
        )}

        <div className="board-add-task" onDragOver={(e) => e.stopPropagation()}>
          <input
            className="board-add-task-input"
            placeholder="Add task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddTask();
            }}
            disabled={adding}
          />
          <TaskDateFields
            startDate={newStartDate || null}
            endDate={newEndDate || null}
            layout="row"
            size="compact"
            onChange={(patch) => {
              if (patch.startDate !== undefined) setNewStartDate(patch.startDate ?? "");
              if (patch.endDate !== undefined) setNewEndDate(patch.endDate ?? "");
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-with-icon board-add-task-btn"
            onClick={() => void handleAddTask()}
            disabled={adding || !newTitle.trim()}
          >
            <IconPlus size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </section>
  );
}
