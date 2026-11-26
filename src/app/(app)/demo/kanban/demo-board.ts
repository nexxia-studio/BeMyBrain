// Démo du kanban (BRAIN-46) : état du tableau en mémoire et « serveur » simulé, sans React. Une colonne par
// statut de tâche, dans l'ordre d'affichage ; chaque colonne liste les ids de ses cartes, de haut en bas.
// L'application d'un déplacement est celle du tableau (`applyMove`, `src/components/kanban/board-moves.ts`).
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban ; le vrai rangement (rang
// entre deux voisines) se décide à la spec.
import type { BoardMove } from "@/components/kanban/SortableBoard";

export const DEMO_STATUSES = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
] as const;
export type DemoStatus = (typeof DEMO_STATUSES)[number];

export type DemoBoard = Record<DemoStatus, readonly string[]>;

/** Cartes visibles de « Terminée » avant « Tout voir ». */
export const DONE_VISIBLE = 20;

/** Statut d'une carte : la colonne où elle se trouve. */
export function statusOf(board: DemoBoard, id: string): DemoStatus | undefined {
  return DEMO_STATUSES.find((status) => board[status].includes(id));
}

/** Changement de statut depuis le détail : la carte passe en tête de la colonne, `null` si rien ne change. */
export function statusMove(
  board: DemoBoard,
  id: string,
  status: DemoStatus,
): BoardMove | null {
  if (statusOf(board, id) === status) return null;
  return {
    id,
    toColumn: status,
    beforeId: null,
    afterId: board[status][0] ?? null,
  };
}

/** Enregistrement simulé : répond après `latencyMs`, en échec si demandé. */
export function simulateSave({
  latencyMs,
  fail,
}: {
  latencyMs: number;
  fail: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(!fail), latencyMs);
  });
}
