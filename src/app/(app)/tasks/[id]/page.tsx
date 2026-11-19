// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Détail `/tasks/[id]` (spec todo-unifiee, « Détail ») : la liste `/tasks` rendue dessous, le détail au-dessus
// (TaskDetailPanel : tiroir sur mobile, panneau latéral sur ordinateur), URL propre pour le lien profond.
// Chargement complet seulement (rechargement, lien profond) : depuis la liste, la navigation est interceptée par
// `@detail/(.)[id]`, qui rend le détail seul par-dessus la liste déjà affichée.
import { listQuery } from "@/components/tasks/list-query";
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
  const [{ id }, search] = await Promise.all([params, searchParams]);
  // Détail lu d'abord : une tâche absente donne la 404 sans lire la liste.
  const panel = await TaskDetailPanel({ id, listQuery: listQuery(search) });
  return (
    <>
      <TasksPage searchParams={searchParams} />
      {panel}
    </>
  );
}
