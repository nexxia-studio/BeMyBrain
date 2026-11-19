// Types de la corbeille (spec todo-unifiee, « Corbeille (`/trash`) ») : corbeille de toute l'app, un type
// déclaré par module, comme l'ajout rapide déclare ses formulaires (`quick-add-types.ts`). Un type dit comment
// lire ses éléments à la corbeille (serveur, workspace de la session), comment rendre sa ligne et quelle action
// du registre les restaure. Tranche 1 : `task` seul. Un module qui ajoute un type ajoute une entrée.
// Lecture côté serveur uniquement : jamais importé par un composant client.
import "server-only";

import type { ComponentType } from "react";

import { TaskTrashRow } from "@/components/tasks/TaskTrashRow";
import { loadTrashedTasks } from "@/modules/tasks/load";
import { type TrashEntry, trashEntries } from "@/modules/tasks/view";

import type { TrashItem, TrashRestore } from "./trash-item";

export type TrashType = {
  key: string;
  /** Éléments du type à la corbeille, lus avec le jeton et filtrés sur le workspace de la session. */
  load: (token: string, workspaceId: string) => Promise<TrashItem[]>;
};

/** Déclare un type : sa forme d'élément `T` reste dans la déclaration, la corbeille ne voit que des `TrashItem`. */
export function defineTrashType<T>(type: {
  key: string;
  load: (token: string, workspaceId: string) => Promise<T[]>;
  id: (item: T) => string;
  deletedAt: (item: T) => Date;
  Row: ComponentType<{ item: T }>;
  restore: (item: T) => TrashRestore;
}): TrashType {
  const { Row } = type;
  return {
    key: type.key,
    load: async (token, workspaceId) =>
      (await type.load(token, workspaceId)).map((item) => ({
        key: `${type.key}:${type.id(item)}`,
        deletedAt: type.deletedAt(item),
        restore: type.restore(item),
        row: <Row item={item} />,
      })),
  };
}

export const TRASH_TYPES: readonly TrashType[] = [
  defineTrashType<TrashEntry>({
    key: "task",
    // Une parente porte ses sous-tâches mises avec elle (« + n sous-tâches ») : elles reviennent avec elle.
    load: async (token, workspaceId) =>
      trashEntries(await loadTrashedTasks(token, workspaceId)),
    id: (entry) => entry.task.id,
    deletedAt: (entry) => entry.task.deletedAt,
    Row: TaskTrashRow,
    restore: (entry) => ({
      action: "tasks.restore",
      params: { taskId: entry.task.id },
    }),
  }),
];

/** Toute la corbeille du workspace de la session, tous types mêlés, la plus récente d'abord. */
export async function loadTrash(
  token: string,
  workspaceId: string,
  types: readonly TrashType[] = TRASH_TYPES,
): Promise<TrashItem[]> {
  const lists = await Promise.all(
    types.map((type) => type.load(token, workspaceId)),
  );
  // Tri stable : à date égale, l'ordre du type est gardé.
  return lists
    .flat()
    .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}
