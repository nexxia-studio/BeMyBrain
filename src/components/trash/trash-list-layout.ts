// Géométrie de la corbeille `/trash` (QA-3 d'effets-de-verre) : classes qui fixent la place et la hauteur de la
// tuile et des lignes, définies une seule fois, lues par TrashList, TrashRow et leur givre (`src/app/(app)/trash/loading.tsx`).

/** Tuile de verre de la corbeille (sans `glass`, posé par le composant ou par FrostTile). */
export const TRASH_LIST_TILE_CLASSES =
  "flex flex-col gap-3 rounded-tile p-tile";
/** Lignes de la corbeille. */
export const TRASH_ROWS_CLASSES = "flex flex-col gap-2";
/** Ligne (surface `row`). */
export const TRASH_ROW_CLASSES = "flex flex-col rounded-lg bg-row";
/** Rangée de la ligne : contenu puis « Restaurer ». */
export const TRASH_ROW_LINE_CLASSES =
  "flex min-h-11 items-start gap-2 pr-1.5 pl-3.5";
/** Bloc de contenu : contenu du type puis date de mise à la corbeille. */
export const TRASH_ROW_CONTENT_CLASSES =
  "flex min-w-0 flex-1 flex-col gap-0.5 py-2.5";
/** Taille de la date de mise à la corbeille. */
export const TRASH_ROW_DATE_TEXT = "text-caption";
