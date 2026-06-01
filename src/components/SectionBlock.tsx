import { useState, type DragEvent } from "react";
import type { AssigneeOption, Section, Task } from "@/types";
import { initials, isOverdue } from "@/utils/avatar";
import { getTaskDragId, setTaskDragData } from "@/utils/moveTask";
import { getTaskPriority } from "@/utils/priority";
import { createTask } from "@/services/database";
import { useAuth } from "@/contexts/AuthContext";
import { PriorityBadge } from "@/components/PriorityBadge";

interface SectionBlockProps {
  section: Section;
  tasks: Task[];
  assignees: AssigneeOption[];
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
  return !!target.closest("button, select, input, textarea, a, option, label");
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
  const [newDueDate, setNewDueDate] = useState("");
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
        assigneeId: null,
        assigneeName: null,
        assigneeEmail: null,
        dueDate: newDueDate || null,
        order: tasks.length,
        createdBy: user.uid,
      });
      setNewTitle("");
      setNewDueDate("");
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
                  />
                  <button
                    type="button"
                    className="task-title-btn"
                    onClick={() => onSelectTask(task)}
                  >
                    {task.title}
                  </button>
                </div>
                <div className="task-card-meta">
                  <div className="task-card-due-row">
                    <label className="task-card-due-label">Due</label>
                    <input
                      type="date"
                      className={`task-card-date ${isOverdue(task.dueDate, task.completed) ? "overdue" : ""}`}
                      value={task.dueDate ?? ""}
                      onChange={(e) =>
                        void onUpdateTask(task.id, { dueDate: e.target.value || null })
                      }
                      aria-label="Due date"
                    />
                  </div>
                  <select
                    className="task-card-select"
                    value={task.assigneeId ?? ""}
                    onChange={(e) => {
                      const uid = e.target.value || null;
                      const member = assignees.find((a) => a.uid === uid);
                      void onUpdateTask(task.id, {
                        assigneeId: uid,
                        assigneeName: member?.displayName ?? null,
                        assigneeEmail: member?.email ?? null,
                      });
                    }}
                    aria-label="Assignee"
                  >
                    <option value="">Assign</option>
                    {assignees.map((a) => (
                      <option key={a.uid} value={a.uid}>
                        {a.displayName}
                      </option>
                    ))}
                  </select>
                  {task.assigneeName && (
                    <div className="task-card-assignee">
                      <span className="avatar" title={task.assigneeName}>
                        {initials(task.assigneeName)}
                      </span>
                      <span className="task-card-assignee-name">{task.assigneeName}</span>
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
          <input
            type="date"
            className="board-add-task-date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            title="Due date (optional)"
            aria-label="Due date for new task"
          />
        </div>
      </div>
    </section>
  );
}
