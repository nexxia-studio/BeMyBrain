// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Détail `/tasks/[id]` (spec todo-unifiee, « Détail ») : la liste `/tasks` rendue dessous, le détail au-dessus
// (TaskDetailPanel : tiroir sur mobile, panneau latéral sur ordinateur), URL propre pour le lien profond.
// raccourci: la liste est un autre segment que `/tasks` : en ouvrant et en fermant le détail, le squelette de
// `tasks/loading.tsx` la remplace le temps du rendu serveur. Essayé le 2026-11-19 : route interceptée
// `@detail/(.)[id]` (avale `/tasks/trash`, 404) ; emplacement `@detail/[id]` sans interception (squelette
// toujours là à l'ouverture, et `router.push("/tasks")` ne quitte plus `/tasks/[id]`). À reprendre avec un détail
// chargé côté client, ou si Next change ce comportement.
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
