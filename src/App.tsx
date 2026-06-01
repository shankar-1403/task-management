import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { Sidebar } from "@/components/Sidebar";
import { ProjectBoard } from "@/components/ProjectBoard";
import { MyTasksView, useMyTasksCount } from "@/components/MyTasksView";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { createProject, subscribeProjects } from "@/services/database";
import type { Project, ProjectColor } from "@/types";

export default function App() {
  const { user, loading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showingMyTasks, setShowingMyTasks] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeProjects(user.uid, setProjects);
  }, [user]);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId && !showingMyTasks) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, showingMyTasks]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const myTasksCount = useMyTasksCount(projects, user?.uid);

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

  async function handleCreateProject(name: string, color: ProjectColor) {
    const id = await createProject(name, color, user!.uid);
    setSelectedProjectId(id);
    setShowingMyTasks(false);
  }

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          setShowingMyTasks(false);
        }}
        onCreateProject={() => setShowCreateProject(true)}
        myTasksCount={myTasksCount}
        onShowMyTasks={() => {
          setShowingMyTasks(true);
          setSelectedProjectId(null);
        }}
        showingMyTasks={showingMyTasks}
        onOpenTaskAssignment={() => {
          setShowingMyTasks(true);
          setSelectedProjectId(null);
        }}
      />

      <main className="main-content">
        {showingMyTasks ? (
          <MyTasksView projects={projects} />
        ) : selectedProject ? (
          <ProjectBoard project={selectedProject} />
        ) : (
          <div className="empty-state">
            <p>No projects yet.</p>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreateProject(true)}>
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
