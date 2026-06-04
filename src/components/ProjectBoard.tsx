import { useEffect, useState } from "react";
import type { AssigneeOption, Project, Section, Task } from "@/types";
import {
  listAssignableUsers,
  normalizeProjectBoardSections,
  notifyTaskAssignment,
  notifyTaskHighPriority,
  subscribeSections,
  subscribeTasks,
  updateTask,
  deleteTask,
} from "@/services/database";
import { assigneeIdsChanged } from "@/utils/taskAssignees";
import { useAuth } from "@/contexts/AuthContext";
import { SectionBlock } from "@/components/SectionBlock";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
import { moveTaskBetweenSections, setTaskCompletedInProject } from "@/utils/moveTask";

interface ProjectBoardProps {
  project: Project;
}

export function ProjectBoard({ project }: ProjectBoardProps) {
  const { user } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsReady, setSectionsReady] = useState(false);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  useEffect(() => {
    setSectionsReady(false);
    setSectionsError(null);
    return subscribeSections(
      project.id,
      (data) => {
        setSections(data);
        setSectionsReady(true);
      },
      (err) => {
        setSectionsReady(true);
        setSectionsError(err.message);
        setSections([]);
      },
    );
  }, [project.id]);

  useEffect(() => {
    return subscribeTasks(project.id, setTasks);
  }, [project.id]);

  useEffect(() => {
    void normalizeProjectBoardSections(project.id).catch((err) => {
      setSectionsError(
        err instanceof Error ? err.message : "Could not set up board sections.",
      );
    });
  }, [project.id]);

  useEffect(() => {
    if (!user) {
      setAssignees([]);
      setAssigneesLoading(false);
      return;
    }
    setAssigneesLoading(true);
    void listAssignableUsers(user, project.category, project.id)
      .then((members) =>
        setAssignees(
          members.map((m) => ({
            uid: m.uid,
            displayName: m.displayName,
            email: m.email,
          })),
        ),
      )
      .catch((err) => {
        console.warn("Could not load assignees:", err);
        setAssignees([]);
      })
      .finally(() => setAssigneesLoading(false));
  }, [project.id, project.category, user]);

  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  async function handleUpdateTask(taskId: string, patch: Partial<Task>) {
    const previous = tasks.find((t) => t.id === taskId);
    if (!previous) {
      await updateTask(project.id, taskId, patch);
      return;
    }

    const assigneeChanged = assigneeIdsChanged(patch);
    const datesChanged = "endDate" in patch || "startDate" in patch;

    await updateTask(project.id, taskId, patch);

    if (!user) return;

    if (assigneeChanged) {
      const result = await notifyTaskAssignment({
        taskId,
        taskTitle: patch.title ?? previous.title,
        assigneeIds: patch.assigneeIds ?? previous.assigneeIds ?? [],
        previousAssigneeIds: previous.assigneeIds ?? [],
        actor: user,
        project,
        previous,
        patch,
      });
      if (result.error) {
        console.warn("Assignment saved but inbox notification failed:", result.error);
      }
    }

    if (datesChanged) {
      const priorityResult = await notifyTaskHighPriority({
        previous,
        patch,
        actor: user,
        project,
      });
      if (priorityResult.error) {
        console.warn("Priority inbox notification failed:", priorityResult.error);
      }
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
      </header>

      <div className="board-scroll">
        {!sectionsReady ? (
          <div className="empty-state">Loading sections…</div>
        ) : sectionsError ? (
          <div className="empty-state">{sectionsError}</div>
        ) : sections.length === 0 ? (
          <div className="empty-state">Setting up board…</div>
        ) : (
          <div className="board-columns">
            {sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              tasks={tasks.filter((t) => t.sectionId === section.id)}
              assignees={assignees}
              assigneesLoading={assigneesLoading}
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
          assigneesLoading={assigneesLoading}
          onClose={() => setSelectedTask(null)}
          onUpdate={(patch) => handleUpdateTask(selectedTask.id, patch)}
          onDelete={async () => {
            await deleteTask(project.id, selectedTask.id);
            setSelectedTask(null);
          }}
        />
      )}

    </>
  );
}
