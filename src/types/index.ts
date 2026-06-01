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

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface Project {
  id: string;
  name: string;
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
  dueDate: string | null;
  order: number;
  createdAt: number;
  createdBy: string;
}

export interface AssigneeOption {
  uid: string;
  displayName: string;
  email: string;
}

export interface AppNotification {
  id: string;
  type: "task_assigned";
  toUserId: string;
  fromUserId: string;
  fromUserName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  read: boolean;
  createdAt: number;
}
