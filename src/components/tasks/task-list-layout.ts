// Géométrie de la liste `/tasks` et des lignes de tâche de la corbeille (QA-3 d'effets-de-verre) : les classes qui
// fixent la place et la hauteur de la tuile, des sections et des lignes, définies une seule fois. Lues par les vrais
// composants (TaskList, TaskRow, TaskTrashRow) et par leur givre de chargement (TaskListFrost, TrashListFrost) :
// aucune valeur recopiée. Le givre reproduit une ligne « standard » (titre sur une ligne, légende sur une ligne)
// avec des cales `h-lh` dans les mêmes tailles de texte : sa hauteur suit la charte, la langue et la police.

/** Tuile de verre de la liste (sans `glass`, posé par le composant ou par FrostTile). */
export const TASK_LIST_TILE_CLASSES =
  "flex w-full max-w-3xl flex-col gap-6 rounded-tile p-tile";
/** Section d'échéance : en-tête puis lignes. */
export const TASK_SECTION_CLASSES = "flex flex-col gap-3";
/** En-tête de section (titre en surtitre et compteur). */
export const TASK_SECTION_HEADER_CLASSES = "flex items-baseline gap-2 px-1";
/** Taille du titre de section et de son compteur : donne la hauteur de l'en-tête. */
export const TASK_SECTION_HEADING_TEXT = "text-eyebrow";
/** Lignes d'une section. */
export const TASK_ROWS_CLASSES = "flex flex-col gap-2";
/** Ligne de la liste (surface `row`). */
export const TASK_ROW_CLASSES = "flex flex-col rounded-lg bg-row";
/** Rangée de la ligne : case à cocher (44 px) puis texte. */
export const TASK_ROW_LINE_CLASSES =
  "flex min-h-11 items-start gap-1 pr-3.5 pl-0.5";
/** Bloc de texte de la ligne (titre puis légende). */
export const TASK_ROW_TEXT_CLASSES =
  "flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5";
/** Taille du titre d'une ligne (liste et corbeille). */
export const TASK_ROW_TITLE_TEXT = "text-body";
/** Taille de la légende d'une ligne (liste et corbeille). */
export const TASK_ROW_LEGEND_TEXT = "text-caption";

/** Contenu d'une tâche à la corbeille : titre puis légende. */
export const TASK_TRASH_ROW_CLASSES = "flex min-w-0 flex-col gap-0.5";
/** Légende d'une tâche à la corbeille (pastilles). */
export const TASK_TRASH_LEGEND_CLASSES =
  "flex flex-wrap items-center gap-x-2.5 gap-y-1";
/** Pastille de côté (Privé / Pro), toujours présente : donne la hauteur de la légende. */
export const SIDE_CHIP_CLASSES =
  "rounded-full border border-border px-2.5 py-0.5 text-chip";
