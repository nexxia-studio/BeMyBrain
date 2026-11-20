// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Chargement du tableau de bord (DESIGN.md § 5 « États de chargement — givre ») : le vrai titre, puis la
// tuile pleine « Aujourd'hui » vide et des tuiles givrées, aux classes de taille de la grille
// (tile-sizes.ts) : aucun décalage quand le contenu arrive. Même conteneur que BentoGrid : une colonne
// sous 768 px. CSS pur, rendu par le serveur ; éclaircissement unique, aucune boucle (DESIGN.md § 11).
import { getTranslations } from "next-intl/server";

import { TILE_SIZE_CLASSES } from "@/components/bento/tile-sizes";
import { FrostTile } from "@/components/loading/FrostTile";
import type { TileSize } from "@/modules/dashboard/tiles";

// Tuiles givrées après « Aujourd'hui » : la To-do du côté (large), présente des deux côtés, puis deux tuiles
// standard (forme des rangées du côté Pro).
// raccourci: forme fixe, le côté et les espaces ne sont pas lus pendant le chargement — la reprendre de
// buildDashboard si une lecture du côté sans requête devient possible.
const FROST_TILES: readonly TileSize[] = ["wide", "standard", "standard"];

// Sous 1024 px, les tuiles n'ont pas de hauteur minimale : le givre, vide, reprend celle de l'ordinateur
// pour approcher la hauteur du contenu réel.
const MOBILE_MIN_HEIGHT: Record<TileSize, string> = {
  wide: "min-h-75",
  standard: "min-h-57.5",
  figure: "min-h-57.5",
};

const tileClass = (size: TileSize) =>
  `min-w-0 ${TILE_SIZE_CLASSES[size]} ${MOBILE_MIN_HEIGHT[size]}`;

export default async function DashboardLoading() {
  const t = await getTranslations("dashboard");

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      {/* Même en-tête que PageHeader : la place de la pastille du filtre d'espace (min-h-11, sous 1024 px)
          est réservée, sinon titre et grille bougeraient à son arrivée. */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="min-w-0 font-heading text-page-title">{t("title")}</h1>
        <div aria-hidden="true" className="min-h-11 lg:hidden" />
      </header>
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div
        aria-hidden="true"
        data-testid="dashboard-frost"
        className="flex flex-wrap gap-grid"
      >
        <FrostTile variant="solid" className={tileClass("wide")} />
        {FROST_TILES.map((size, i) => (
          <FrostTile key={i} index={i + 1} className={tileClass(size)} />
        ))}
      </div>
    </main>
  );
}
