import { CHIP_SHAPE_CLASSES } from "./context-chip-class";

// Géométrie de la liste `/tasks` et des lignes de tâche de la corbeille (QA-3 d'effets-de-verre) : les classes qui
// fixent la place et la hauteur de la liste, des sections et des lignes, définies une seule fois. Lues par les vrais
// composants (TaskList, TaskRow, TaskTrashRow) et par leur givre de chargement (`src/app/(app)/tasks/(list)/loading.tsx`,
// `src/app/(app)/trash/loading.tsx`) : aucune valeur recopiée. Le givre reproduit une ligne « standard » (titre sur une ligne, légende sur une ligne)
// avec des cales `h-lh` dans les mêmes tailles de texte : sa hauteur suit la charte, la langue et la police.

/** Liste : colonne de sections, bornée en largeur, posée à nu sur la brume (aucun verre). */
export const TASK_LIST_CLASSES = "flex w-full max-w-3xl flex-col gap-grid";
/**
 * Section d'échéance : en-tête puis lignes, dans un creux `pill-track` (surface « Creux » de DESIGN.md § 5, la
 * même qu'une colonne du tableau). Aucun texte secondaire directement dessus.
 */
export const TASK_SECTION_CLASSES =
  "flex flex-col gap-3 rounded-tile bg-pill-track p-tile";
/** En-tête de section (titre en surtitre et compteur). */
export const TASK_SECTION_HEADER_CLASSES = "flex items-baseline gap-2 px-1";
/** Taille du titre de section et de son compteur : donne la hauteur de l'en-tête. */
export const TASK_SECTION_HEADING_TEXT = "text-eyebrow";
/** Lignes d'une section. */
export const TASK_ROWS_CLASSES = "flex flex-col gap-2";
/** Ligne de tâche (surface `row` : celle d'une ligne posée dans une tuile de verre). */
export const TASK_ROW_CLASSES = "flex flex-col rounded-lg bg-row";
/**
 * Surface d'une ligne de la liste `/tasks`, à la place de `row` : carte claire de la surface « Creux » (opaque,
 * contour `border`, `shadow-raised`), comme une carte du tableau. Le contour est tracé vers l'intérieur
 * (`outline`, pas `border`) : il ne prend aucune place, la ligne garde sa boîte (44 px sans légende).
 */
export const TASK_LIST_ROW_SURFACE_CLASSES =
  "bg-popover shadow-raised outline -outline-offset-1 outline-border";
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
/**
 * Légende d'une ligne de la liste : grille d'une case où se superposent la cale et la rangée d'éléments. La cale
 * donne à la légende la hauteur d'une pastille, qu'elle en affiche une ou non : la ligne a la même hauteur avec ou
 * sans pastille d'espace (ou « Annulée »), et le givre la reproduit.
 * raccourci: une légende sans pastille gagne 1,4 px (pastille 19,6 px contre une ligne de légende de 18,2 px) —
 * à revoir si la charte des lignes change (pastille plus basse ou légende plus haute).
 */
export const TASK_ROW_LEGEND_CLASSES = "grid grid-cols-1";
/** Place de la cale et de la rangée d'éléments dans la grille de la légende (même case). */
export const TASK_ROW_LEGEND_CELL_CLASSES = "col-start-1 row-start-1";
/** Cale invisible de la légende : une pastille vide (`box-content h-lh` : une ligne de `text-chip` + padding). */
export const TASK_ROW_LEGEND_STRUT_CLASSES = `${CHIP_SHAPE_CLASSES} ${TASK_ROW_LEGEND_CELL_CLASSES} invisible box-content h-lh w-0`;

/** Contenu d'une tâche à la corbeille : titre puis légende. */
export const TASK_TRASH_ROW_CLASSES = "flex min-w-0 flex-col gap-0.5";
/** Légende d'une tâche à la corbeille (pastilles). */
export const TASK_TRASH_LEGEND_CLASSES =
  "flex flex-wrap items-center gap-x-2.5 gap-y-1";
/**
 * Pastille de côté (Privé / Pro), toujours présente : donne la hauteur de la légende. Bordée, elle est plus haute
 * que la pastille d'espace : une légende de la corbeille a donc la même hauteur avec ou sans pastille d'espace.
 */
export const SIDE_CHIP_CLASSES = `${CHIP_SHAPE_CLASSES} border border-border`;
