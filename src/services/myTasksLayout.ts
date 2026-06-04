import { get, onValue, push, ref, remove, set, update, type Unsubscribe } from "firebase/database";
import { db } from "@/lib/firebase";
import type { MyTaskPlacement, MyTasksSection, Section, UserProfile } from "@/types";
import { createTask } from "@/services/database";
import {
  DEFAULT_MY_TASKS_SECTIONS,
  findProjectSectionForMirror,
  FIXED_SECTION_ORDER_START,
  isFixedMyTasksSection,
  myTaskPlacementKey,
  PROJECT_MIRROR_IDS,
} from "@/utils/myTasksSections";

function listRecord<T>(data: Record<string, T> | null): Array<T & { id: string }> {
  if (!data) return [];
  return Object.entries(data).map(([id, val]) => ({ id, ...val }));
}

function isLegacySmartSection(section: { id: string; kind?: string }): boolean {
  return section.kind === "smart" || section.id.startsWith("smart_");
}

/** Ensures fixed To do / Ongoing / Done exist, removes legacy smart sections, normalizes custom order. */
export async function ensureMyTasksSections(userId: string): Promise<void> {
  const sectionsRef = ref(db, `myTasksLayout/${userId}/sections`);
  const snap = await get(sectionsRef);
  const existing = snap.exists()
    ? listRecord(snap.val() as Record<string, Omit<MyTasksSection, "id">>)
    : [];

  for (const section of DEFAULT_MY_TASKS_SECTIONS) {
    await set(ref(db, `myTasksLayout/${userId}/sections/${section.id}`), {
      name: section.name,
      order: section.order,
      kind: "project",
      projectSlot: section.projectSlot ?? null,
    });
  }

  let customOrder = FIXED_SECTION_ORDER_START;
  for (const section of existing) {
    if (isLegacySmartSection(section)) {
      await remove(ref(db, `myTasksLayout/${userId}/sections/${section.id}`));
      continue;
    }
    if (isFixedMyTasksSection(section.id)) {
      continue;
    }
    if (section.kind === "custom") {
      await update(ref(db, `myTasksLayout/${userId}/sections/${section.id}`), {
        order: customOrder,
      });
      customOrder += 1;
    }
  }
}

export function subscribeMyTasksLayout(
  userId: string,
  onData: (data: {
    sections: MyTasksSection[];
    placements: Record<string, MyTaskPlacement>;
  }) => void,
): Unsubscribe {
  const layoutRef = ref(db, `myTasksLayout/${userId}`);
  return onValue(layoutRef, (snap) => {
    const raw = snap.val() as {
      sections?: Record<string, Omit<MyTasksSection, "id">>;
      placements?: Record<string, MyTaskPlacement>;
    } | null;

    const sections = listRecord(raw?.sections ?? null)
      .filter((s) => !isLegacySmartSection(s))
      .map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        kind: (isFixedMyTasksSection(s.id)
          ? "project"
          : s.kind) as MyTasksSection["kind"],
        projectSlot: isFixedMyTasksSection(s.id)
          ? DEFAULT_MY_TASKS_SECTIONS.find((d) => d.id === s.id)?.projectSlot
          : s.projectSlot ?? undefined,
      }));

    onData({
      sections,
      placements: raw?.placements ?? {},
    });
  });
}

export async function addMyTasksSection(userId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  const reserved = DEFAULT_MY_TASKS_SECTIONS.map((s) => s.name.toLowerCase());
  if (reserved.includes(trimmed.toLowerCase())) {
    throw new Error(`"${trimmed}" is a reserved section name. Choose another name.`);
  }

  const snap = await get(ref(db, `myTasksLayout/${userId}/sections`));
  const existing = listRecord(snap.val() as Record<string, Omit<MyTasksSection, "id">> | null);
  const customSections = existing.filter(
    (s) => s.kind === "custom" && !isFixedMyTasksSection(s.id),
  );
  const maxOrder = customSections.reduce(
    (max, s) => Math.max(max, s.order),
    FIXED_SECTION_ORDER_START - 1,
  );
  const order = Math.max(maxOrder + 1, FIXED_SECTION_ORDER_START);

  const sectionRef = push(ref(db, `myTasksLayout/${userId}/sections`));
  await set(sectionRef, {
    name: trimmed,
    order,
    kind: "custom",
    projectSlot: null,
  });
  return sectionRef.key!;
}

export async function deleteMyTasksSection(userId: string, sectionId: string): Promise<void> {
  if (isFixedMyTasksSection(sectionId)) {
    throw new Error("To do, Ongoing, and Done cannot be removed.");
  }

  await remove(ref(db, `myTasksLayout/${userId}/sections/${sectionId}`));

  const placementsSnap = await get(ref(db, `myTasksLayout/${userId}/placements`));
  if (!placementsSnap.exists()) return;

  const placements = placementsSnap.val() as Record<string, MyTaskPlacement>;
  const updates: Record<string, null> = {};
  for (const [key, placement] of Object.entries(placements)) {
    if (placement.sectionId === sectionId) {
      updates[key] = null;
    }
  }
  if (Object.keys(updates).length > 0) {
    await update(ref(db, `myTasksLayout/${userId}/placements`), updates);
  }
}

export async function setMyTaskPlacement(
  userId: string,
  projectId: string,
  taskId: string,
  sectionId: string,
  order: number,
): Promise<void> {
  await set(ref(db, `myTasksLayout/${userId}/placements/${myTaskPlacementKey(projectId, taskId)}`), {
    sectionId,
    order,
  });
}

export async function createTaskInMySection(
  user: UserProfile,
  projectId: string,
  projectSections: Section[],
  mySections: MyTasksSection[],
  mySectionId: string,
  title: string,
  taskOrder: number,
): Promise<string> {
  const targetProjectSection =
    findProjectSectionForMirror(mySectionId, mySections, projectSections) ??
    projectSections.find((s) => s.name.toLowerCase() === "to do") ??
    projectSections[0];

  if (!targetProjectSection) {
    throw new Error("Project has no sections.");
  }

  const taskId = await createTask(projectId, {
    sectionId: targetProjectSection.id,
    title: title.trim(),
    description: "",
    completed: mySectionId === PROJECT_MIRROR_IDS.DONE,
    assigneeIds: [user.uid],
    assigneeId: user.uid,
    assigneeName: user.displayName,
    assigneeEmail: user.email,
    startDate: null,
    endDate: null,
    order: taskOrder,
    createdBy: user.uid,
  });

  const mySection = mySections.find((s) => s.id === mySectionId);
  if (mySection?.kind === "custom") {
    await setMyTaskPlacement(user.uid, projectId, taskId, mySectionId, taskOrder);
  }

  return taskId;
}
