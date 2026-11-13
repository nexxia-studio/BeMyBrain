import type { TileSize } from "@/modules/dashboard/tiles";

/**
 * Base de largeur dans la grille bento (DESIGN.md § 6) : rangées `flex-wrap`, une colonne au téléphone
 * sans point de rupture ; seule la paire de tuiles chiffre (140 px) partage une rangée à 390 px.
 * Hauteur minimale par rangée sur ordinateur, comme la référence (300 et 230 px).
 */
export const TILE_SIZE_CLASSES: Record<TileSize, string> = {
  wide: "grow-2 basis-100 lg:min-h-75",
  standard: "grow basis-60 lg:min-h-57.5",
  figure: "grow basis-35 lg:min-h-57.5",
};
