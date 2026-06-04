import { useEffect, useMemo, useState } from "react";
import type { Project, Task } from "@/types";
import { subscribeTasks } from "@/services/database";
import { sortTasksByPriority } from "@/utils/priority";
import { taskIsAssignedTo } from "@/utils/taskAssignees";

export function useAllMyTasks(projects: Project[], userId: string | undefined) {
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});

  useEffect(() => {
    if (!userId || projects.length === 0) {
      setTasksByProject({});
      return;
    }
    const unsubs = projects.map((project) =>
      subscribeTasks(project.id, (tasks) => {
        setTasksByProject((prev) => ({ ...prev, [project.id]: tasks }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [projects, userId]);

  const myTasks = useMemo(() => {
    const combined = Object.values(tasksByProject).flat();
    return sortTasksByPriority(
      combined.filter((t) => userId && taskIsAssignedTo(t, userId)),
    );
  }, [tasksByProject, userId]);

  return { myTasks, tasksByProject };
}
