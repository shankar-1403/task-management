import {
  IconCalendar,
  IconLayoutDashboard,
  IconListCheck,
  IconMenu2,
  IconLogout,
  IconPlus,
  IconTrash,
  IconUserShare,
} from "@tabler/icons-react";
import type { AppNotification, Project } from "@/types";
import type { HomeView } from "@/types/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import solvaDarkLogo from "@/assets/solva_dark_logo.webp";
import solvaLightLogo from "@/assets/solva_light_logo.webp";
import { useTheme } from "@/contexts/ThemeContext";
import {
  departmentLabel,
  formatUserFooter,
  seesBothDepartmentGroups,
} from "@/utils/userAccess";

interface SidebarProps {
  /** Projects visible in the sidebar (filtered by department for members). */
  projects: Project[];
  /** Full project list (admins use this for Technology + Marketing groups). */
  allProjects: Project[];
  homeView: HomeView;
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  myTasksCount: number;
  onShowDashboard: () => void;
  onShowCalendar: () => void;
  onShowMyTasks: () => void;
  onShowAssignedByMe: () => void;
  onOpenTaskAssignment: (notification: AppNotification) => void;
  onDeleteProject: (id: string) => Promise<void>;
  onToggleSidebar: () => void;
}

const iconProps = { size: ICON_SIZE.md, stroke: ICON_STROKE };

export function Sidebar({
  projects,
  allProjects,
  homeView,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  myTasksCount,
  onShowDashboard,
  onShowCalendar,
  onShowMyTasks,
  onShowAssignedByMe,
  onOpenTaskAssignment,
  onDeleteProject,
  onToggleSidebar,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  const onProject = selectedProjectId !== null;
  const showBothGroups = user ? seesBothDepartmentGroups(user) : false;

  const technologyProjects = (showBothGroups ? allProjects : projects).filter(
    (project) => project.category !== "marketing",
  );
  const marketingProjects = (showBothGroups ? allProjects : projects).filter(
    (project) => project.category === "marketing",
  );

  const memberDepartment = user?.department;
  const singleDepartmentProjects = projects;

  async function handleDeleteProject(project: Project) {
    const confirmed = window.confirm(`Delete "${project.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await onDeleteProject(project.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete project.";
      window.alert(message);
    }
  }

  function renderProject(project: Project) {
    return (
      <button
        key={project.id}
        type="button"
        className={`sidebar-nav-item ${selectedProjectId === project.id ? "active" : ""}`}
        onClick={() => onSelectProject(project.id)}
      >
        <span className={`project-dot ${project.color}`} />
        <span className="sidebar-project-name">{project.name}</span>
        <span
          className="sidebar-project-delete"
          role="button"
          aria-label={`Delete ${project.name}`}
          title="Delete project"
          onClick={(e) => {
            e.stopPropagation();
            void handleDeleteProject(project);
          }}
        >
          <IconTrash size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
        </span>
      </button>
    );
  }

  function renderProjectGroups() {
    if (showBothGroups) {
      return (
        <>
          <div className="sidebar-project-group-label">Technology</div>
          {technologyProjects.map(renderProject)}
          <div className="sidebar-project-group-label">Marketing</div>
          {marketingProjects.map(renderProject)}
        </>
      );
    }

    if (!memberDepartment) return null;

    return (
      <>
        <div className="sidebar-project-group-label">{departmentLabel(memberDepartment)}</div>
        {singleDepartmentProjects.map(renderProject)}
      </>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={theme === "dark" ? solvaLightLogo : solvaDarkLogo} alt="Solva logo" className="sidebar-brand-logo-image" />
        <button
          type="button"
          className="btn btn-ghost btn-icon sidebar-collapse-btn"
          onClick={onToggleSidebar}
          aria-label="Hide sidebar"
          title="Hide sidebar"
        >
          <IconMenu2 size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
        </button>
      </div>

      <div className="sidebar-section-label">Home</div>
      <div className="sidebar-notifications">
        <NotificationBell onOpenTaskAssignment={onOpenTaskAssignment} />
      </div>
      <button
        type="button"
        className={`sidebar-nav-item ${!onProject && homeView === "dashboard" ? "active" : ""}`}
        onClick={onShowDashboard}
      >
        <IconLayoutDashboard {...iconProps} className="app-icon app-icon--md" />
        <span>Dashboard</span>
      </button>
      <button
        type="button"
        className={`sidebar-nav-item ${!onProject && homeView === "myTasks" ? "active" : ""}`}
        onClick={onShowMyTasks}
      >
        <IconListCheck {...iconProps} className="app-icon app-icon--md" />
        <span>My tasks</span>
        {myTasksCount > 0 && <span className="sidebar-badge">{myTasksCount}</span>}
      </button>
      <button
        type="button"
        className={`sidebar-nav-item ${!onProject && homeView === "assignedByMe" ? "active" : ""}`}
        onClick={onShowAssignedByMe}
      >
        <IconUserShare {...iconProps} className="app-icon app-icon--md" />
        <span>Assigned by me</span>
      </button>
      <button
        type="button"
        className={`sidebar-nav-item ${!onProject && homeView === "calendar" ? "active" : ""}`}
        onClick={onShowCalendar}
      >
        <IconCalendar {...iconProps} className="app-icon app-icon--md" />
        <span>Calendar</span>
      </button>

      <div className="sidebar-section-label">Projects</div>
      {renderProjectGroups()}
      <button type="button" className="sidebar-nav-item" onClick={onCreateProject}>
        <IconPlus {...iconProps} className="app-icon app-icon--md" />
        <span>New project</span>
      </button>

      <div className="sidebar-footer">
        <ThemeToggle className="sidebar-theme-toggle" />
        <div className="user-menu">
          <span className="user-menu-email" title={user?.email}>
            {user ? formatUserFooter(user) : ""}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm sidebar-logout btn-with-icon"
            onClick={() => logout()}
          >
            <IconLogout size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
