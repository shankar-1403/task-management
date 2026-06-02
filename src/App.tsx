import { useEffect, useMemo, useState } from "react";
import { IconFolderPlus, IconMenu2 } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { AssignedTasksPage } from "@/pages/AssignedTasksPage";
import { Sidebar } from "@/components/Sidebar";
import { ProjectBoard } from "@/components/ProjectBoard";
import { MyTasksView, useMyTasksCount } from "@/components/MyTasksView";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { createProject, deleteProject, subscribeProjects } from "@/services/database";
import type { HomeView } from "@/types/navigation";
import type { Project, ProjectCategory, ProjectColor } from "@/types";

export default function App() {
  const { user, loading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [homeView, setHomeView] = useState<HomeView>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth <= 1024,
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth > 1024,
  );

  useEffect(() => {
    if (!user) return;
    return subscribeProjects(user.uid, setProjects);
  }, [user]);

  useEffect(() => {
    const handleResize = () => {
      const compact = window.innerWidth <= 1024;
      setIsCompactLayout(compact);
      if (!compact) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    // Always start from Dashboard after login.
    setHomeView("dashboard");
    setSelectedProjectId(null);
  }, [user?.uid]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const myTasksCount = useMyTasksCount(projects, user?.uid);

  function goHome(view: HomeView) {
    setHomeView(view);
    setSelectedProjectId(null);
    if (isCompactLayout) setSidebarOpen(false);
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    if (isCompactLayout) setSidebarOpen(false);
  }

  if (loading) {
    return (
      <div className="auth-page">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  async function handleCreateProject(name: string, category: ProjectCategory, color: ProjectColor) {
    const id = await createProject(name, category, color, user!.uid);
    setSelectedProjectId(id);
    setHomeView("dashboard");
  }

  async function handleDeleteProject(projectId: string) {
    await deleteProject(projectId, user!.uid);
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      setHomeView("dashboard");
    }
  }

  return (
    <div className="app-shell">
      {isCompactLayout && sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {sidebarOpen && (
        <Sidebar
          projects={projects}
          homeView={homeView}
          selectedProjectId={selectedProjectId}
          onSelectProject={openProject}
          onCreateProject={() => setShowCreateProject(true)}
          myTasksCount={myTasksCount}
          onShowDashboard={() => goHome("dashboard")}
          onShowCalendar={() => goHome("calendar")}
          onShowMyTasks={() => goHome("myTasks")}
          onShowAssignedByMe={() => goHome("assignedByMe")}
          onOpenTaskAssignment={() => goHome("myTasks")}
          onDeleteProject={handleDeleteProject}
          onToggleSidebar={() => setSidebarOpen(false)}
        />
      )}

      <main className={`main-content ${!sidebarOpen ? "main-content--sidebar-hidden" : ""}`}>
        {!sidebarOpen && (
          <button
            type="button"
            className="btn btn-ghost btn-with-icon app-sidebar-toggle"
            aria-label="Open sidebar menu"
            onClick={() => setSidebarOpen(true)}
          >
            <IconMenu2 size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
          </button>
        )}
        {selectedProject ? (
          <ProjectBoard project={selectedProject} />
        ) : homeView === "dashboard" ? (
          <DashboardPage
            projects={projects}
            onOpenMyTasks={() => goHome("myTasks")}
            onOpenCalendar={() => goHome("calendar")}
            onSelectProject={openProject}
          />
        ) : homeView === "calendar" ? (
          <CalendarPage projects={projects} onSelectProject={openProject} />
        ) : homeView === "assignedByMe" ? (
          <AssignedTasksPage projects={projects} />
        ) : homeView === "myTasks" ? (
          <MyTasksView projects={projects} />
        ) : (
          <div className="empty-state">
            <p>No projects yet.</p>
            <button
              type="button"
              className="btn btn-primary btn-with-icon"
              onClick={() => setShowCreateProject(true)}
            >
              <IconFolderPlus size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
              Create your first project
            </button>
          </div>
        )}
      </main>

      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onCreate={handleCreateProject}
        />
      )}
    </div>
  );
}
