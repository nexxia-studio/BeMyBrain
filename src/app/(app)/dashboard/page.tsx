// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Tableau de bord bento (BRAIN-7, DESIGN.md § 5–7) : titre et filtre d'espace (mobile), tuile pleine
// « Aujourd'hui », puis les tuiles vides du côté actif, restreintes aux espaces retenus. Repli sous
// 768 px : une colonne, sauf la paire de tuiles chiffre (BentoGrid).
import { getTranslations } from "next-intl/server";

import { BentoGrid } from "@/components/bento/BentoGrid";
import { EmptyTile } from "@/components/bento/EmptyTile";
import { TodayTile } from "@/components/bento/TodayTile";
import { PageHeader } from "@/components/shell/PageHeader";
import { loadSideSpaces } from "@/lib/context-filter";
import { requireSession } from "@/lib/session";
import { buildDashboard } from "@/modules/dashboard/tiles";

export default async function DashboardPage() {
  // Mémoïsées par requête : le layout les a déjà appelées, pas de seconde lecture.
  const [session, sideSpaces, t] = await Promise.all([
    requireSession(),
    loadSideSpaces(),
    getTranslations("dashboard"),
  ]);
  const dashboard = buildDashboard(sideSpaces);

  return (
    <main className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} />
      <BentoGrid side={dashboard.side}>
        <TodayTile
          spaces={dashboard.spaces}
          workspaceName={session.workspaceName}
        />
        {dashboard.tiles.map((tile) => (
          <EmptyTile key={tile.id} tile={tile} />
        ))}
      </BentoGrid>
    </main>
  );
}
