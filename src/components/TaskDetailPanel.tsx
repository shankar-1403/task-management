import { useEffect, useState } from "react";
import type { AssigneeOption, Task } from "@/types";
import { PriorityBadge } from "@/components/PriorityBadge";

interface TaskDetailPanelProps {
  task: Task;
  assignees: AssigneeOption[];
  onClose: () => void;
  onUpdate: (patch: Partial<Task>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TaskDetailPanel({
  task,
  assignees,
  onClose,
  onUpdate,
  onDelete,
}: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
  }, [task.id, task.title, task.description]);

  async function saveTitle() {
    if (title.trim() && title !== task.title) {
      await onUpdate({ title: title.trim() });
    } else {
      setTitle(task.title);
    }
  }

  async function saveDescription() {
    if (description !== task.description) {
      await onUpdate({ description });
    }
  }

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <aside className="detail-panel">
        <header className="detail-header">
          <input
            className="detail-input"
            style={{ fontSize: 18, fontWeight: 600, border: "none", padding: 0 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
          />
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="detail-body">
          <div className="detail-field">
            <span className="detail-label">Assignee</span>
            <select
              className="detail-select"
              value={task.assigneeId ?? ""}
              onChange={(e) => {
                const uid = e.target.value || null;
                const member = assignees.find((a) => a.uid === uid);
                void onUpdate({
                  assigneeId: uid,
                  assigneeName: member?.displayName ?? null,
                  assigneeEmail: member?.email ?? null,
                });
              }}
            >
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.uid} value={a.uid}>
                  {a.displayName} ({a.email})
                </option>
              ))}
            </select>
          </div>

          <div className="detail-field">
            <span className="detail-label">Due date & priority</span>
            <input
              type="date"
              className="detail-input"
              value={task.dueDate ?? ""}
              onChange={(e) => void onUpdate({ dueDate: e.target.value || null })}
            />
            <div className="detail-priority-preview">
              <PriorityBadge task={task} />
              <span className="detail-priority-hint">
                Priority is set automatically from the due date (urgent → low).
              </span>
            </div>
          </div>

          <div className="detail-field">
            <span className="detail-label">Description</span>
            <textarea
              className="detail-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              placeholder="What is this task about?"
            />
          </div>

          <button
            type="button"
            className="btn"
            style={{ color: "var(--asana-accent)", borderColor: "var(--asana-accent)" }}
            onClick={() => void onDelete()}
          >
            Delete task
          </button>
        </div>
      </aside>
    </>
  );
}
