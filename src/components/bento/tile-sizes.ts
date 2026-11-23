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

// Hauteur du contenu (DESIGN.md § 6, QA-5 d'effets-de-verre, décision d'Antoine du 2026-11-23) : aucune hauteur
// fixe. Une tuile a la hauteur de son contenu ; les rangées alignent leurs tuiles en haut, sans les étirer à la
// plus haute (une tuile vide garde la hauteur de son message, sans blanc ajouté). Le givre
// (`dashboard/loading.tsx`) reprend ces classes, et la hauteur de l'état vide compact de chaque tuile par les
// composants partagés (`TileCompactEmpty`, `TodayHead`) posés dans les corps ci-dessous.

/** Grille bento : vraie grille (BentoGrid) et givre. */
export const BENTO_GRID_CLASSES = "flex flex-wrap items-start gap-grid";

/** Classes de place d'une tuile de verre : largeur seule (vraie tuile et givre). */
export function tileClasses(size: TileSize): string {
  return `min-w-0 ${TILE_SIZE_CLASSES[size]}`;
}

/** Classes de place de la tuile pleine « Aujourd'hui » (vraie tuile et givre). */
export const TODAY_TILE_CLASSES = `min-w-0 ${TILE_SIZE_CLASSES.wide}`;

/** Corps d'une tuile de verre (padding et pas entre blocs) : surface de la vraie tuile, cale du givre. */
export const GLASS_TILE_BODY_CLASSES = "flex w-full flex-col gap-4 p-tile";

/** Corps de la tuile pleine « Aujourd'hui » : la vraie tuile, cale du givre. */
export const TODAY_TILE_BODY_CLASSES = "flex flex-col gap-5.5 p-today";

/** Lien d'action d'en-tête de tuile (« Tout voir ») : zone 44 px par padding, sans décaler l'en-tête. */
export const TILE_LINK_CLASSES =
  "-my-2.5 flex min-h-11 shrink-0 items-center text-small font-semibold text-link no-underline";

/** Bouton d'ajout de l'état vide de la To-do (et sa cale dans le givre). */
export const TILE_ADD_CLASSES =
  "flex min-h-11 items-center rounded-full bg-primary px-5 text-body font-semibold text-primary-foreground";
