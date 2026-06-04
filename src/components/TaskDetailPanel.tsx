import { useEffect, useState } from "react";
import { IconTrash, IconX } from "@tabler/icons-react";
import type { AssigneeOption, Task } from "@/types";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import { AssigneeMultiSelect } from "@/components/AssigneeMultiSelect";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TaskDateFields } from "@/components/TaskDateFields";
import { buildAssigneePatch } from "@/utils/taskAssignees";

interface TaskDetailPanelProps {
  task: Task;
  assignees: AssigneeOption[];
  assigneesLoading?: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<Task>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TaskDetailPanel({
  task,
  assignees,
  assigneesLoading = false,
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
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <IconX size={ICON_SIZE.md} stroke={ICON_STROKE} className="app-icon app-icon--md" />
          </button>
        </header>
        <div className="detail-body">
          <div className="detail-field">
            <span className="detail-label">Assignees</span>
            <AssigneeMultiSelect
              loading={assigneesLoading}
              options={assignees}
              selectedIds={task.assigneeIds ?? []}
              onChange={(ids) => void onUpdate(buildAssigneePatch(ids, assignees))}
            />
          </div>

          <div className="detail-field">
            <span className="detail-label">Schedule & priority</span>
            <TaskDateFields
              startDate={task.startDate}
              endDate={task.endDate}
              completed={task.completed}
              layout="stack"
              onChange={(patch) => void onUpdate(patch)}
            />
            <div className="detail-priority-preview">
              <PriorityBadge task={task} />
              <span className="detail-priority-hint">
                Priority is based on the end date (urgent → low).
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
            className="btn btn-with-icon btn-danger-outline"
            onClick={() => void onDelete()}
          >
            <IconTrash size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
            Delete task
          </button>
        </div>
      </aside>
    </>
  );
}
