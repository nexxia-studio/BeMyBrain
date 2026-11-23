// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Tuile de module sans données (DESIGN.md § 5–6) : son état vide compact (TileCompactEmpty : surtitre, titre,
// espaces couverts, icône et phrase qui dit à quoi sert la tuile). Aucune donnée inventée (PRODUCT.md). À la
// hauteur de son message (QA-5 d'effets-de-verre) : le givre de chargement rend le même corps.
// raccourci: pas d'action dans l'état vide, aucun module n'existe encore — chaque module ajoute la sienne.
import { cn } from "@/lib/utils";
import type { DashboardTile } from "@/modules/dashboard/tiles";

import { TileCompactEmpty } from "./TileCompactEmpty";
import { GLASS_TILE_BODY_CLASSES, tileClasses } from "./tile-sizes";
import { TileSurface } from "./TileSurface";

type EmptyTileProps = {
  tile: DashboardTile;
};

export function EmptyTile({ tile }: EmptyTileProps) {
  return (
    // Enveloppe : animée par GSAP (révélation, bascule) ; la surface dedans l'est par Motion.
    <div
      data-signature="reveal"
      data-testid={`tile-${tile.id}`}
      data-tile={tile.id}
      data-side={tile.side}
      className={cn("flex", tileClasses(tile.size))}
    >
      <TileSurface
        className={cn("glass rounded-tile", GLASS_TILE_BODY_CLASSES)}
      >
        <TileCompactEmpty tile={tile} />
      </TileSurface>
    </div>
  );
}
