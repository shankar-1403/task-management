import type { Section, Task } from "@/types";

const TASK_DRAG_TYPE = "application/x-task-id";

export function setTaskDragData(dataTransfer: DataTransfer, taskId: string): void {
  dataTransfer.setData(TASK_DRAG_TYPE, taskId);
  dataTransfer.effectAllowed = "move";
}

export function getTaskDragId(dataTransfer: DataTransfer): string | null {
  return dataTransfer.getData(TASK_DRAG_TYPE) || null;
}

export function isDoneSection(section: Section): boolean {
  return section.name.trim().toLowerCase() === "done";
}

export function findSectionByName(sections: Section[], name: string): Section | undefined {
  const key = name.trim().toLowerCase();
  return sections.find((s) => s.name.trim().toLowerCase() === key);
}

export async function setTaskCompletedInProject(
  projectId: string,
  tasks: Task[],
  sections: Section[],
  taskId: string,
  completed: boolean,
  updateTaskFn: (projectId: string, taskId: string, patch: Partial<Task>) => Promise<void>,
): Promise<void> {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  const doneSection = findSectionByName(sections, "done");
  const todoSection = findSectionByName(sections, "to do");

  if (completed) {
    if (doneSection && task.sectionId !== doneSection.id) {
      await moveTaskBetweenSections(
        projectId,
        tasks,
        sections,
        taskId,
        doneSection.id,
        updateTaskFn,
      );
    } else {
      await updateTaskFn(projectId, taskId, { completed: true });
    }
    return;
  }

  if (doneSection && task.sectionId === doneSection.id && todoSection) {
    await moveTaskBetweenSections(
      projectId,
      tasks,
      sections,
      taskId,
      todoSection.id,
      updateTaskFn,
    );
  } else {
    await updateTaskFn(projectId, taskId, { completed: false });
  }
}

export function buildTaskMovePatch(
  fromSection: Section | undefined,
  toSection: Section,
  toOrder: number,
): Partial<Task> {
  const patch: Partial<Task> = {
    sectionId: toSection.id,
    order: toOrder,
  };
  if (isDoneSection(toSection)) {
    patch.completed = true;
  } else if (fromSection && isDoneSection(fromSection)) {
    patch.completed = false;
  }
  return patch;
}

export async function moveTaskBetweenSections(
  projectId: string,
  tasks: Task[],
  sections: Section[],
  taskId: string,
  toSectionId: string,
  updateTask: (projectId: string, taskId: string, patch: Partial<Task>) => Promise<void>,
): Promise<void> {
  const task = tasks.find((t) => t.id === taskId);
  if (!task || task.sectionId === toSectionId) return;

  const fromSection = sections.find((s) => s.id === task.sectionId);
  const toSection = sections.find((s) => s.id === toSectionId);
  if (!toSection) return;

  const targetCount = tasks.filter((t) => t.sectionId === toSectionId && t.id !== taskId).length;
  const patch = buildTaskMovePatch(fromSection, toSection, targetCount);

  await updateTask(projectId, taskId, patch);

  const sourceUpdates = tasks
    .filter((t) => t.sectionId === task.sectionId && t.id !== taskId)
    .sort((a, b) => a.order - b.order);

  await Promise.all(
    sourceUpdates.map((t, index) =>
      t.order !== index ? updateTask(projectId, t.id, { order: index }) : Promise.resolve(),
    ),
  );
}
