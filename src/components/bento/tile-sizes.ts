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

// Hauteur du contenu (DESIGN.md § 6, QA-5 et QA-6 d'effets-de-verre, décisions d'Antoine du 2026-11-23) : aucune
// hauteur fixe. Une rangée a la hauteur de sa tuile la plus haute, et ses tuiles s'y étirent (alignées en bas) ;
// en une colonne, chaque tuile a la hauteur de son contenu. Dans une tuile étirée, le contenu reste en haut et
// l'action du bas (bouton d'ajout, « Voir la to-do ») est poussée en bas (`mt-auto`). Le givre
// (`dashboard/loading.tsx`) reprend ces classes, la hauteur relevée de chaque tuile (cookie, QA-6) et, sans
// relevé, celle de l'état vide compact par les composants partagés (`TileCompactEmpty`, `TodayHead`).

/** Grille bento : vraie grille (BentoGrid) et givre. Sans `items-*` : les tuiles d'une rangée s'étirent. */
export const BENTO_GRID_CLASSES = "flex flex-wrap gap-grid";

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
