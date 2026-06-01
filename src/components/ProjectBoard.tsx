import { useEffect, useState } from "react";
import type { AssigneeOption, Project, Section, Task } from "@/types";
import {
  getProjectMembers,
  notifyIfNewAssignee,
  subscribeSections,
  subscribeTasks,
  updateTask,
  deleteTask,
} from "@/services/database";
import { useAuth } from "@/contexts/AuthContext";
import { SectionBlock } from "@/components/SectionBlock";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
import { InviteMemberModal } from "@/components/InviteMemberModal";
import { moveTaskBetweenSections, setTaskCompletedInProject } from "@/utils/moveTask";
import { sendProjectInvite } from "@/services/inviteApi";

interface ProjectBoardProps {
  project: Project;
}

export function ProjectBoard({ project }: ProjectBoardProps) {
  const { user } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSections(project.id, setSections);
  }, [project.id]);

  useEffect(() => {
    return subscribeTasks(project.id, setTasks);
  }, [project.id]);

  useEffect(() => {
    void getProjectMembers(project.id).then((members) =>
      setAssignees(
        members.map((m) => ({
          uid: m.uid,
          displayName: m.displayName,
          email: m.email,
        })),
      ),
    );
  }, [project.id, project.memberIds]);

  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  async function handleUpdateTask(taskId: string, patch: Partial<Task>) {
    const previous = tasks.find((t) => t.id === taskId);
    await updateTask(project.id, taskId, patch);
    if (user && "assigneeId" in patch) {
      await notifyIfNewAssignee(patch, previous, user, project, taskId);
    }
  }

  async function handleDropTask(taskId: string, toSectionId: string) {
    await moveTaskBetweenSections(
      project.id,
      tasks,
      sections,
      taskId,
      toSectionId,
      updateTask,
    );
  }

  async function handleToggleComplete(taskId: string, completed: boolean) {
    await setTaskCompletedInProject(
      project.id,
      tasks,
      sections,
      taskId,
      completed,
      updateTask,
    );
  }

  return (
    <>
      <header className="project-header">
        <div className="project-title-row">
          <span className={`project-dot ${project.color}`} style={{ width: 16, height: 16 }} />
          <h1 className="project-title">{project.name}</h1>
        </div>
        <div className="project-toolbar">
          <button type="button" className="btn" onClick={() => setShowInvite(true)}>
            Share / Invite
          </button>
        </div>
      </header>

      <div className="board-scroll">
        {sections.length === 0 ? (
          <div className="empty-state">Loading sections…</div>
        ) : (
          <div className="board-columns">
            {sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              tasks={tasks.filter((t) => t.sectionId === section.id)}
              assignees={assignees}
              projectId={project.id}
              draggingTaskId={draggingTaskId}
              onDragStart={setDraggingTaskId}
              onDragEnd={() => setDraggingTaskId(null)}
              onDropTask={(taskId, sectionId) => void handleDropTask(taskId, sectionId)}
              onSelectTask={setSelectedTask}
              onUpdateTask={handleUpdateTask}
              onToggleComplete={(taskId, completed) =>
                void handleToggleComplete(taskId, completed)
              }
            />
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          assignees={assignees}
          onClose={() => setSelectedTask(null)}
          onUpdate={(patch) => handleUpdateTask(selectedTask.id, patch)}
          onDelete={async () => {
            await deleteTask(project.id, selectedTask.id);
            setSelectedTask(null);
          }}
        />
      )}

      {showInvite && (
        <InviteMemberModal
          onClose={() => setShowInvite(false)}
          onInvite={(email) => sendProjectInvite(project.id, email)}
        />
      )}
    </>
  );
}
