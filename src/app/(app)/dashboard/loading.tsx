// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Chargement du tableau de bord (DESIGN.md § 5 « États de chargement — givre ») : le vrai en-tête, puis la
// tuile pleine « Aujourd'hui » vide et une tuile givrée par tuile du côté actif, à ses classes de taille
// (tile-sizes.ts) : aucun décalage quand le contenu arrive. Même conteneur que BentoGrid : une colonne
// sous 768 px, sauf la paire de tuiles chiffre. CSS pur ; éclaircissement unique, aucune boucle (§ 11).
// Filtre d'espace de l'en-tête (mobile) : place réservée, invisible et inerte (`filterInert`) ; utilisable
// seulement une fois la page chargée.
// En-tête et espaces du côté : lectures mémoïsées par requête, déjà faites par le layout (aucune requête en plus).
import { getTranslations } from "next-intl/server";

import { TILE_SIZE_CLASSES } from "@/components/bento/tile-sizes";
import { FrostTile } from "@/components/loading/FrostTile";
import { PageHeader } from "@/components/shell/PageHeader";
import { loadSideSpaces } from "@/lib/context-filter";
import { buildDashboard, type TileSize } from "@/modules/dashboard/tiles";

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
  const [t, sideSpaces] = await Promise.all([
    getTranslations("dashboard"),
    loadSideSpaces(),
  ]);
  const { tiles } = buildDashboard(sideSpaces);

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} filterInert />
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div
        aria-hidden="true"
        data-testid="dashboard-frost"
        className="flex flex-wrap gap-grid"
      >
        <FrostTile variant="solid" className={tileClass("wide")} />
        {tiles.map((tile, i) => (
          <FrostTile
            key={tile.id}
            index={i + 1}
            className={tileClass(tile.size)}
          />
        ))}
      </div>
    </main>
  );
}
