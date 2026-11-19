"use client";

import { createContext, useContext } from "react";

/**
 * Met une tâche à la corbeille : quitte d'abord le détail vers `returnHref` (le détail d'une tâche à la
 * corbeille n'existe plus), puis appelle `tasks.moveToTrash` ; le message et « Annuler » vivent au-dessus de
 * la page. Fourni par TaskTrashProvider (layout de `/tasks`).
 */
export type TrashTask = (taskId: string, returnHref: string) => void;

export const TrashTaskContext = createContext<TrashTask | null>(null);

export function useTrashTask(): TrashTask {
  const trash = useContext(TrashTaskContext);
  // Erreur de développeur (détail hors du layout de /tasks), jamais affichée à l'utilisateur.
  if (!trash) throw new Error("useTrashTask hors de TaskTrashProvider");
  return trash;
}
