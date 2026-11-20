"use client";

import { createContext, useContext } from "react";

/**
 * Met une tâche à la corbeille : quitte d'abord le détail vers `returnHref` (le détail d'une tâche à la
 * corbeille n'existe plus : la liste, ou le détail de la parente pour une sous-tâche), puis appelle
 * `tasks.moveToTrash` ; le message et « Annuler » s'affichent une fois sur `returnHref`. Fourni par
 * TaskTrashProvider (layout de `/tasks`).
 */
export type TrashTask = (taskId: string, returnHref: string) => void;

export const TrashTaskContext = createContext<TrashTask | null>(null);

export function useTrashTask(): TrashTask {
  const trash = useContext(TrashTaskContext);
  // Erreur de développeur (détail hors du layout de /tasks), jamais affichée à l'utilisateur.
  if (!trash) throw new Error("useTrashTask hors de TaskTrashProvider");
  return trash;
}

/**
 * Emplacement du message dans la fenêtre du détail ouvert (ref de React 19, avec nettoyage) : hors de la
 * fenêtre modale, le message et « Annuler » seraient inertes (un clic dehors ferme le détail).
 */
export type TrashNoticeHost = (
  element: HTMLElement | null,
) => (() => void) | undefined;

export const TrashNoticeHostContext = createContext<TrashNoticeHost | null>(
  null,
);

export function useTrashNoticeHost(): TrashNoticeHost {
  const host = useContext(TrashNoticeHostContext);
  // Erreur de développeur (détail hors du layout de /tasks), jamais affichée à l'utilisateur.
  if (!host) throw new Error("useTrashNoticeHost hors de TaskTrashProvider");
  return host;
}
