// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Détail `/tasks/[id]` (spec todo-unifiee, « Détail ») : la liste `/tasks` rendue dessous, le détail au-dessus
// (TaskDetailPanel : tiroir sur mobile, panneau latéral sur ordinateur), URL propre pour le lien profond.
// raccourci: la liste est un autre segment que `/tasks` : en ouvrant et en fermant le détail, le squelette de
// `tasks/loading.tsx` remplace la liste le temps du rendu serveur — route interceptée (`@detail/(.)[id]`) quand
// la corbeille ne sera plus sous `/tasks/<segment>` (l'interception l'avale), ou détail chargé côté client.
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

import TasksPage from "../page";

type TaskPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TaskPage({
  params,
  searchParams,
}: TaskPageProps) {
  const { id } = await params;
  // Détail lu d'abord : une tâche absente donne la 404 sans lire la liste.
  const panel = await TaskDetailPanel({ id });
  return (
    <>
      <TasksPage searchParams={searchParams} />
      {panel}
    </>
  );
}
