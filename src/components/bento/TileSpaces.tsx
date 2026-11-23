// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Espaces couverts par une tuile (DESIGN.md § 6, « Une ligne dans les tuiles ») : pastilles sur une ligne,
// tronquées. Rien quand la tuile n'a pas d'espace à nommer. Partagé par les vraies tuiles et le givre.
import { useTranslations } from "next-intl";

import { contextChipClass } from "@/components/tasks/context-chip-class";
import { cn } from "@/lib/utils";
import type { DashboardTile } from "@/modules/dashboard/tiles";

type TileSpacesProps = {
  tile: DashboardTile;
};

export function TileSpaces({ tile }: TileSpacesProps) {
  const t = useTranslations("dashboard.tiles");

  if (tile.spaceLabels.length === 0) return null;
  return (
    <ul
      aria-label={t("spaces")}
      className="flex flex-nowrap gap-1.5 overflow-hidden"
    >
      {tile.spaceLabels.map((space) => (
        // Nom saisi par l'utilisateur : affiché tel quel, jamais traduit ; pastille de sa couleur, tronquée.
        <li
          key={space.name}
          className={cn(contextChipClass(space.color), "min-w-0 truncate")}
        >
          {space.name}
        </li>
      ))}
    </ul>
  );
}
