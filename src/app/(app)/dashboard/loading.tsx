// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Chargement du tableau de bord (DESIGN.md § 5 « États de chargement — givre ») : le vrai en-tête, puis la
// tuile pleine « Aujourd'hui » et une tuile givrée par tuile du côté actif, aux classes de place et dans la
// grille de tile-sizes.ts (les mêmes que les vraies tuiles) : ordre et largeur des tuiles inchangés à l'arrivée
// du contenu. Hauteur (QA-5 d'effets-de-verre) : chaque tuile givrée prend celle de l'état vide compact de sa
// tuile, rendu ici en cale invisible et inerte par les composants mêmes de la vraie tuile (TileCompactEmpty,
// TodayHead), dans le même corps : aucune valeur recopiée. Une tuile qui a des données s'ajuste en hauteur à
// l'arrivée du contenu, jusqu'aux hauteurs mémorisées de QA-6.
// Une colonne sous 768 px, sauf la paire de tuiles chiffre. CSS pur ; éclaircissement unique, aucune boucle (§ 11).
// Filtre d'espace de l'en-tête (mobile) : place réservée, invisible et inerte (`filterInert`) ; utilisable
// seulement une fois la page chargée.
// En-tête et espaces du côté : lectures mémoïsées par requête, déjà faites par le layout (aucune requête en plus).
import { getTranslations } from "next-intl/server";

import { TileCompactEmpty } from "@/components/bento/TileCompactEmpty";
import {
  BENTO_GRID_CLASSES,
  GLASS_TILE_BODY_CLASSES,
  tileClasses,
  TODAY_TILE_BODY_CLASSES,
  TODAY_TILE_CLASSES,
} from "@/components/bento/tile-sizes";
import { TodayHead } from "@/components/bento/TodayHead";
import { FrostTile } from "@/components/loading/FrostTile";
import { PageHeader } from "@/components/shell/PageHeader";
import { loadSideSpaces } from "@/lib/context-filter";
import { cn } from "@/lib/utils";
import { buildDashboard } from "@/modules/dashboard/tiles";

export default async function DashboardLoading() {
  const [t, sideSpaces] = await Promise.all([
    getTranslations("dashboard"),
    loadSideSpaces(),
  ]);
  const { spaces, tiles } = buildDashboard(sideSpaces);

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} filterInert />
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div
        aria-hidden="true"
        data-testid="dashboard-frost"
        className={BENTO_GRID_CLASSES}
      >
        <FrostTile
          variant="solid"
          testId="frost-tile-today"
          className={TODAY_TILE_CLASSES}
        >
          <div inert className={cn(TODAY_TILE_BODY_CLASSES, "invisible")}>
            <TodayHead
              intro={
                spaces.length > 0
                  ? t("today.introClear")
                  : t("today.introNoSpace")
              }
            />
          </div>
        </FrostTile>
        {tiles.map((tile, i) => (
          <FrostTile
            key={tile.id}
            index={i + 1}
            testId={`frost-tile-${tile.id}`}
            className={tileClasses(tile.size)}
          >
            <div inert className={cn(GLASS_TILE_BODY_CLASSES, "invisible")}>
              <TileCompactEmpty tile={tile} />
            </div>
          </FrostTile>
        ))}
      </div>
    </main>
  );
}
