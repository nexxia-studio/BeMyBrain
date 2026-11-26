// Tableau réduit à ses identifiants et application d'un déplacement, sans React ni bibliothèque de glisser :
// rien de propre aux tâches. Sert à rejouer les déplacements en attente d'enregistrement par-dessus le tableau
// enregistré (`use-board-moves.ts`).
import type { BoardMove } from "./SortableBoard";

/** Une colonne par clé, dans l'ordre d'affichage ; chaque colonne liste les ids de ses cartes, de haut en bas. */
export type BoardIds<K extends string = string> = Readonly<
  Record<K, readonly string[]>
>;

/** La carte est dans une colonne du tableau. */
export function boardHas(board: BoardIds, id: string): boolean {
  return Object.values(board).some((column) => column.includes(id));
}

/** Mêmes colonnes dans le même ordre, mêmes cartes dans le même ordre. */
export function sameBoard(a: BoardIds, b: BoardIds): boolean {
  if (a === b) return true;
  const columns = Object.keys(a);
  const others = Object.keys(b);
  return (
    columns.length === others.length &&
    columns.every((columnId, index) => {
      const ids = a[columnId];
      const otherIds = b[columnId];
      return (
        others[index] === columnId &&
        ids.length === otherIds.length &&
        ids.every((id, rank) => otherIds[rank] === id)
      );
    })
  );
}

/**
 * Pose la carte dans sa colonne d'arrivée, par la même règle que le serveur (`moveTask`, spec todo-kanban,
 * « Ordre manuel »), pour que l'affichage optimiste et le tableau enregistré coïncident : juste après sa voisine
 * du dessus ; à défaut juste avant celle du dessous ; à défaut (voisines absentes ou parties entre-temps) en tête
 * de colonne. Carte absente du tableau ou colonne inconnue : le tableau est rendu tel quel (déplacement
 * abandonné, tableau remplacé entre-temps).
 */
export function applyMove<K extends string>(
  board: BoardIds<K>,
  move: BoardMove,
): BoardIds<K> {
  if (!Object.hasOwn(board, move.toColumn) || !boardHas(board, move.id)) {
    return board;
  }
  const next = Object.fromEntries(
    Object.entries<readonly string[]>(board).map(([columnId, ids]) => [
      columnId,
      ids.filter((id) => id !== move.id),
    ]),
  ) as Record<K, string[]>;
  const column = next[move.toColumn as K];
  const before = move.beforeId === null ? -1 : column.indexOf(move.beforeId);
  const after = move.afterId === null ? -1 : column.indexOf(move.afterId);
  const index = before >= 0 ? before + 1 : Math.max(after, 0);
  column.splice(index, 0, move.id);
  return next;
}
