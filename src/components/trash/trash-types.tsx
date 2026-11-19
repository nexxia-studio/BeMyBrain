// Types de la corbeille (spec todo-unifiee, « Corbeille (`/trash`) ») : corbeille de toute l'app, un type
// déclaré par module, comme l'ajout rapide déclare ses formulaires (`quick-add-types.ts`). Un type lit ses
// éléments à la corbeille (serveur, workspace de la session) et les rend en `TrashItem` : ligne et action du
// registre qui les restaure. Tranche 1 : `task` seul. Un module qui ajoute un type ajoute une entrée.
// Lecture côté serveur uniquement : jamais importé par un composant client.
import "server-only";

import { TaskTrashRow } from "@/components/tasks/TaskTrashRow";
import { loadTrashedTasks } from "@/modules/tasks/load";
import { trashEntries } from "@/modules/tasks/view";

import { sortTrash, type TrashItem } from "./trash-item";

export type TrashType = {
  key: string;
  /** Éléments du type à la corbeille, lus avec le jeton et filtrés sur le workspace de la session. */
  load: (token: string, workspaceId: string) => Promise<TrashItem[]>;
};

export const TRASH_TYPES: readonly TrashType[] = [
  {
    key: "task",
    // Une parente porte ses sous-tâches mises avec elle (« + n sous-tâches ») : elles reviennent avec elle.
    load: async (token, workspaceId) =>
      trashEntries(await loadTrashedTasks(token, workspaceId)).map((entry) => ({
        key: `task:${entry.task.id}`,
        deletedAt: entry.task.deletedAt,
        restore: { action: "tasks.restore", params: { taskId: entry.task.id } },
        row: <TaskTrashRow item={entry} />,
      })),
  },
];

/** Toute la corbeille du workspace de la session, tous types mêlés, la plus récente d'abord. */
export async function loadTrash(
  token: string,
  workspaceId: string,
): Promise<TrashItem[]> {
  const lists = await Promise.all(
    TRASH_TYPES.map((type) => type.load(token, workspaceId)),
  );
  return sortTrash(lists.flat());
}
