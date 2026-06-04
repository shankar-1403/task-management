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
  UserDepartment,
  UserProfile,
  UserRole,
} from "@/types";
import { escalatedToHighOrUrgent, getTaskPriority, sortTasksByPriority } from "@/utils/priority";
import {
  normalizeTaskAssignees,
  newlyAddedAssigneeIds,
  prepareTaskPatchForDb,
} from "@/utils/taskAssignees";
import {
  canAccessProject,
  departmentsForAssigneePicker,
  departmentsForProjectSubscription,
} from "@/utils/userAccess";

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
  const assigneeFields = normalizeTaskAssignees(raw as unknown as Record<string, unknown>);
  return {
    ...raw,
    ...assigneeFields,
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? raw.dueDate ?? null,
  };
}

function parseUserRole(raw: unknown): UserRole {
  if (raw === "admin") return "admin";
  if (raw === "management") return "management";
  return "member";
}

function parseUserDepartment(raw: unknown): UserDepartment | null {
  if (raw === "marketing") return "marketing";
  if (raw === "technology") return "technology";
  return null;
}

function normalizeUserProfileFields(
  role: UserRole,
  department: UserDepartment | null,
  allDepartments: boolean,
): Pick<UserProfile, "role" | "department" | "allDepartments"> {
  if (role === "admin") {
    return { role, department: null, allDepartments: true };
  }
  if (allDepartments) {
    return { role, department: null, allDepartments: true };
  }
  return {
    role,
    department: department ?? "technology",
    allDepartments: false,
  };
}

export function parseUserProfile(uid: string, raw: Record<string, unknown>): UserProfile {
  const role = parseUserRole(raw.role);
  const allDepartments = role === "admin" || raw.allDepartments === true;
  const department = parseUserDepartment(raw.department);
  const normalized = normalizeUserProfileFields(role, department, allDepartments);

  return {
    uid,
    email: String(raw.email ?? "").toLowerCase(),
    displayName: String(raw.displayName ?? raw.email ?? "User"),
    photoURL: raw.photoURL ? String(raw.photoURL) : undefined,
    ...normalized,
  };
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await get(ref(db, `users/${uid}`));
    if (!snap.exists()) return null;
    return parseUserProfile(uid, snap.val() as Record<string, unknown>);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "";
    if (code === "PERMISSION_DENIED") {
      throw new Error(
        "Permission denied reading your profile. Deploy database.rules.json in Firebase, then sign in again.",
      );
    }
    throw err;
  }
}

export async function upsertUserProfile(user: UserProfile): Promise<void> {
  try {
    const existingSnap = await get(ref(db, `users/${user.uid}`));
    const existing = existingSnap.exists()
      ? (existingSnap.val() as Record<string, unknown>)
      : null;

    const role = user.role ?? parseUserRole(existing?.role);
    const normalized = normalizeUserProfileFields(
      role,
      user.department ?? parseUserDepartment(existing?.department),
      user.allDepartments || existing?.allDepartments === true,
    );

    await set(ref(db, `users/${user.uid}`), {
      email: user.email,
      emailKey: emailKey(user.email),
      displayName: user.displayName,
      photoURL: user.photoURL ?? null,
      role: normalized.role,
      department: normalized.department,
      allDepartments: normalized.allDepartments,
    });
    await set(ref(db, `usersByEmail/${emailKey(user.email)}`), user.uid);
    if (normalized.role === "admin") {
      try {
        await syncAdminUidConfig(user.uid, "admin");
      } catch {
        // config/adminUids may require a one-time Console bootstrap
      }
    } else {
      await syncDepartmentUserIndex(
        user.uid,
        normalized.role,
        normalized.department,
        normalized.allDepartments,
      );
    }
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "";
    if (code === "PERMISSION_DENIED") {
      throw new Error(
        "Permission denied updating your profile. Deploy database.rules.json in Firebase, then sign in again.",
      );
    }
    throw err;
  }
}

/** Keeps departmentUsers in sync (admin can run for all accounts). */
export async function rebuildDepartmentUserIndexes(profiles: UserProfile[]): Promise<void> {
  await Promise.allSettled(
    profiles
      .filter((p) => p.role !== "admin")
      .map((p) => syncDepartmentUserIndex(p.uid, p.role, p.department, p.allDepartments)),
  );
}

