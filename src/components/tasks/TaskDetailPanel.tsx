// Détail d'une tâche côté serveur, rendu par `/tasks/[id]` au-dessus de la liste : session, tâche du workspace de
// la session, espaces de son côté, jour de l'utilisateur, requête de la liste à garder (`?completed=1`).
// Tâche absente, à la corbeille ou adresse qui n'est pas un uuid : 404 (`notFound()` jamais pris dans un
// try/catch, docs/gotchas.md). Lecture côté serveur uniquement (aucun zod dans le bundle client).
import { notFound } from "next/navigation";

import { requireSessionWithToken } from "@/lib/session";
import { loadContexts } from "@/modules/core/contexts";
import { getUserTimeZone, todayIn } from "@/modules/core/time-zone";
import { loadTask } from "@/modules/tasks/load";

import { TaskDetail } from "./TaskDetail";

type TaskDetailPanelProps = {
  id: string;
  /** Requête de la liste sous le détail (`?completed=1` ou rien). */
  listQuery: string;
};

export async function TaskDetailPanel({ id, listQuery }: TaskDetailPanelProps) {
  const { session, token } = await requireSessionWithToken();
  const task = await loadTask(token, session.workspaceId, id);
  if (task === null) notFound();
  // Une sous-tâche suit le côté et l'espace de sa parente : pas de choix d'espace, aucune lecture.
  const contexts =
    task.parentId === null
      ? await loadContexts(token, session.workspaceId, task.side)
      : [];

  return (
    <TaskDetail
      // Une autre tâche (sous-tâche, parente) : brouillons et état d'appel repartent de zéro.
      key={task.id}
      task={task}
      contexts={contexts.map((context) => ({
        id: context.id,
        name: context.name,
      }))}
      today={todayIn(getUserTimeZone(), new Date())}
      listQuery={listQuery}
    />
  );
}
