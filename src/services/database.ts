import {
  get,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
  type Unsubscribe,
} from "firebase/database";
import { db } from "@/lib/firebase";
import type {
  AppNotification,
  Project,
  ProjectColor,
  Section,
  Task,
  UserProfile,
} from "@/types";
import { sortTasksByPriority } from "@/utils/priority";

function emailKey(email: string): string {
  return email.toLowerCase().replace(/\./g, ",");
}

function memberIdsToArray(memberIds: Record<string, boolean> | string[] | null): string[] {
  if (!memberIds) return [];
  if (Array.isArray(memberIds)) return memberIds;
  return Object.keys(memberIds);
}

function memberIdsToMap(ids: string[]): Record<string, boolean> {
  return Object.fromEntries(ids.map((id) => [id, true]));
}

function parseProject(id: string, raw: Record<string, unknown>): Project {
  return {
    id,
    name: raw.name as string,
    color: raw.color as ProjectColor,
    ownerId: raw.ownerId as string,
    memberIds: memberIdsToArray(raw.memberIds as Record<string, boolean> | string[]),
    createdAt: raw.createdAt as number,
  };
}

function listChildren<T extends { id: string }>(
  data: Record<string, Omit<T, "id">> | null,
  sort?: (a: T, b: T) => number,
): T[] {
  if (!data) return [];
  const items = Object.entries(data).map(([id, val]) => ({ id, ...val }) as T);
  return sort ? items.sort(sort) : items;
}

export async function upsertUserProfile(user: UserProfile): Promise<void> {
  await set(ref(db, `users/${user.uid}`), {
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL ?? null,
  });
  await set(ref(db, `usersByEmail/${emailKey(user.email)}`), user.uid);
}

export function subscribeProjects(
  userId: string,
  onData: (projects: Project[]) => void,
): Unsubscribe {
  const userProjectsRef = ref(db, `userProjects/${userId}`);
  return onValue(userProjectsRef, async (snap) => {
    const index = snap.val() as Record<string, true> | null;
    if (!index) {
      onData([]);
      return;
    }
    const entries = await Promise.all(
      Object.keys(index).map(async (projectId) => {
        const projectSnap = await get(ref(db, `projects/${projectId}`));
        if (!projectSnap.exists()) return null;
        return parseProject(projectId, projectSnap.val() as Record<string, unknown>);
      }),
    );
    onData(
      entries
        .filter((p): p is Project => p !== null)
        .sort((a, b) => b.createdAt - a.createdAt),
    );
  });
}

export async function createProject(
  name: string,
  color: ProjectColor,
  ownerId: string,
): Promise<string> {
  const projectRef = push(ref(db, "projects"));
  const projectId = projectRef.key!;
  await set(projectRef, {
    name,
    color,
    ownerId,
    memberIds: memberIdsToMap([ownerId]),
    createdAt: Date.now(),
  });
  await set(ref(db, `userProjects/${ownerId}/${projectId}`), true);

  const defaultSections = ["To do", "Doing", "Done"];
  for (let index = 0; index < defaultSections.length; index++) {
    const sectionRef = push(ref(db, `projects/${projectId}/sections`));
    await set(sectionRef, { name: defaultSections[index], order: index });
  }
  return projectId;
}

export function subscribeSections(
  projectId: string,
  onData: (sections: Section[]) => void,
): Unsubscribe {
  return onValue(ref(db, `projects/${projectId}/sections`), (snap) => {
    const sections = listChildren<Omit<Section, "projectId">>(snap.val(), (a, b) => a.order - b.order);
    onData(sections.map((s) => ({ ...s, projectId })));
  });
}

export function subscribeTasks(
  projectId: string,
  onData: (tasks: Task[]) => void,
): Unsubscribe {
  return onValue(ref(db, `projects/${projectId}/tasks`), (snap) => {
    const tasks = listChildren<Task>(snap.val());
    onData(sortTasksByPriority(tasks));
  });
}

export async function createTask(
  projectId: string,
  input: Omit<Task, "id" | "createdAt" | "projectId">,
): Promise<string> {
  const taskRef = push(ref(db, `projects/${projectId}/tasks`));
  await set(taskRef, {
    ...input,
    projectId,
    createdAt: Date.now(),
  });
  return taskRef.key!;
}

export async function updateTask(
  projectId: string,
  taskId: string,
  patch: Partial<Task>,
): Promise<void> {
  const data = Object.fromEntries(
    Object.entries(patch).filter(([key]) => key !== "id" && key !== "projectId"),
  );
  await update(ref(db, `projects/${projectId}/tasks/${taskId}`), data);
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  await remove(ref(db, `projects/${projectId}/tasks/${taskId}`));
}

export async function getProjectMembers(projectId: string): Promise<UserProfile[]> {
  const projectSnap = await get(ref(db, `projects/${projectId}`));
  if (!projectSnap.exists()) return [];
  const memberIds = memberIdsToArray(
    (projectSnap.val() as { memberIds?: Record<string, boolean> | string[] }).memberIds ?? null,
  );
  const profiles: UserProfile[] = [];
  for (const uid of memberIds) {
    const userSnap = await get(ref(db, `users/${uid}`));
    if (!userSnap.exists()) continue;
    const data = userSnap.val() as {
      email: string;
      displayName?: string;
      photoURL?: string;
    };
    const profile: UserProfile = {
      uid,
      email: data.email,
      displayName: data.displayName || data.email,
    };
    if (data.photoURL) profile.photoURL = data.photoURL;
    profiles.push(profile);
  }
  return profiles;
}

export function subscribeNotifications(
  userId: string,
  onData: (notifications: AppNotification[]) => void,
): Unsubscribe {
  return onValue(ref(db, `notifications/${userId}`), (snap) => {
    const notifications = listChildren<AppNotification>(snap.val(), (a, b) => b.createdAt - a.createdAt);
    onData(notifications);
  });
}

export async function createTaskAssignedNotification(input: {
  toUserId: string;
  fromUserId: string;
  fromUserName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
}): Promise<void> {
  const notifRef = push(ref(db, `notifications/${input.toUserId}`));
  await set(notifRef, {
    type: "task_assigned",
    toUserId: input.toUserId,
    fromUserId: input.fromUserId,
    fromUserName: input.fromUserName,
    projectId: input.projectId,
    projectName: input.projectName,
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    read: false,
    createdAt: Date.now(),
  });
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await update(ref(db, `notifications/${userId}/${notificationId}`), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snap = await get(ref(db, `notifications/${userId}`));
  if (!snap.exists()) return;
  const updates: Record<string, boolean> = {};
  for (const id of Object.keys(snap.val() as Record<string, unknown>)) {
    updates[`${id}/read`] = true;
  }
  await update(ref(db, `notifications/${userId}`), updates);
}

export async function notifyIfNewAssignee(
  patch: Partial<Task>,
  previous: Task | undefined,
  actor: UserProfile,
  project: Project,
  taskId: string,
): Promise<void> {
  const assigneeId = patch.assigneeId;
  if (!assigneeId || assigneeId === actor.uid || assigneeId === previous?.assigneeId) {
    return;
  }
  await createTaskAssignedNotification({
    toUserId: assigneeId,
    fromUserId: actor.uid,
    fromUserName: actor.displayName,
    projectId: project.id,
    projectName: project.name,
    taskId,
    taskTitle: patch.title ?? previous?.title ?? "Task",
  });
}
