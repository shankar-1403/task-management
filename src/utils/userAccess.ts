import type { Project, ProjectCategory, UserDepartment, UserProfile, UserRole } from "@/types";

export function isAdmin(user: UserProfile | null | undefined): boolean {
  return user?.role === "admin";
}

export function isManagement(user: UserProfile | null | undefined): boolean {
  return user?.role === "management";
}

/** Administrators and users with allDepartments see every project group. */
export function canAccessAllDepartments(user: UserProfile): boolean {
  return isAdmin(user) || user.allDepartments === true;
}

export function seesBothDepartmentGroups(user: UserProfile): boolean {
  return canAccessAllDepartments(user);
}

export function canPickProjectCategory(user: UserProfile): boolean {
  return canAccessAllDepartments(user);
}

export function departmentLabel(department: UserDepartment): string {
  return department === "marketing" ? "Marketing" : "Technology";
}

export function roleLabel(role: UserRole): string {
  if (role === "admin") return "Administrator";
  if (role === "management") return "Management";
  return "Member";
}

export function formatUserDepartment(user: UserProfile): string {
  if (isAdmin(user)) return "—";
  if (user.allDepartments) return "All departments";
  if (user.department) return departmentLabel(user.department);
  return "—";
}

export function formatUserFooter(user: UserProfile): string {
  if (isAdmin(user)) return user.displayName;
  const parts = [user.displayName];
  if (isManagement(user)) parts.push(roleLabel(user.role));
  const dept = formatUserDepartment(user);
  if (dept !== "—") parts.push(dept);
  return parts.join(" · ");
}

/** Members see one department; admins and cross-department management see all. */
export function filterProjectsForUser(projects: Project[], user: UserProfile): Project[] {
  if (canAccessAllDepartments(user)) return projects;
  if (!user.department) return [];
  return projects.filter((p) => p.category === user.department);
}

export function departmentsForProjectSubscription(user: UserProfile): ProjectCategory[] {
  if (canAccessAllDepartments(user)) return ["technology", "marketing"];
  if (user.department) return [user.department];
  return [];
}

/** Whether a user may view and edit a project (department-wide access). */
export function canAccessProject(user: UserProfile, project: Pick<Project, "category">): boolean {
  if (isAdmin(user)) return true;
  if (user.allDepartments) return true;
  return !!user.department && user.department === project.category;
}

export function defaultProjectCategory(user: UserProfile): UserDepartment {
  return user.department ?? "technology";
}

/** Departments whose users appear in the assignee picker for a project. */
export function departmentsForAssigneePicker(
  viewer: UserProfile,
  projectCategory: ProjectCategory,
): ProjectCategory[] {
  if (canAccessAllDepartments(viewer)) {
    return ["technology", "marketing"];
  }
  if (viewer.department) {
    return [viewer.department];
  }
  return [projectCategory];
}
