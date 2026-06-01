import type { AppNotification, Project } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";

interface SidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  myTasksCount: number;
  onShowMyTasks: () => void;
  showingMyTasks: boolean;
  onOpenTaskAssignment: (notification: AppNotification) => void;
}

export function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  myTasksCount,
  onShowMyTasks,
  showingMyTasks,
  onOpenTaskAssignment,
}: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">✓</span>
        <span>Tasks</span>
      </div>

      <div className="sidebar-section-label">Home</div>
      <div className="sidebar-notifications">
        <NotificationBell onOpenTaskAssignment={onOpenTaskAssignment} />
      </div>
      <button
        type="button"
        className={`sidebar-nav-item ${showingMyTasks ? "active" : ""}`}
        onClick={onShowMyTasks}
      >
        <span>☑</span>
        <span>My tasks</span>
        {myTasksCount > 0 && <span className="sidebar-badge">{myTasksCount}</span>}
      </button>

      <div className="sidebar-section-label">Projects</div>
      {projects.map((project) => (
        <button
          key={project.id}
          type="button"
          className={`sidebar-nav-item ${
            !showingMyTasks && selectedProjectId === project.id ? "active" : ""
          }`}
          onClick={() => onSelectProject(project.id)}
        >
          <span className={`project-dot ${project.color}`} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </span>
        </button>
      ))}
      <button type="button" className="sidebar-nav-item" onClick={onCreateProject}>
        <span>＋</span>
        <span>New project</span>
      </button>

      <div className="sidebar-footer">
        <ThemeToggle className="sidebar-theme-toggle" />
        <div className="user-menu">
          <span className="user-menu-email" title={user?.email}>
            {user?.displayName}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm sidebar-logout"
            onClick={() => logout()}
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
