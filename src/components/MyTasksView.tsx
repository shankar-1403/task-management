import { useEffect, useMemo, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
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
import { taskIsAssignedTo } from "@/utils/taskAssignees";
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
  const [activeSectionId, setActiveSectionId] = useState<string>(
    DEFAULT_MY_TASKS_SECTIONS[0].id,
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
    return combined.filter((t) => user && taskIsAssignedTo(t, user.uid));
  }, [tasksByProject, user?.uid]);

  const displaySections = useMemo(() => visibleMyTasksSections(mySections), [mySections]);

  const tasksBySection = useMemo(
    () => groupTasksByMySection(myTasks, mySections, placements, sectionsByProject),
    [myTasks, mySections, placements, sectionsByProject],
  );

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

  const activeSection = useMemo(
    () => displaySections.find((s) => s.id === activeSectionId) ?? displaySections[0],
    [displaySections, activeSectionId],
  );

  useEffect(() => {
    if (displaySections.length === 0) return;
    if (!displaySections.some((s) => s.id === activeSectionId)) {
      setActiveSectionId(displaySections[0].id);
    }
  }, [displaySections, activeSectionId]);

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
      const sectionId = await addMyTasksSection(user.uid, name);
      setNewSectionName("");
      setActiveSectionId(sectionId);
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Could not add section.");
    } finally {
      setAddingSection(false);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!user) return;
    const section = displaySections.find((s) => s.id === sectionId);
    if (!section) return;
    const confirmed = window.confirm(`Delete section "${section.name}"? Tasks stay on their projects.`);
    if (!confirmed) return;
    await deleteMyTasksSection(user.uid, sectionId);
    if (activeSectionId === sectionId) {
      setActiveSectionId(DEFAULT_MY_TASKS_SECTIONS[0].id);
    }
  }

  function openCount(sectionId: string): number {
    return (tasksBySection.get(sectionId) ?? []).filter((t) => !t.completed).length;
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
            <div className="my-tasks-tabs" role="tablist" aria-label="Task sections">
              {displaySections.map((section) => {
                const count = openCount(section.id);
                const isActive = section.id === activeSection?.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    id={`my-tasks-tab-${section.id}`}
                    aria-selected={isActive}
                    aria-controls={`my-tasks-panel-${section.id}`}
                    className={`my-tasks-tab ${isActive ? "my-tasks-tab--active" : ""}`}
                    onClick={() => setActiveSectionId(section.id)}
                  >
                    <span>{section.name}</span>
                    {count > 0 && <span className="my-tasks-tab-badge">{count}</span>}
                  </button>
                );
              })}
            </div>

            {activeSection && (
              <div
                className="my-tasks-tab-panel"
                role="tabpanel"
                id={`my-tasks-panel-${activeSection.id}`}
                aria-labelledby={`my-tasks-tab-${activeSection.id}`}
              >
                <MyTasksSectionBlock
                  section={activeSection}
                  tasks={tasksBySection.get(activeSection.id) ?? []}
                  projects={projects}
                  projectById={projectById}
                  onToggleComplete={(task) => void handleToggleComplete(task)}
                  onAddTask={(projectId, title) =>
                    handleAddTask(activeSection.id, projectId, title)
                  }
                  onDeleteSection={
                    activeSection.kind === "custom" && user
                      ? () => void handleDeleteSection(activeSection.id)
                      : undefined
                  }
                />
              </div>
            )}

            <div className="my-tasks-add-section">
              <p className="my-tasks-add-section-label">
                Add a custom section (appears as a new tab)
              </p>
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
                  <IconPlus
                    size={ICON_SIZE.sm}
                    stroke={ICON_STROKE}
                    className="app-icon app-icon--sm"
                  />
                  Add section
                </button>
              </div>
              {sectionError && <p className="my-tasks-add-section-error">{sectionError}</p>}
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
      .filter((t) => userId && taskIsAssignedTo(t, userId) && !t.completed).length;
  }, [tasksByProject, userId]);
}
