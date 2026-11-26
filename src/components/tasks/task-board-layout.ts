// Géométrie du tableau `/tasks` partagée avec son givre de chargement (`TaskBoardFrost`), sur le modèle de
// `task-list-layout.ts` : les classes qui fixent la place et la hauteur des cartes sont définies une seule fois,
// lues par `TaskCard` et par le givre. Le givre reproduit une carte « standard » (titre sur une ligne, légende
// sur une ligne) avec des cales `h-lh` aux mêmes tailles de texte.
// Les classes des onglets et des colonnes, elles, appartiennent à `SortableBoard` (fichier figé, qui ne les
// exporte pas) : elles sont recopiées ici et verrouillées contre le vrai tableau par `task-board-layout.test.tsx`.

/** Carte : forme et surface « Creux » (sans l'ombre, que le calque du glisser ne porte pas). */
export const TASK_CARD_CLASSES =
  "flex min-h-11 flex-col justify-center gap-1 rounded-lg border border-border bg-popover px-3.5 py-2.5";
/** Ombre de la carte en place. */
export const TASK_CARD_SHADOW = "shadow-raised";
/** Taille du titre d'une carte. */
export const TASK_CARD_TITLE_TEXT = "text-body";
/** Légende d'une carte : rangée d'informations. */
export const TASK_CARD_LEGEND_CLASSES =
  "flex flex-wrap items-center gap-x-2.5 gap-y-1";
/** Taille de la légende d'une carte. */
export const TASK_CARD_LEGEND_TEXT = "text-caption";

// Copies de `SortableBoard` (verrouillées par test).

/** Enveloppe en verre de la barre d'onglets, sous 768 px seulement. */
export const BOARD_TABS_CLASSES = "glass relative rounded-full md:hidden";
/** Barre d'onglets. */
export const BOARD_TABLIST_CLASSES = "flex gap-1 rounded-full p-1";
/** Hauteur d'un onglet. */
export const BOARD_TAB_HEIGHT = "min-h-11";
/** Rangée des colonnes : une seule sous 768 px, côte à côte au-delà. */
export const BOARD_COLUMNS_CLASSES =
  "mt-grid flex flex-col md:mt-0 md:flex-row md:gap-grid md:overflow-x-auto md:pb-2";
/** Colonne (surface `pill-track`, sans verre). */
export const BOARD_COLUMN_CLASSES =
  "flex flex-col gap-2 rounded-tile bg-pill-track p-tile md:shrink-0";
/** Largeur d'une colonne ouverte. */
export const BOARD_COLUMN_OPEN_CLASSES = "md:w-80";
/** Colonne repliée en bandeau (768 px et plus) : large comme son libellé. */
export const BOARD_COLUMN_FOLDED_CLASSES =
  "md:relative md:w-auto md:items-center";
/** Colonne qui n'est pas celle de l'onglet choisi : masquée sous 768 px. */
export const BOARD_COLUMN_UNCHOSEN_CLASSES = "hidden md:flex";
/** En-tête de colonne, à partir de 768 px. */
export const BOARD_HEADER_CLASSES = "hidden items-center gap-2 md:flex";
/** En-tête d'un bandeau replié : bouton au-dessus du libellé. */
export const BOARD_HEADER_FOLDED_CLASSES = "md:flex-col-reverse";
/** Titre de colonne (libellé et compteur) : donne la hauteur de l'en-tête. */
export const BOARD_HEADING_CLASSES =
  "flex min-h-11 flex-1 items-center justify-between gap-2 text-eyebrow uppercase";
/** Titre d'un bandeau replié : libellé au-dessus du compteur, jamais coupé. */
export const BOARD_HEADING_FOLDED_CLASSES =
  "md:min-h-0 md:flex-none md:flex-col md:gap-1 md:whitespace-nowrap";
/** Bouton rond d'une colonne repliable. */
export const BOARD_TOGGLE_CLASSES = "size-11 shrink-0";
/** Cartes d'une colonne. */
export const BOARD_CARDS_CLASSES = "flex min-h-11 flex-col gap-2";
