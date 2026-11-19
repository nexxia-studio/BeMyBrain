// Layout de `/tasks` (liste, détail) : porte le message « Tâche mise à la corbeille » + « Annuler », qui doit
// survivre à la fermeture du détail (TaskTrashProvider).
import { TaskTrashProvider } from "@/components/tasks/TaskTrashProvider";

export default function TasksLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <TaskTrashProvider>{children}</TaskTrashProvider>;
}
