// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// En-tête d'une tuile de verre (DESIGN.md § 5) : surtitre et titre, action à droite si la tuile en a une.
// Partagé par les vraies tuiles et le givre de chargement (TileCompactEmpty).
import { useTranslations } from "next-intl";

import type { DashboardTile } from "@/modules/dashboard/tiles";

type TileHeadingProps = {
  tile: DashboardTile;
  /** Lien d'action à droite (« Tout voir »). */
  action?: React.ReactNode;
};

export function TileHeading({ tile, action }: TileHeadingProps) {
  const t = useTranslations("dashboard.tiles");
  const titles = (
    <>
      <p className="text-eyebrow text-muted-foreground uppercase">
        {t(`${tile.id}.eyebrow`)}
      </p>
      <h3 className="font-heading text-title text-foreground">
        {t(`${tile.id}.title`)}
      </h3>
    </>
  );

  if (action === undefined) {
    return <div className="flex flex-col gap-1.5">{titles}</div>;
  }
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">{titles}</div>
      {action}
    </div>
  );
}
