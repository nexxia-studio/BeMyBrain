// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Tuile de module sans données (DESIGN.md § 5–6) : surtitre, titre, espaces couverts, puis état vide
// (icône et phrase qui dit à quoi sert la tuile). Aucune donnée inventée (PRODUCT.md).
// raccourci: pas d'action dans l'état vide, aucun module n'existe encore — chaque module ajoute la sienne.
// raccourci: pastilles d'espace neutres, la couleur par espace n'est pas encore en base — à attribuer
// avec les espaces personnalisables (BRAIN-30).
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { DashboardTile } from "@/modules/dashboard/tiles";

import { TILE_ICONS } from "./tile-icons";
import { TILE_SIZE_CLASSES } from "./tile-sizes";
import { TileSurface } from "./TileSurface";

type EmptyTileProps = {
  tile: DashboardTile;
};

export function EmptyTile({ tile }: EmptyTileProps) {
  const t = useTranslations("dashboard.tiles");
  const Icon = TILE_ICONS[tile.id];

  return (
    // Enveloppe : animée par GSAP (révélation, bascule) ; la surface dedans l'est par Motion.
    <div
      data-signature="reveal"
      data-testid={`tile-${tile.id}`}
      data-side={tile.side}
      className={cn("flex min-w-0", TILE_SIZE_CLASSES[tile.size])}
    >
      <TileSurface className="glass flex w-full flex-col gap-4 rounded-tile p-tile">
        <div className="flex flex-col gap-1.5">
          <p className="text-eyebrow text-muted-foreground uppercase">
            {t(`${tile.id}.eyebrow`)}
          </p>
          <h3 className="font-heading text-title text-foreground">
            {t(`${tile.id}.title`)}
          </h3>
        </div>
        {tile.spaceLabels.length > 0 ? (
          <ul aria-label={t("spaces")} className="flex flex-wrap gap-1.5">
            {tile.spaceLabels.map((space) => (
              // Nom saisi par l'utilisateur : affiché tel quel, jamais traduit.
              <li
                key={space}
                className="rounded-full bg-chip-neutral px-2.5 py-0.5 text-chip text-chip-neutral-foreground"
              >
                {space}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex flex-col items-start gap-3">
          <span
            data-signature="empty"
            className="flex size-11 items-center justify-center rounded-lg bg-row text-link"
          >
            <Icon aria-hidden="true" className="size-5.5" strokeWidth={2} />
          </span>
          <p
            data-signature="empty"
            className="max-w-prose text-small text-muted-foreground"
          >
            {t(`${tile.id}.body`)}
          </p>
        </div>
      </TileSurface>
    </div>
  );
}
