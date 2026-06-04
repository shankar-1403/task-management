import type { AssigneeOption, Task } from "@/types";

export function assigneeIdsToMap(ids: string[]): Record<string, boolean> | null {
  if (ids.length === 0) return null;
  return Object.fromEntries(ids.map((id) => [id, true]));
}

export function parseAssigneeIdsFromRaw(
  raw: Record<string, unknown>,
): string[] {
  const map = raw.assigneeIds;
  if (map && typeof map === "object" && !Array.isArray(map)) {
    return Object.keys(map as Record<string, boolean>).filter(
      (k) => (map as Record<string, boolean>)[k] === true,
    );
  }
  const legacyId = raw.assigneeId;
  if (typeof legacyId === "string" && legacyId) {
    return [legacyId];
  }
  return [];
}

export function parseAssigneeNamesFromRaw(
  raw: Record<string, unknown>,
  ids: string[],
): Record<string, string> {
  const stored = raw.assigneeNames;
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    return stored as Record<string, string>;
  }
  const legacyName = typeof raw.assigneeName === "string" ? raw.assigneeName : "";
  if (ids.length === 1 && legacyName) {
    return { [ids[0]]: legacyName };
  }
  return {};
}

export function enrichTaskAssignees(task: Task, nameById: Record<string, string>): Task {
  const assigneeIds = task.assigneeIds ?? [];
  const names = assigneeIds
    .map((id) => nameById[id])
    .filter(Boolean);
  return {
    ...task,
    assigneeIds,
    assigneeId: assigneeIds[0] ?? null,
    assigneeName: names.length > 0 ? names.join(", ") : null,
    assigneeEmail: task.assigneeEmail ?? null,
  };
}

export function normalizeTaskAssignees(raw: Record<string, unknown>): Pick<
  Task,
  "assigneeIds" | "assigneeId" | "assigneeName" | "assigneeEmail"
> {
  const assigneeIds = parseAssigneeIdsFromRaw(raw);
  const nameById = parseAssigneeNamesFromRaw(raw, assigneeIds);
  const assigneeName =
    assigneeIds.length > 0
      ? assigneeIds.map((id) => nameById[id] ?? id).join(", ")
      : null;
  const legacyEmail =
    typeof raw.assigneeEmail === "string" ? raw.assigneeEmail : null;

  return {
    assigneeIds,
    assigneeId: assigneeIds[0] ?? null,
    assigneeName,
    assigneeEmail: legacyEmail,
  };
}

export function taskIsAssignedTo(task: Task, uid: string): boolean {
  if (task.assigneeIds?.includes(uid)) return true;
  return task.assigneeId === uid;
}

export function formatAssigneeSummary(task: Task, max = 2): string {
  const ids = task.assigneeIds ?? [];
  if (ids.length === 0) return "";
  const names = (task.assigneeName ?? "").split(", ").filter(Boolean);
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max}`;
}

export type AssigneePatch = Partial<Task> & {
  _assigneeNamesById?: Record<string, string>;
};

export function buildAssigneePatch(
  selectedIds: string[],
  options: AssigneeOption[],
): AssigneePatch {
  const assigneeIds = selectedIds;
  const nameById = Object.fromEntries(
    options.filter((o) => assigneeIds.includes(o.uid)).map((o) => [o.uid, o.displayName]),
  );
  const emailById = Object.fromEntries(
    options.filter((o) => assigneeIds.includes(o.uid)).map((o) => [o.uid, o.email]),
  );
  const firstId = assigneeIds[0];
  return {
    assigneeIds,
    assigneeId: firstId ?? null,
    assigneeName:
      assigneeIds.length > 0
        ? assigneeIds.map((id) => nameById[id] ?? id).join(", ")
        : null,
    assigneeEmail: firstId ? (emailById[firstId] ?? null) : null,
    _assigneeNamesById: nameById,
  };
}

/** Strip client-only fields and map assigneeIds for RTDB. */
export function prepareTaskPatchForDb(patch: AssigneePatch | Partial<Task>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...patch };
  const namesById = "_assigneeNamesById" in patch ? patch._assigneeNamesById : undefined;
  delete data._assigneeNamesById;

  if ("assigneeIds" in patch) {
    const ids = patch.assigneeIds ?? [];
    data.assigneeIds = assigneeIdsToMap(ids);
    data.assigneeNames = ids.length > 0 ? (namesById ?? null) : null;
    if (ids.length === 0) {
      data.assigneeId = null;
      data.assigneeName = null;
      data.assigneeEmail = null;
    }
  }

  return data;
}

export function assigneeIdsChanged(patch: Partial<Task>): boolean {
  return "assigneeIds" in patch;
}

export function newlyAddedAssigneeIds(
  previous: string[],
  next: string[],
): string[] {
  const prev = new Set(previous);
  return next.filter((id) => !prev.has(id));
}
