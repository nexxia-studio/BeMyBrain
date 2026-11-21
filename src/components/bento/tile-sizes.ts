import type { TileSize } from "@/modules/dashboard/tiles";

/**
 * Base de largeur dans la grille bento (DESIGN.md § 6) : rangées `flex-wrap`, une colonne au téléphone
 * sans point de rupture ; seule la paire de tuiles chiffre (140 px) partage une rangée à 390 px.
 */
export const TILE_SIZE_CLASSES: Record<TileSize, string> = {
  wide: "grow-2 basis-100",
  standard: "grow basis-60",
  figure: "grow basis-35",
};

// Hauteurs fixes (DESIGN.md § 6, « Hauteurs fixes », QA-2 d'effets-de-verre) : par taille de tuile et pour la
// tuile pleine, par palier d'écran (téléphone, tablette dès 640 px, ordinateur dès 1024 px). Chacune est calée
// sur le contenu maximal de la tuile, mesuré à la largeur la plus étroite du palier, en FR et en EN :
// - Aujourd'hui : 2 pastilles + 3 tâches (`TODAY_TILE_LIMIT`) + lien ;
// - To-do (large) : en-tête, espaces, 5 tâches (`SIDE_TILE_LIMIT`) ;
// - tuiles vides : surtitre, titre (deux lignes possibles), espaces, icône et phrase.
// Les lignes des tuiles tiennent sur une ligne (titre tronqué) : la hauteur ne dépend jamais du contenu. Une
// rangée s'aligne sur sa tuile la plus haute (`min-h` + étirement de la rangée), comme la référence : la hauteur
// d'une tuile ne dépend que de la mise en page, que le givre (`dashboard/loading.tsx`) reproduit avec les mêmes
// classes.
// Valeurs (contenu maximal mesuré le 2026-11-21, Chromium, de 320 à 1700 px, arrondi au-dessus avec 4 à 8 px de
// marge) : téléphone / tablette / ordinateur.
// - large (To-do) : 490 / 491 / 503 px → 496 / 496 / 508 ;
// - standard : 225 / 225 / 258 px → 232 / 232 / 264 ;
// - chiffre : 251 / 252 / 264 px → 256 / 256 / 272 (titre anglais sur trois lignes à 140 px) ;
// - Aujourd'hui : 481 / 485 / 502 px → 488 / 492 / 508 (salutation en taille fluide).
export const TILE_HEIGHT_CLASSES: Record<TileSize, string> = {
  wide: "min-h-124 sm:min-h-124 lg:min-h-127",
  standard: "min-h-58 sm:min-h-58 lg:min-h-66",
  figure: "min-h-64 sm:min-h-64 lg:min-h-68",
};

/** Hauteur fixe de la tuile pleine « Aujourd'hui », mêmes paliers. */
export const TODAY_TILE_HEIGHT_CLASSES = "min-h-122 sm:min-h-123 lg:min-h-127";

/** Classes de place d'une tuile de verre : largeur puis hauteur (vraie tuile et givre). */
export function tileClasses(size: TileSize): string {
  return `min-w-0 ${TILE_SIZE_CLASSES[size]} ${TILE_HEIGHT_CLASSES[size]}`;
}

/** Classes de place de la tuile pleine « Aujourd'hui » (vraie tuile et givre). */
export const TODAY_TILE_CLASSES = `min-w-0 ${TILE_SIZE_CLASSES.wide} ${TODAY_TILE_HEIGHT_CLASSES}`;
