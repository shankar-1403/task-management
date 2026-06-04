import type { MyTasksSection, Section, Task } from "@/types";

export const PROJECT_MIRROR_IDS = {
  TODO: "mirror_todo",
  DOING: "mirror_doing",
  DONE: "mirror_done",
} as const;

export const FIXED_SECTION_ORDER_START = 10;

export const DEFAULT_MY_TASKS_SECTIONS: MyTasksSection[] = [
  {
    id: PROJECT_MIRROR_IDS.TODO,
    name: "To do",
    order: 0,
    kind: "project",
    projectSlot: "todo",
  },
  {
    id: PROJECT_MIRROR_IDS.DOING,
    name: "Ongoing",
    order: 1,
    kind: "project",
    projectSlot: "doing",
  },
  {
    id: PROJECT_MIRROR_IDS.DONE,
    name: "Done",
    order: 2,
    kind: "project",
    projectSlot: "done",
  },
];

const FIXED_IDS = new Set<string>(Object.values(PROJECT_MIRROR_IDS));

export function isFixedMyTasksSection(sectionId: string): boolean {
  return FIXED_IDS.has(sectionId);
}

export function myTaskPlacementKey(projectId: string, taskId: string): string {
  return `${projectId}_${taskId}`;
}

export function projectSectionNameToSlot(name: string): MyTasksSection["projectSlot"] {
  const n = name.toLowerCase().trim();
  if (n.includes("done")) return "done";
  if (n.includes("ongoing") || n.includes("doing") || n.includes("progress") || n.includes("in progress")) {
    return "doing";
  }
  return "todo";
}

export function slotToMirrorSectionId(slot: MyTasksSection["projectSlot"]): string {
  if (slot === "doing") return PROJECT_MIRROR_IDS.DOING;
  if (slot === "done") return PROJECT_MIRROR_IDS.DONE;
  return PROJECT_MIRROR_IDS.TODO;
}

export function sectionIdFromProjectTask(
  task: Task,
  sectionsByProject: Record<string, Section[]>,
): string {
  if (task.completed) return PROJECT_MIRROR_IDS.DONE;

  const projectSections = sectionsByProject[task.projectId] ?? [];
  const projectSection = projectSections.find((s) => s.id === task.sectionId);
  const slot = projectSectionNameToSlot(projectSection?.name ?? "To do");
  return slotToMirrorSectionId(slot);
}

export function findProjectSectionForMirror(
  mySectionId: string,
  mySections: MyTasksSection[],
  projectSections: Section[],
): Section | undefined {
  const mySection = mySections.find((s) => s.id === mySectionId);
  if (!mySection?.projectSlot) return undefined;

  return (
    projectSections.find(
      (s) => projectSectionNameToSlot(s.name) === mySection.projectSlot,
    ) ?? projectSections[0]
  );
}

export function resolveMyTasksSectionId(
  task: Task,
  mySections: MyTasksSection[],
  placements: Record<string, { sectionId: string }>,
  sectionsByProject: Record<string, Section[]>,
): string {
  const key = myTaskPlacementKey(task.projectId, task.id);
  const manual = placements[key]?.sectionId;
  if (manual) {
    const target = mySections.find((s) => s.id === manual);
    if (target?.kind === "custom") return manual;
  }
  return sectionIdFromProjectTask(task, sectionsByProject);
}

/** Fixed To do / Ongoing / Done first, then user-created custom sections. */
export function visibleMyTasksSections(sections: MyTasksSection[]): MyTasksSection[] {
  const custom = sections
    .filter((s) => s.kind === "custom" && !isFixedMyTasksSection(s.id))
    .sort((a, b) => a.order - b.order);
  return [...DEFAULT_MY_TASKS_SECTIONS, ...custom];
}

export function groupTasksByMySection(
  tasks: Task[],
  sections: MyTasksSection[],
  placements: Record<string, { sectionId: string; order: number }>,
  sectionsByProject: Record<string, Section[]>,
): Map<string, Task[]> {
  const sortedSections = visibleMyTasksSections(sections);
  const groups = new Map<string, Task[]>(sortedSections.map((s) => [s.id, []]));

  for (const task of tasks) {
    const sectionId = resolveMyTasksSectionId(
      task,
      sections,
      placements,
      sectionsByProject,
    );
    const list = groups.get(sectionId) ?? [];
    list.push(task);
    groups.set(sectionId, list);
  }

  for (const [sectionId, list] of groups) {
    list.sort((a, b) => {
      const orderA = placements[myTaskPlacementKey(a.projectId, a.id)]?.order ?? a.order;
      const orderB = placements[myTaskPlacementKey(b.projectId, b.id)]?.order ?? b.order;
      return orderA - orderB || a.createdAt - b.createdAt;
    });
    groups.set(sectionId, list);
  }

  return groups;
}