async function syncAdminUidConfig(uid: string, role: UserRole): Promise<void> {
  if (role === "admin") {
    await set(ref(db, `config/adminUids/${uid}`), true);
  } else {
    await remove(ref(db, `config/adminUids/${uid}`));
  }
}

async function syncDepartmentUserIndex(
  uid: string,
  role: UserRole,
  department: UserDepartment | null,
  allDepartments: boolean,
): Promise<void> {
  await remove(ref(db, `departmentUsers/technology/${uid}`));
  await remove(ref(db, `departmentUsers/marketing/${uid}`));
  if (role === "admin") return;

  if (allDepartments) {
    await set(ref(db, `departmentUsers/technology/${uid}`), true);
    await set(ref(db, `departmentUsers/marketing/${uid}`), true);
    return;
  }

  if (department) {
    await set(ref(db, `departmentUsers/${department}/${uid}`), true);
  }
}

export async function createUserProfileRecord(profile: UserProfile): Promise<void> {
  const normalized = normalizeUserProfileFields(
    profile.role,
    profile.department,
    profile.allDepartments,
  );
  await set(ref(db, `users/${profile.uid}`), {
    email: profile.email,
    emailKey: emailKey(profile.email),
    displayName: profile.displayName,
    photoURL: profile.photoURL ?? null,
    role: normalized.role,
    department: normalized.department,
    allDepartments: normalized.allDepartments,
  });
  await set(ref(db, `usersByEmail/${emailKey(profile.email)}`), profile.uid);
  if (normalized.role === "admin") {
    await syncAdminUidConfig(profile.uid, "admin");
  } else {
    await syncDepartmentUserIndex(
      profile.uid,
      normalized.role,
      normalized.department,
      normalized.allDepartments,
    );
  }
}

async function collectKnownUserIds(): Promise<Set<string>> {
  const uidSet = new Set<string>();

  const addKeys = (snap: { exists: () => boolean; val: () => unknown }) => {
    if (!snap.exists()) return;
    const val = snap.val();
    if (val && typeof val === "object") {
      Object.keys(val as Record<string, unknown>).forEach((key) => uidSet.add(key));
    }
  };

  const addEmailValues = (snap: { exists: () => boolean; val: () => unknown }) => {
    if (!snap.exists()) return;
    for (const uid of Object.values(snap.val() as Record<string, string>)) {
      if (typeof uid === "string" && uid) uidSet.add(uid);
    }
  };

  try {
    addKeys(await get(ref(db, "config/adminUids")));
  } catch {
    // Not an admin yet
  }
  try {
    addKeys(await get(ref(db, "users")));
  } catch {
    // Fall through
  }
  try {
    addEmailValues(await get(ref(db, "usersByEmail")));
  } catch {
    // Fall through
  }
  for (const department of ["technology", "marketing"] as const) {
    try {
      addKeys(await get(ref(db, `departmentUsers/${department}`)));
    } catch {
      // Skip
    }
  }

  return uidSet;
}

