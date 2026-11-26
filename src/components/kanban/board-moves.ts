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

/**
 * Pose la carte dans sa colonne d'arrivée : après sa voisine du dessus, sinon avant celle du dessous, sinon en
 * fin de colonne (voisines parties entre-temps, quand un déplacement précédent a été annulé). Carte absente du
 * tableau ou colonne inconnue : le tableau est rendu tel quel (déplacement abandonné, tableau remplacé entre-temps).
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
  const index =
    move.beforeId === null
      ? 0
      : before >= 0
        ? before + 1
        : after >= 0
          ? after
          : column.length;
  column.splice(index, 0, move.id);
  return next;
}
