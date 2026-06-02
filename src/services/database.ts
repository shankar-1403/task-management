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
  ProjectCategory,
  ProjectColor,
  Section,
  Task,
  UserProfile,
} from "@/types";
import { escalatedToHighOrUrgent, getTaskPriority, sortTasksByPriority } from "@/utils/priority";

export function emailKey(email: string): string {
  return email.toLowerCase().replace(/\./g, ",");
}

function memberIdsToArray(
  memberIds: Record<string, boolean | string> | string[] | null,
): string[] {
  if (!memberIds) return [];
  if (Array.isArray(memberIds)) return memberIds;
  const keys = Object.keys(memberIds);
  // Firebase stores arrays as { "0": "uid", "1": "uid2" }
  if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
    return keys
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => String(memberIds[k as keyof typeof memberIds]));
  }
  return keys.filter((k) => memberIds[k] === true || typeof memberIds[k] === "string");
}

function memberIdsToMap(ids: string[]): Record<string, boolean> {
  return Object.fromEntries(ids.map((id) => [id, true]));
}

function parseProject(id: string, raw: Record<string, unknown>): Project {
  const rawCategory = raw.category;
  const category: ProjectCategory =
    rawCategory === "marketing" || rawCategory === "technology"
      ? rawCategory
      : String(raw.name ?? "").toLowerCase().includes("marketing")
        ? "marketing"
        : "technology";

  return {
    id,
    name: raw.name as string,
    category,
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

function normalizeTask(raw: Task): Task {
  return {
    ...raw,
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? raw.dueDate ?? null,
  };
}

export async function upsertUserProfile(user: UserProfile): Promise<void> {
  await set(ref(db, `users/${user.uid}`), {
    email: user.email,
    emailKey: emailKey(user.email),
    displayName: user.displayName,
    photoURL: user.photoURL ?? null,
  });
  await set(ref(db, `usersByEmail/${emailKey(user.email)}`), user.uid);
}

export interface ApplyInviteResult {
  ok: boolean;
  message: string;
  isExistingUser?: boolean;
}

function firebaseErrorMessage(err: unknown, step: string): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  if (code === "PERMISSION_DENIED") {
    return `${step}: permission denied. Publish database.rules.json in Firebase Console, then log out and back in.`;
  }
  if (err instanceof Error) return `${step}: ${err.message}`;
  return `${step}: failed`;
}

/** Add a member or store a pending invite (client RTDB). */
async function isProjectMember(projectId: string, uid: string): Promise<boolean> {
  const snap = await get(ref(db, `userProjects/${uid}/${projectId}`));
  return snap.exists();
}

async function isAlreadyMember(projectId: string, memberUid: string): Promise<boolean> {
  const snap = await get(ref(db, `projects/${projectId}/memberIds/${memberUid}`));
  return snap.exists() && snap.val() === true;
}

export async function applyProjectInvite(
  project: Project,
  email: string,
  inviter: UserProfile,
): Promise<ApplyInviteResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const key = emailKey(normalizedEmail);

  if (normalizedEmail === inviter.email.toLowerCase()) {
    return { ok: false, message: "You cannot invite yourself." };
  }

  if (!(await isProjectMember(project.id, inviter.uid))) {
    return {
      ok: false,
      message: "You are not listed on this project. Try refreshing the page.",
    };
  }

  try {
    const existingUserSnap = await get(ref(db, `usersByEmail/${key}`));
    if (existingUserSnap.exists()) {
      const memberUid = existingUserSnap.val() as string;
      if (await isAlreadyMember(project.id, memberUid)) {
        return { ok: false, message: "This user is already on the project." };
      }

      try {
        await set(ref(db, `userProjects/${memberUid}/${project.id}`), true);
      } catch (err) {
        throw new Error(firebaseErrorMessage(err, "Link member to project"));
      }
      try {
        await set(ref(db, `projects/${project.id}/memberIds/${memberUid}`), true);
      } catch (err) {
        throw new Error(firebaseErrorMessage(err, "Add project member"));
      }
      try {
        await remove(ref(db, `pendingInvites/${key}/${project.id}`));
      } catch {
        // Optional cleanup if a stale pending invite existed
      }

      await createProjectInviteNotification(memberUid, inviter, project);

      return {
        ok: true,
        isExistingUser: true,
        message: `${normalizedEmail} was added to the project.`,
      };
    }

    try {
      await set(ref(db, `pendingInvites/${key}/${project.id}`), {
        email: normalizedEmail,
        projectName: project.name,
        invitedBy: inviter.uid,
        invitedAt: Date.now(),
      });
    } catch (err) {
      throw new Error(firebaseErrorMessage(err, "Save pending invite"));
    }

    return {
      ok: true,
      isExistingUser: false,
      message: `Pending invite created for ${normalizedEmail}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not send invitation.",
    };
  }
}

export async function acceptPendingInvitesForUser(user: UserProfile): Promise<number> {
  const key = emailKey(user.email);

  await set(ref(db, `users/${user.uid}/emailKey`), key);

  const pendingSnap = await get(ref(db, `pendingInvites/${key}`));
  if (!pendingSnap.exists()) return 0;

  const pending = pendingSnap.val() as Record<string, { projectName?: string }>;
  let accepted = 0;

  for (const projectId of Object.keys(pending)) {
    await set(ref(db, `projects/${projectId}/memberIds/${user.uid}`), true);
    await set(ref(db, `userProjects/${user.uid}/${projectId}`), true);
    await remove(ref(db, `pendingInvites/${key}/${projectId}`));
    accepted++;
  }

  return accepted;
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
  category: ProjectCategory,
  color: ProjectColor,
  ownerId: string,
): Promise<string> {
  const projectRef = push(ref(db, "projects"));
  const projectId = projectRef.key!;
  await set(projectRef, {
    name,
    category,
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

export async function deleteProject(projectId: string, requesterUid: string): Promise<void> {
  const projectSnap = await get(ref(db, `projects/${projectId}`));
  if (!projectSnap.exists()) {
    throw new Error("Project not found.");
  }
  if (!(await isProjectMember(projectId, requesterUid))) {
    throw new Error("You are not allowed to delete this project.");
  }
  const project = parseProject(projectId, projectSnap.val() as Record<string, unknown>);

  const memberUids = Array.from(new Set([...project.memberIds, project.ownerId]));
  await remove(ref(db, `projects/${projectId}`));
  for (const uid of memberUids) {
    if (uid === requesterUid) continue;
    await remove(ref(db, `userProjects/${uid}/${projectId}`));
  }
  await remove(ref(db, `userProjects/${requesterUid}/${projectId}`));
}

export async function removeLegacyProjectSections(projectId: string): Promise<void> {
  const legacyNames = new Set(["technology", "marketing"]);
  const sectionsSnap = await get(ref(db, `projects/${projectId}/sections`));
  if (!sectionsSnap.exists()) return;

  const sectionEntries = Object.entries(
    sectionsSnap.val() as Record<string, { name?: string; order?: number }>,
  );
  const legacySections = sectionEntries.filter(([, section]) =>
    legacyNames.has(String(section.name ?? "").trim().toLowerCase()),
  );
  if (legacySections.length === 0) return;

  let fallbackSectionId =
    sectionEntries.find(([, section]) => String(section.name ?? "").trim().toLowerCase() === "to do")?.[0] ??
    sectionEntries.find(([, section]) => !legacyNames.has(String(section.name ?? "").trim().toLowerCase()))?.[0] ??
    null;

  if (!fallbackSectionId) {
    const sectionRef = push(ref(db, `projects/${projectId}/sections`));
    fallbackSectionId = sectionRef.key!;
    await set(sectionRef, { name: "To do", order: 0 });
  }

  const tasksSnap = await get(ref(db, `projects/${projectId}/tasks`));
  if (tasksSnap.exists()) {
    const legacySectionIds = new Set(legacySections.map(([sectionId]) => sectionId));
    const tasksData = tasksSnap.val() as Record<string, { sectionId?: string }>;
    const updates: Record<string, unknown> = {};
    for (const [taskId, task] of Object.entries(tasksData)) {
      if (task.sectionId && legacySectionIds.has(task.sectionId)) {
        updates[`projects/${projectId}/tasks/${taskId}/sectionId`] = fallbackSectionId;
      }
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
    }
  }

  await Promise.all(
    legacySections.map(([sectionId]) => remove(ref(db, `projects/${projectId}/sections/${sectionId}`))),
  );
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
    const tasks = listChildren<Task>(snap.val()).map(normalizeTask);
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
  onError?: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(db, `notifications/${userId}`),
    (snap) => {
      const notifications = listChildren<AppNotification>(snap.val(), (a, b) => b.createdAt - a.createdAt);
      onData(notifications);
    },
    (err) => {
      console.error("Notifications subscription error:", err);
      onError?.(err);
      onData([]);
    },
  );
}

async function createInboxNotification(input: {
  toUserId: string;
  type: AppNotification["type"];
  fromUserId: string;
  fromUserName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  priorityLevel?: "high" | "urgent";
}): Promise<void> {
  const notifRef = push(ref(db, `notifications/${input.toUserId}`));
  await set(notifRef, {
    type: input.type,
    toUserId: input.toUserId,
    fromUserId: input.fromUserId,
    fromUserName: input.fromUserName,
    projectId: input.projectId,
    projectName: input.projectName,
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    priorityLevel: input.priorityLevel ?? null,
    read: false,
    createdAt: Date.now(),
  });
}

export async function createProjectInviteNotification(
  memberUid: string,
  inviter: UserProfile,
  project: Project,
): Promise<void> {
  if (memberUid === inviter.uid) return;
  try {
    await createInboxNotification({
      type: "task_assigned",
      toUserId: memberUid,
      fromUserId: inviter.uid,
      fromUserName: inviter.displayName || inviter.email || "Someone",
      projectId: project.id,
      projectName: project.name,
      taskId: "project-invite",
      taskTitle: "You were added to this project",
    });
  } catch (err) {
    console.warn("Project invite notification failed:", err);
  }
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
  await createInboxNotification({ ...input, type: "task_assigned" });
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await update(ref(db, `notifications/${userId}/${notificationId}`), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await remove(ref(db, `notifications/${userId}`));
}

export async function notifyTaskAssignment(
  params: {
    taskId: string;
    taskTitle: string;
    assigneeId: string | null;
    previousAssigneeId: string | null;
    actor: UserProfile;
    project: Project;
    previous?: Task;
    patch?: Partial<Task>;
  },
): Promise<{ sent: boolean; error?: string }> {
  const { taskId, taskTitle, assigneeId, previousAssigneeId, actor, project, previous, patch } =
    params;

  if (!assigneeId) {
    return { sent: false };
  }
  if (assigneeId === actor.uid) {
    return { sent: false };
  }
  if (assigneeId === previousAssigneeId) {
    return { sent: false };
  }

  try {
    await createInboxNotification({
      type: "task_assigned",
      toUserId: assigneeId,
      fromUserId: actor.uid,
      fromUserName: actor.displayName || actor.email || "Someone",
      projectId: project.id,
      projectName: project.name,
      taskId,
      taskTitle: taskTitle || "Task",
    });

    if (
      previous &&
      patch &&
      !("endDate" in patch) &&
      !("startDate" in patch)
    ) {
      const merged = taskAfterPatch(previous, {
        ...patch,
        assigneeId,
      });
      await notifyAssigneeIfHighPriorityTask(merged, actor, project);
    }

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send notification";
    console.error("notifyTaskAssignment failed:", err);
    return { sent: false, error: message };
  }
}

function taskAfterPatch(previous: Task, patch: Partial<Task>): Task {
  return {
    ...previous,
    ...patch,
    startDate: patch.startDate !== undefined ? patch.startDate : previous.startDate,
    endDate: patch.endDate !== undefined ? patch.endDate : previous.endDate,
  };
}

export async function notifyTaskHighPriority(
  params: {
    previous: Task;
    patch: Partial<Task>;
    actor: UserProfile;
    project: Project;
  },
): Promise<{ sent: boolean; error?: string }> {
  const { previous, patch, actor, project } = params;
  const datesChanged = "endDate" in patch || "startDate" in patch;
  if (!datesChanged) {
    return { sent: false };
  }

  const next = taskAfterPatch(previous, patch);
  if (next.completed || !next.assigneeId) {
    return { sent: false };
  }
  if (next.assigneeId === actor.uid) {
    return { sent: false };
  }

  const prevPriority = getTaskPriority(previous);
  const nextPriority = getTaskPriority(next);
  if (!escalatedToHighOrUrgent(prevPriority, nextPriority)) {
    return { sent: false };
  }

  const priorityLevel: "high" | "urgent" =
    nextPriority === "urgent" ? "urgent" : "high";

  try {
    await createInboxNotification({
      type: "task_priority",
      toUserId: next.assigneeId,
      fromUserId: actor.uid,
      fromUserName: actor.displayName || actor.email || "Someone",
      projectId: project.id,
      projectName: project.name,
      taskId: previous.id,
      taskTitle: next.title || "Task",
      priorityLevel,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send notification";
    console.error("notifyTaskHighPriority failed:", err);
    return { sent: false, error: message };
  }
}

/** Notify assignee when task is already high/urgent and they were just assigned. */
export async function notifyAssigneeIfHighPriorityTask(
  task: Pick<Task, "id" | "title" | "assigneeId" | "completed" | "startDate" | "endDate" | "dueDate">,
  actor: UserProfile,
  project: Project,
): Promise<void> {
  if (!task.assigneeId || task.assigneeId === actor.uid || task.completed) return;

  const priority = getTaskPriority(task);
  if (priority !== "high" && priority !== "urgent") return;

  try {
    await createInboxNotification({
      type: "task_priority",
      toUserId: task.assigneeId,
      fromUserId: actor.uid,
      fromUserName: actor.displayName || actor.email || "Someone",
      projectId: project.id,
      projectName: project.name,
      taskId: task.id,
      taskTitle: task.title || "Task",
      priorityLevel: priority === "urgent" ? "urgent" : "high",
    });
  } catch (err) {
    console.error("notifyAssigneeIfHighPriorityTask failed:", err);
  }
}

/** @deprecated Use notifyTaskAssignment */
export async function notifyIfNewAssignee(
  patch: Partial<Task>,
  previous: Task | undefined,
  actor: UserProfile,
  project: Project,
  taskId: string,
): Promise<void> {
  if (!("assigneeId" in patch)) return;
  await notifyTaskAssignment({
    taskId,
    taskTitle: patch.title ?? previous?.title ?? "Task",
    assigneeId: patch.assigneeId ?? null,
    previousAssigneeId: previous?.assigneeId ?? null,
    actor,
    project,
  });
}
