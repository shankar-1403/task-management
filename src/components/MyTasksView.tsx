import { useEffect, useMemo, useState } from "react";
import { IconLayoutList } from "@tabler/icons-react";
import type { MyTasksSection, Project, Section, Task } from "@/types";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import { subscribeSections, subscribeTasks, updateTask } from "@/services/database";
import {
  addMyTasksSection,
  createTaskInMySection,
  deleteMyTasksSection,
  ensureMyTasksSections,
  subscribeMyTasksLayout,
} from "@/services/myTasksLayout";
import { useAuth } from "@/contexts/AuthContext";
import { setTaskCompletedInProject } from "@/utils/moveTask";
import {
  DEFAULT_MY_TASKS_SECTIONS,
  groupTasksByMySection,
  visibleMyTasksSections,
} from "@/utils/myTasksSections";
import { MyTasksSectionBlock } from "@/components/MyTasksSectionBlock";

interface MyTasksViewProps {
  projects: Project[];
}

export function MyTasksView({ projects }: MyTasksViewProps) {
  const { user } = useAuth();
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [sectionsByProject, setSectionsByProject] = useState<Record<string, Section[]>>({});
  const [mySections, setMySections] = useState<MyTasksSection[]>([]);
  const [placements, setPlacements] = useState<Record<string, { sectionId: string; order: number }>>(
    {},
  );
  const [newSectionName, setNewSectionName] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void ensureMyTasksSections(user.uid);
    return subscribeMyTasksLayout(user.uid, ({ sections, placements: p }) => {
      setMySections(sections);
      setPlacements(p);
    });
  }, [user]);

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

  const myTasks = useMemo(() => {
    const combined = Object.values(tasksByProject).flat();
    return combined.filter((t) => t.assigneeId === user?.uid);
  }, [tasksByProject, user?.uid]);

  const displaySections = useMemo(() => visibleMyTasksSections(mySections), [mySections]);
  const customSections = useMemo(
    () => displaySections.filter((s) => s.kind === "custom"),
    [displaySections],
  );

  const tasksBySection = useMemo(
    () => groupTasksByMySection(myTasks, mySections, placements, sectionsByProject),
    [myTasks, mySections, placements, sectionsByProject],
  );

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

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

  async function handleAddTask(mySectionId: string, projectId: string, title: string) {
    if (!user) return;
    const projectSections = sectionsByProject[projectId] ?? [];
    const sectionTasks = tasksBySection.get(mySectionId) ?? [];
    const order = sectionTasks.length;
    await createTaskInMySection(
      user,
      projectId,
      projectSections,
      mySections,
      mySectionId,
      title,
      order,
    );
  }

  async function handleAddSection() {
    const name = newSectionName.trim();
    if (!name || !user) return;
    setAddingSection(true);
    setSectionError(null);
    try {
      await addMyTasksSection(user.uid, name);
      setNewSectionName("");
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Could not add section.");
    } finally {
      setAddingSection(false);
    }
  }

  return (
    <>
      <header className="project-header">
        <div className="project-title-row">
          <h1 className="project-title">My tasks</h1>
        </div>
      </header>

      <div className="board-scroll my-tasks-scroll">
        {projects.length === 0 ? (
          <div className="empty-state">Create a project first, then add tasks here.</div>
        ) : (
          <>
            {DEFAULT_MY_TASKS_SECTIONS.map((section) => (
              <MyTasksSectionBlock
                key={section.id}
                section={section}
                tasks={tasksBySection.get(section.id) ?? []}
                projects={projects}
                projectById={projectById}
                onToggleComplete={(task) => void handleToggleComplete(task)}
                onAddTask={(projectId, title) => handleAddTask(section.id, projectId, title)}
              />
            ))}

            {customSections.length > 0 && (
              <div className="my-tasks-custom-divider">
                <span>Custom sections</span>
              </div>
            )}

            {customSections.map((section) => (
              <MyTasksSectionBlock
                key={section.id}
                section={section}
                tasks={tasksBySection.get(section.id) ?? []}
                projects={projects}
                projectById={projectById}
                onToggleComplete={(task) => void handleToggleComplete(task)}
                onAddTask={(projectId, title) => handleAddTask(section.id, projectId, title)}
                onDeleteSection={
                  user ? () => void deleteMyTasksSection(user.uid, section.id) : undefined
                }
              />
            ))}

            <div className="my-tasks-add-section">
              <p className="my-tasks-add-section-label">Add a custom section below To do, Doing, and Done</p>
              <div className="my-tasks-add-section-row">
                <input
                  className="my-tasks-add-section-input"
                  placeholder="Section name…"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleAddSection();
                  }}
                  disabled={addingSection}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-with-icon"
                  onClick={() => void handleAddSection()}
                  disabled={addingSection || !newSectionName.trim()}
                >
                  <IconLayoutList
                    size={ICON_SIZE.sm}
                    stroke={ICON_STROKE}
                    className="app-icon app-icon--sm"
                  />
                  Add section
                </button>
              </div>
              {sectionError && (
                <p className="my-tasks-add-section-error">{sectionError}</p>
              )}
            </div>
          </>
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