async function listUserProfilesByIds(uids: string[]): Promise<UserProfile[]> {
  const profiles = await Promise.all(
    uids.map(async (uid) => {
      try {
        const userSnap = await get(ref(db, `users/${uid}`));
        if (!userSnap.exists()) return null;
        return parseUserProfile(uid, userSnap.val() as Record<string, unknown>);
      } catch {
        return null;
      }
    }),
  );
  return profiles
    .filter((p): p is UserProfile => p !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function listUsersFromEmailIndex(): Promise<UserProfile[]> {
  const snap = await get(ref(db, "usersByEmail"));
  if (!snap.exists()) return [];

  const uidSet = new Set<string>();
  for (const uid of Object.values(snap.val() as Record<string, string>)) {
    if (typeof uid === "string" && uid) uidSet.add(uid);
  }

  const profiles = await Promise.all(
    [...uidSet].map(async (uid) => {
      try {
        const userSnap = await get(ref(db, `users/${uid}`));
        if (!userSnap.exists()) return null;
        return parseUserProfile(uid, userSnap.val() as Record<string, unknown>);
      } catch {
        return null;
      }
    }),
  );

  return profiles
    .filter((p): p is UserProfile => p !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function listUsersFromDepartmentIndexes(): Promise<UserProfile[]> {
  const uidSet = new Set<string>();
  for (const department of ["technology", "marketing"] as const) {
    try {
      const indexSnap = await get(ref(db, `departmentUsers/${department}`));
      if (!indexSnap.exists()) continue;
      Object.keys(indexSnap.val() as Record<string, boolean>).forEach((uid) => uidSet.add(uid));
    } catch {
      // Skip unreadable department index
    }
  }

  const profiles = await Promise.all(
    [...uidSet].map(async (uid) => {
      try {
        const userSnap = await get(ref(db, `users/${uid}`));
        if (!userSnap.exists()) return null;
        return parseUserProfile(uid, userSnap.val() as Record<string, unknown>);
      } catch {
        return null;
      }
    }),
  );

  return profiles
    .filter((p): p is UserProfile => p !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function listAllUsers(): Promise<UserProfile[]> {
  try {
    const snap = await get(ref(db, "users"));
    if (snap.exists()) {
      const data = snap.val() as Record<string, Record<string, unknown>>;
      const fromUsersNode = Object.entries(data)
        .map(([uid, raw]) => {
          if (!raw || typeof raw !== "object") return null;
          return parseUserProfile(uid, raw);
        })
        .filter((p): p is UserProfile => p !== null);
      if (fromUsersNode.length > 0) {
        return fromUsersNode.sort((a, b) => a.displayName.localeCompare(b.displayName));
      }
    }
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "";
    if (code !== "PERMISSION_DENIED") {
      throw err;
    }
  }

  const knownIds = await collectKnownUserIds();
  if (knownIds.size > 0) {
    const profiles = await listUserProfilesByIds([...knownIds]);
    if (profiles.length > 0) return profiles;
  }

  const fromEmailIndex = await listUsersFromEmailIndex();
  if (fromEmailIndex.length > 0) {
    return fromEmailIndex;
  }

  const fromDeptIndexes = await listUsersFromDepartmentIndexes();
  if (fromDeptIndexes.length > 0) {
    return fromDeptIndexes;
  }

  throw new Error(
    'Cannot load users: permission denied. In Firebase Realtime Database set users/{yourUid}/role to "admin" AND config/adminUids/{yourUid} to true, then run firebase deploy --only database and sign out/in.',
  );
}

export interface AdminUpdateUserInput {
  uid: string;
  displayName: string;
  role: UserRole;
  department: UserDepartment | null;
  allDepartments: boolean;
}

export async function adminUpdateUserProfile(input: AdminUpdateUserInput): Promise<UserProfile> {
  if (input.role === "member" && !input.department && !input.allDepartments) {
    throw new Error("Members must be assigned a department.");
  }
  if (input.role === "management" && !input.allDepartments && !input.department) {
    throw new Error("Choose a department or enable access to both departments.");
  }

  const userRef = ref(db, `users/${input.uid}`);
  const snap = await get(userRef);
  if (!snap.exists()) {
    throw new Error("User not found.");
  }

  const existing = snap.val() as Record<string, unknown>;
  const email = String(existing.email ?? "").toLowerCase();
  const normalized = normalizeUserProfileFields(
    input.role,
    input.department,
    input.allDepartments,
  );

  await set(userRef, {
    email,
    emailKey: emailKey(email),
    displayName: input.displayName.trim() || email.split("@")[0],
    photoURL: existing.photoURL ?? null,
    role: normalized.role,
    department: normalized.department,
    allDepartments: normalized.allDepartments,
  });

  const profile = parseUserProfile(input.uid, {
    ...existing,
    displayName: input.displayName.trim(),
    ...normalized,
  });
  const previousDept = parseUserDepartment(existing.department);
  if (profile.role === "admin") {
    await syncAdminUidConfig(profile.uid, "admin");
    await remove(ref(db, `departmentUsers/technology/${profile.uid}`));
    await remove(ref(db, `departmentUsers/marketing/${profile.uid}`));
  } else {
    await syncAdminUidConfig(profile.uid, profile.role);
    await syncDepartmentUserIndex(
      profile.uid,
      profile.role,
      profile.department,
      profile.allDepartments,
    );
    if (previousDept && previousDept !== profile.department) {
      await remove(ref(db, `departmentUsers/${previousDept}/${profile.uid}`));
    }
  }
  return profile;
}

function isAssignableInDepartments(
  profile: UserProfile,
  departments: ProjectCategory[],
): boolean {
  if (profile.role === "admin") return false;
  if (profile.allDepartments) return true;
  return !!profile.department && departments.includes(profile.department);
}

export async function listAssignableUsers(
  viewer: UserProfile,
  projectCategory: ProjectCategory,
  projectId?: string,
): Promise<UserProfile[]> {
  const departments = departmentsForAssigneePicker(viewer, projectCategory);
  const byUid = new Map<string, UserProfile>();

  function addProfile(profile: UserProfile) {
    if (!isAssignableInDepartments(profile, departments)) return;
    byUid.set(profile.uid, profile);
  }

  for (const department of departments) {
    try {
      const indexSnap = await get(ref(db, `departmentUsers/${department}`));
      if (!indexSnap.exists()) continue;
      for (const uid of Object.keys(indexSnap.val() as Record<string, boolean>)) {
        try {
          const userSnap = await get(ref(db, `users/${uid}`));
          if (!userSnap.exists()) continue;
          addProfile(parseUserProfile(uid, userSnap.val() as Record<string, unknown>));
        } catch {
          // Skip users we cannot read
        }
      }
    } catch {
      // Index missing or not readable — fall back to project members below
    }
  }

  if (projectId) {
    try {
      const members = await getProjectMembers(projectId);
      for (const member of members) {
        addProfile(member);
      }
    } catch {
      // Project members unavailable
    }
  }

  if (viewer.role !== "admin" && isAssignableInDepartments(viewer, departments)) {
    byUid.set(viewer.uid, viewer);
  }

  return Array.from(byUid.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function adminDeleteError(err: unknown, step: string): Error {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  if (code === "PERMISSION_DENIED") {
    return new Error(
      `${step}: permission denied. Deploy database.rules.json (firebase deploy --only database), confirm your account has role "admin", then sign out and back in.`,
    );
  }
  if (err instanceof Error) return new Error(`${step}: ${err.message}`);
  return new Error(`${step}: failed`);
}

export async function adminDeleteUserProfile(
  target: UserProfile,
  currentAdminUid: string,
): Promise<void> {
  if (target.uid === currentAdminUid) {
    throw new Error("You cannot delete your own account while signed in.");
  }

  const allUsers = await listAllUsers();
  const adminCount = allUsers.filter((u) => u.role === "admin").length;
  if (target.role === "admin" && adminCount <= 1) {
    throw new Error("Cannot delete the only administrator.");
  }

  const key = emailKey(target.email);
  const updates: Record<string, null> = {
    [`users/${target.uid}`]: null,
    [`usersByEmail/${key}`]: null,
    [`userProjects/${target.uid}`]: null,
    [`notifications/${target.uid}`]: null,
    [`myTasksLayout/${target.uid}`]: null,
    [`config/adminUids/${target.uid}`]: null,
  };

  try {
    await update(ref(db), updates);
    await remove(ref(db, `departmentUsers/technology/${target.uid}`));
    await remove(ref(db, `departmentUsers/marketing/${target.uid}`));
  } catch (err) {
    throw adminDeleteError(err, "Delete user");
  }
}

/** Rebuild departmentProjects from all userProjects entries (admin). */
export async function rebuildDepartmentProjectIndexes(): Promise<void> {
  const users = await listAllUsers();
  const projectIds = new Set<string>();
  for (const profile of users) {
    const snap = await get(ref(db, `userProjects/${profile.uid}`));
    if (!snap.exists()) continue;
    Object.keys(snap.val() as Record<string, true>).forEach((id) => projectIds.add(id));
  }
  await Promise.all(
    [...projectIds].map(async (projectId) => {
      const projectSnap = await get(ref(db, `projects/${projectId}`));
      if (!projectSnap.exists()) return;
      const project = parseProject(projectId, projectSnap.val() as Record<string, unknown>);
      await syncDepartmentProjectIndex(
        projectId,
        departmentProjectIndexEntry(
          project.name,
          project.category,
          project.color,
          project.ownerId,
          project.createdAt,
        ),
      );
    }),
  );
}

type DepartmentProjectIndexEntry = {
  name: string;
  category: ProjectCategory;
  color: ProjectColor;
  ownerId: string;
  createdAt: number;
};

function departmentProjectIndexEntry(
  name: string,
  category: ProjectCategory,
  color: ProjectColor,
  ownerId: string,
  createdAt: number,
): DepartmentProjectIndexEntry {
  return { name, category, color, ownerId, createdAt };
}

function projectFromDepartmentIndex(
  projectId: string,
  dept: ProjectCategory,
  raw: unknown,
): Project | null {
  if (raw === true) return null;
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const category =
    entry.category === "marketing" || entry.category === "technology"
      ? entry.category
      : dept;
  const color = entry.color as ProjectColor;
  const ownerId = String(entry.ownerId ?? "");
  const name = String(entry.name ?? "Project");
  const createdAt = typeof entry.createdAt === "number" ? entry.createdAt : 0;
  if (!ownerId || !name) return null;

  return {
    id: projectId,
    name,
    category,
    color,
    ownerId,
    memberIds: [ownerId],
    createdAt,
  };
}

async function syncDepartmentProjectIndex(
  projectId: string,
  entry: DepartmentProjectIndexEntry,
): Promise<void> {
  await remove(ref(db, `departmentProjects/technology/${projectId}`));
  await remove(ref(db, `departmentProjects/marketing/${projectId}`));
  await set(ref(db, `departmentProjects/${entry.category}/${projectId}`), entry);
}

export function subscribeProjects(
  user: UserProfile,
  onData: (projects: Project[]) => void,
): Unsubscribe {
  const departments = departmentsForProjectSubscription(user);
  if (departments.length === 0) {
    onData([]);
    return () => {};
  }

  const indexByDept: Partial<
    Record<ProjectCategory, Record<string, DepartmentProjectIndexEntry | boolean>>
  > = {};
  let legacyIds: Record<string, true> = {};
  const projectData = new Map<string, Project>();
  const hydrating = new Set<string>();

  function publish() {
    const list = [...projectData.values()]
      .filter((p) => canAccessProject(user, p))
      .sort((a, b) => b.createdAt - a.createdAt);
    onData(list);
  }

  function rebuildFromIndexes() {
    projectData.clear();
    for (const dept of departments) {
      for (const [projectId, raw] of Object.entries(indexByDept[dept] ?? {})) {
        const project = projectFromDepartmentIndex(projectId, dept, raw);
        if (project && canAccessProject(user, project)) {
          projectData.set(projectId, project);
        }
      }
    }
    publish();
  }

  async function hydrateLegacyProject(projectId: string) {
    if (hydrating.has(projectId) || projectData.has(projectId)) return;
    hydrating.add(projectId);
    try {
      const snap = await get(ref(db, `projects/${projectId}`));
      if (!snap.exists()) return;
      const project = parseProject(projectId, snap.val() as Record<string, unknown>);
      if (!canAccessProject(user, project)) return;
      projectData.set(projectId, project);
      publish();
      await syncDepartmentProjectIndex(
        projectId,
        departmentProjectIndexEntry(
          project.name,
          project.category,
          project.color,
          project.ownerId,
          project.createdAt,
        ),
      );
    } catch {
      // Skip projects we cannot read
    } finally {
      hydrating.delete(projectId);
    }
  }

  function handleDepartmentIndex(dept: ProjectCategory, snap: { val: () => unknown }) {
    indexByDept[dept] = (snap.val() as Record<string, DepartmentProjectIndexEntry | boolean>) ?? {};
    rebuildFromIndexes();
    for (const [projectId, raw] of Object.entries(indexByDept[dept] ?? {})) {
      if (raw === true) void hydrateLegacyProject(projectId);
    }
  }

  function handleLegacyUserProjects(snap: { val: () => unknown }) {
    legacyIds = (snap.val() as Record<string, true>) ?? {};
    for (const projectId of Object.keys(legacyIds)) {
      if (!projectData.has(projectId)) void hydrateLegacyProject(projectId);
    }
  }

  const unsubs = departments.map((dept) =>
    onValue(
      ref(db, `departmentProjects/${dept}`),
      (snap) => handleDepartmentIndex(dept, snap),
      (err) => console.warn(`departmentProjects/${dept} subscription error:`, err),
    ),
  );

  const legacyUnsub = onValue(
    ref(db, `userProjects/${user.uid}`),
    handleLegacyUserProjects,
    (err) => console.warn("userProjects subscription error:", err),
  );

  return () => {
    unsubs.forEach((u) => u());
    legacyUnsub();
  };
}

function createProjectError(err: unknown, step: string): Error {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  if (code === "PERMISSION_DENIED") {
    return new Error(
      `${step}: permission denied. Deploy database.rules.json, confirm your profile has a department (or allDepartments), then sign out and back in.`,
    );
  }
  if (err instanceof Error) return new Error(`${step}: ${err.message}`);
  return new Error(`${step}: failed`);
}

export async function createProject(
  name: string,
  category: ProjectCategory,
  color: ProjectColor,
  ownerId: string,
): Promise<string> {
  const projectRef = push(ref(db, "projects"));
  const projectId = projectRef.key!;
  const createdAt = Date.now();
  const indexEntry = departmentProjectIndexEntry(name, category, color, ownerId, createdAt);

  try {
    await set(projectRef, {
      name,
      category,
      color,
      ownerId,
      memberIds: memberIdsToMap([ownerId]),
      createdAt,
    });
    await set(ref(db, `departmentProjects/${category}/${projectId}`), indexEntry);
    await set(ref(db, `userProjects/${ownerId}/${projectId}`), true);
  } catch (err) {
    throw createProjectError(err, "Create project");
  }

  try {
    const defaultSections = ["To do", "Ongoing", "Done"];
    for (let index = 0; index < defaultSections.length; index++) {
      const sectionRef = push(ref(db, `projects/${projectId}/sections`));
      await set(sectionRef, { name: defaultSections[index], order: index });
    }
  } catch (err) {
    throw createProjectError(err, "Create project sections");
  }

  return projectId;
}

const CANONICAL_PROJECT_SECTIONS = [
  { name: "To do", order: 0 },
  { name: "Ongoing", order: 1 },
  { name: "Done", order: 2 },
] as const;

type CanonicalSectionSlot = "to do" | "ongoing" | "done";

function canonicalSectionSlot(name: string): CanonicalSectionSlot | null {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (normalized === "to do" || normalized === "todo") return "to do";
  if (normalized === "doing" || normalized === "ongoing") return "ongoing";
  if (normalized === "done") return "done";
  return null;
}

/** Adds only missing To do / Ongoing / Done columns (never duplicates existing names). */
export async function ensureProjectSections(projectId: string): Promise<void> {
  const sectionsSnap = await get(ref(db, `projects/${projectId}/sections`));
  const existing = sectionsSnap.val() as Record<string, { name?: string; order?: number }> | null;
  const slotsPresent = new Set<CanonicalSectionSlot>();
  if (existing) {
    for (const section of Object.values(existing)) {
      const slot = canonicalSectionSlot(String(section.name ?? ""));
      if (slot) slotsPresent.add(slot);
    }
  }

  for (const { name, order } of CANONICAL_PROJECT_SECTIONS) {
    const slot = canonicalSectionSlot(name);
    if (!slot || slotsPresent.has(slot)) continue;
    const sectionRef = push(ref(db, `projects/${projectId}/sections`));
    await set(sectionRef, { name, order });
  }
}

/** Removes duplicate/legacy columns and ensures exactly one To do, Ongoing, Done. */
export async function normalizeProjectBoardSections(projectId: string): Promise<void> {
  const legacyDeptNames = new Set(["technology", "marketing"]);
  const sectionsSnap = await get(ref(db, `projects/${projectId}/sections`));
  if (!sectionsSnap.exists()) {
    await ensureProjectSections(projectId);
    return;
  }

  const sectionEntries = Object.entries(
    sectionsSnap.val() as Record<string, { name?: string; order?: number }>,
  );

  for (const [sectionId, section] of sectionEntries) {
    if (String(section.name ?? "").trim().toLowerCase() === "doing") {
      await update(ref(db, `projects/${projectId}/sections/${sectionId}`), { name: "Ongoing" });
      section.name = "Ongoing";
    }
  }

  const bySlot: Record<CanonicalSectionSlot, string[]> = {
    "to do": [],
    ongoing: [],
    done: [],
  };
  const legacyDeptSectionIds: string[] = [];

  for (const [sectionId, section] of sectionEntries) {
    const name = String(section.name ?? "");
    if (legacyDeptNames.has(name.trim().toLowerCase())) {
      legacyDeptSectionIds.push(sectionId);
      continue;
    }
    const slot = canonicalSectionSlot(name);
    if (slot) bySlot[slot].push(sectionId);
  }

  const tasksSnap = await get(ref(db, `projects/${projectId}/tasks`));
  const tasksData = tasksSnap.exists()
    ? (tasksSnap.val() as Record<string, { sectionId?: string }>)
    : null;

  const taskUpdates: Record<string, unknown> = {};

  function keepSectionId(slot: CanonicalSectionSlot): string {
    const ids = bySlot[slot];
    if (ids.length === 0) return "";
    const sorted = [...ids].sort((a, b) => {
      const orderA = sectionEntries.find(([id]) => id === a)?.[1]?.order ?? 0;
      const orderB = sectionEntries.find(([id]) => id === b)?.[1]?.order ?? 0;
      return orderA - orderB;
    });
    return sorted[0];
  }

  const keepers: Record<CanonicalSectionSlot, string> = {
    "to do": keepSectionId("to do"),
    ongoing: keepSectionId("ongoing"),
    done: keepSectionId("done"),
  };

  const duplicateIds = new Set<string>();
  for (const slot of ["to do", "ongoing", "done"] as const) {
    for (const id of bySlot[slot]) {
      if (id !== keepers[slot]) duplicateIds.add(id);
    }
  }
  for (const id of legacyDeptSectionIds) duplicateIds.add(id);

  const fallbackToDo = keepers["to do"] || keepers.ongoing || keepers.done;

  if (tasksData) {
    for (const [taskId, task] of Object.entries(tasksData)) {
      if (task.sectionId && duplicateIds.has(task.sectionId) && fallbackToDo) {
        taskUpdates[`projects/${projectId}/tasks/${taskId}/sectionId`] = fallbackToDo;
      }
    }
  }

  if (Object.keys(taskUpdates).length > 0) {
    await update(ref(db), taskUpdates);
  }

  await Promise.all(
    [...duplicateIds].map((sectionId) => remove(ref(db, `projects/${projectId}/sections/${sectionId}`))),
  );

  await ensureProjectSections(projectId);
}

export async function deleteProject(projectId: string, requesterUid: string): Promise<void> {
  const projectSnap = await get(ref(db, `projects/${projectId}`));
  if (!projectSnap.exists()) {
    throw new Error("Project not found.");
  }
  const project = parseProject(projectId, projectSnap.val() as Record<string, unknown>);
  const requesterSnap = await get(ref(db, `users/${requesterUid}`));
  if (!requesterSnap.exists()) {
    throw new Error("You are not allowed to delete this project.");
  }
  const requester = parseUserProfile(requesterUid, requesterSnap.val() as Record<string, unknown>);
  if (!canAccessProject(requester, project)) {
    throw new Error("You are not allowed to delete this project.");
  }

  const memberUids = Array.from(new Set([...project.memberIds, project.ownerId]));

  await remove(ref(db, `departmentProjects/${project.category}/${projectId}`));

  await Promise.all(
    memberUids.map(async (uid) => {
      try {
        await remove(ref(db, `userProjects/${uid}/${projectId}`));
      } catch {
        // Non-admins may only clear their own userProjects entry
      }
    }),
  );

  await remove(ref(db, `projects/${projectId}`));
}

export async function removeLegacyProjectSections(projectId: string): Promise<void> {
  const legacyNames = new Set(["technology", "marketing"]);
  const sectionsSnap = await get(ref(db, `projects/${projectId}/sections`));
  if (!sectionsSnap.exists()) return;

  const sectionEntries = Object.entries(
    sectionsSnap.val() as Record<string, { name?: string; order?: number }>,
  );

  for (const [sectionId, section] of sectionEntries) {
    if (String(section.name ?? "").trim().toLowerCase() === "doing") {
      await update(ref(db, `projects/${projectId}/sections/${sectionId}`), { name: "Ongoing" });
    }
  }
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
  onError?: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(db, `projects/${projectId}/sections`),
    (snap) => {
      const sections = listChildren<Omit<Section, "projectId">>(snap.val(), (a, b) =>
        a.order - b.order,
      );
      onData(sections.map((s) => ({ ...s, projectId })));
    },
    (err) => {
      const error = err instanceof Error ? err : new Error("Could not load sections.");
      onError?.(error);
      onData([]);
    },
  );
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
  const prepared = prepareTaskPatchForDb(input);
  await set(taskRef, {
    ...prepared,
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
  const prepared = prepareTaskPatchForDb(patch);
  const data = Object.fromEntries(
    Object.entries(prepared).filter(([key]) => key !== "id" && key !== "projectId"),
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
    profiles.push(parseUserProfile(uid, userSnap.val() as Record<string, unknown>));
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
    assigneeIds: string[];
    previousAssigneeIds: string[];
    actor: UserProfile;
    project: Project;
    previous?: Task;
    patch?: Partial<Task>;
  },
): Promise<{ sent: boolean; error?: string }> {
  const { taskId, taskTitle, assigneeIds, previousAssigneeIds, actor, project, previous, patch } =
    params;

  const added = newlyAddedAssigneeIds(previousAssigneeIds, assigneeIds).filter(
    (id) => id !== actor.uid,
  );
  if (added.length === 0) {
    return { sent: false };
  }

  try {
    for (const toUserId of added) {
      await createInboxNotification({
        type: "task_assigned",
        toUserId,
        fromUserId: actor.uid,
        fromUserName: actor.displayName || actor.email || "Someone",
        projectId: project.id,
        projectName: project.name,
        taskId,
        taskTitle: taskTitle || "Task",
      });
    }

    if (previous && patch && !("endDate" in patch) && !("startDate" in patch)) {
      const merged = taskAfterPatch(previous, patch);
      for (const uid of merged.assigneeIds ?? []) {
        if (!added.includes(uid)) continue;
        await notifyAssigneeIfHighPriorityTask(merged, actor, project, uid);
      }
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
  if (next.completed || (next.assigneeIds?.length ?? 0) === 0) {
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
    for (const toUserId of next.assigneeIds ?? []) {
      if (toUserId === actor.uid) continue;
      await createInboxNotification({
        type: "task_priority",
        toUserId,
        fromUserId: actor.uid,
        fromUserName: actor.displayName || actor.email || "Someone",
        projectId: project.id,
        projectName: project.name,
        taskId: previous.id,
        taskTitle: next.title || "Task",
        priorityLevel,
      });
    }
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send notification";
    console.error("notifyTaskHighPriority failed:", err);
    return { sent: false, error: message };
  }
}

/** Notify assignee when task is already high/urgent and they were just assigned. */
export async function notifyAssigneeIfHighPriorityTask(
  task: Pick<Task, "id" | "title" | "assigneeIds" | "completed" | "startDate" | "endDate" | "dueDate">,
  actor: UserProfile,
  project: Project,
  toUserId: string,
): Promise<void> {
  if (!toUserId || toUserId === actor.uid || task.completed) return;

  const priority = getTaskPriority(task);
  if (priority !== "high" && priority !== "urgent") return;

  try {
    await createInboxNotification({
      type: "task_priority",
      toUserId,
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
  if (!("assigneeIds" in patch) && !("assigneeId" in patch)) return;
  await notifyTaskAssignment({
    taskId,
    taskTitle: patch.title ?? previous?.title ?? "Task",
    assigneeIds: patch.assigneeIds ?? previous?.assigneeIds ?? [],
    previousAssigneeIds: previous?.assigneeIds ?? [],
    actor,
    project,
  });
}
