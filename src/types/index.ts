export type ProjectColor =
  | "aqua"
  | "blue"
  | "green"
  | "indigo"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "yellow";

export type ProjectCategory = "technology" | "marketing";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface Project {
  id: string;
  name: string;
  category: ProjectCategory;
  color: ProjectColor;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
}

export interface Section {
  id: string;
  projectId: string;
  name: string;
  order: number;
}

export interface Task {
  id: string;
  projectId: string;
  sectionId: string;
  title: string;
  description: string;
  completed: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  /** @deprecated Legacy field — migrated to endDate on read */
  dueDate?: string | null;
  order: number;
  createdAt: number;
  createdBy: string;
}

export interface AssigneeOption {
  uid: string;
  displayName: string;
  email: string;
}

export type MyTasksSectionKind = "project" | "custom";

export type MyTasksProjectSlot = "todo" | "doing" | "done";

export interface MyTasksSection {
  id: string;
  name: string;
  order: number;
  kind: MyTasksSectionKind;
  /** Matches project board columns (To do / Doing / Done). */
  projectSlot?: MyTasksProjectSlot;
}

export interface MyTaskPlacement {
  sectionId: string;
  order: number;
}

export type NotificationType = "task_assigned" | "task_priority";

export interface AppNotification {
  id: string;
  type: NotificationType;
  toUserId: string;
  fromUserId: string;
  fromUserName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  /** Set when type is task_priority */
  priorityLevel?: "high" | "urgent";
  read: boolean;
  createdAt: number;
}
