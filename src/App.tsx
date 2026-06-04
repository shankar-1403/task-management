import { useEffect, useMemo, useRef, useState } from "react";
import { IconFolderPlus, IconMenu2 } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { AssignedTasksPage } from "@/pages/AssignedTasksPage";
import { AdminShell } from "@/components/AdminShell";
import { Sidebar } from "@/components/Sidebar";
import { ProjectBoard } from "@/components/ProjectBoard";
import { MyTasksView, useMyTasksCount } from "@/components/MyTasksView";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { createProject, deleteProject, subscribeProjects } from "@/services/database";
import type { HomeView } from "@/types/navigation";
import type { Project, ProjectCategory, ProjectColor } from "@/types";
import {
  canAccessAllDepartments,
  canPickProjectCategory,
  defaultProjectCategory,
  filterProjectsForUser,
  isAdmin,
} from "@/utils/userAccess";

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

  const isAdminUser = user ? isAdmin(user) : false;
  const didInitialProjectSelect = useRef(false);

  const visibleProjects = useMemo(
    () => (user && !isAdminUser ? filterProjectsForUser(projects, user) : []),
    [projects, user, isAdminUser],
  );

  useEffect(() => {
    if (!user || isAdminUser) return;
    return subscribeProjects(user, setProjects);
  }, [user, isAdminUser]);

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
    if (!user || isAdminUser) return;
    setHomeView("dashboard");
    setSelectedProjectId(null);
    didInitialProjectSelect.current = false;
  }, [user?.uid, isAdminUser]);

  useEffect(() => {
    if (!user || isAdminUser || canAccessAllDepartments(user)) return;
    if (visibleProjects.length === 0) {
      setSelectedProjectId(null);
      return;
    }
    if (
      selectedProjectId &&
      visibleProjects.some((p) => p.id === selectedProjectId)
    ) {
      return;
    }
    if (selectedProjectId) {
      setSelectedProjectId(visibleProjects[0].id);
      return;
    }
    if (!didInitialProjectSelect.current) {
      didInitialProjectSelect.current = true;
      setSelectedProjectId(visibleProjects[0].id);
    }
  }, [user?.uid, visibleProjects, isAdminUser, selectedProjectId]);

  const selectedProject = useMemo(
    () => visibleProjects.find((p) => p.id === selectedProjectId) ?? null,
    [visibleProjects, selectedProjectId],
  );

  const myTasksCount = useMyTasksCount(visibleProjects, user?.uid);

  function goHome(view: HomeView) {
    if (view === "admin") return;
    setHomeView(view);
    setSelectedProjectId(null);
    if (isCompactLayout) setSidebarOpen(false);
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setHomeView("dashboard");
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

  if (isAdminUser) {
    return (
      <AdminShell
        sidebarOpen={sidebarOpen}
        isCompactLayout={isCompactLayout}
        onToggleSidebar={() => setSidebarOpen(true)}
        onCloseSidebar={() => setSidebarOpen(false)}
      />
    );
  }

  const currentUser = user;

  async function handleCreateProject(name: string, category: ProjectCategory, color: ProjectColor) {
    const resolvedCategory = canPickProjectCategory(currentUser)
      ? category
      : defaultProjectCategory(currentUser);
    const id = await createProject(name, resolvedCategory, color, currentUser.uid);
    setSelectedProjectId(id);
    setHomeView("dashboard");
  }

  async function handleDeleteProject(projectId: string) {
    await deleteProject(projectId, currentUser.uid);
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
          projects={visibleProjects}
          allProjects={projects}
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
            projects={visibleProjects}
            onOpenMyTasks={() => goHome("myTasks")}
            onOpenCalendar={() => goHome("calendar")}
            onSelectProject={openProject}
          />
        ) : homeView === "calendar" ? (
          <CalendarPage projects={visibleProjects} onSelectProject={openProject} />
        ) : homeView === "assignedByMe" ? (
          <AssignedTasksPage projects={visibleProjects} />
        ) : homeView === "myTasks" ? (
          <MyTasksView projects={visibleProjects} />
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
          fixedCategory={
            canPickProjectCategory(currentUser) ? undefined : currentUser.department ?? undefined
          }
        />
      )}
    </div>
  );
}
