// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Tuile « Courses » (spec listes, « Tuile Courses ») : tuile chiffre de verre (DESIGN.md § 5–6), côté Privé
// seulement. Le nombre d'articles à acheter (`text-stat`) et les premiers, un par ligne tronquée (la paire de
// tuiles chiffre se partage une rangée à 390 px) ; « + N autres » au-delà. Toute la tuile est un seul lien vers
// `/lists/shopping` (zone ≥ 44 px) : un tap ouvre la liste, vide comme pleine (c'est là qu'on ajoute).
// Vide : l'état vide compact partagé (TileCompactEmpty, hauteur du givre). Lecture en échec : un message, le reste
// du tableau de bord s'affiche. À la hauteur de son contenu, aucun état de remplissage.
// Mouvement : enveloppe animée par GSAP (révélation, bascule), surface par Motion (survol) : jamais le même
// élément (ADR-006).
import Link from "next/link";
import { useTranslations } from "next-intl";

import { LISTS_PATH } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";
import type { DashboardTile } from "@/modules/dashboard/tiles";
import type { ShoppingSummary } from "@/modules/shopping/queries";

import { GLASS_TILE_BODY_CLASSES, tileClasses } from "./tile-sizes";
import { TileCompactEmpty } from "./TileCompactEmpty";
import { TileHeading } from "./TileHeading";
import { TileSurface } from "./TileSurface";

const SHOPPING_PATH = `${LISTS_PATH}/shopping`;

type ShoppingTileProps = {
  /** Tuile Courses du côté Privé. */
  tile: DashboardTile;
  /** Résumé de la liste (`getShoppingSummary`) ; null si la lecture a échoué. */
  summary: ShoppingSummary | null;
};

export function ShoppingTile({ tile, summary }: ShoppingTileProps) {
  const t = useTranslations("dashboard.tiles");
  const hasItems = summary !== null && summary.count > 0;
  const linkClasses =
    "flex min-h-11 grow flex-col gap-4 text-foreground no-underline hover:text-foreground focus-visible:outline-ring";

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
        {summary === null ? (
          <>
            <TileHeading tile={tile} />
            <p role="status" className="text-small text-foreground">
              {t("shopping.error")}
            </p>
          </>
        ) : (
          <Link href={SHOPPING_PATH} className={linkClasses}>
            {hasItems ? (
              <>
                <TileHeading tile={tile} />
                <p className="flex flex-col gap-0.5">
                  <span data-testid="shopping-count" className="text-stat">
                    {summary.count}
                  </span>
                  <span className="text-small text-muted-foreground">
                    {t("shopping.toBuy", { count: summary.count })}
                  </span>
                </p>
                <ul aria-label={t("shopping.first")} className="flex flex-col">
                  {summary.first.map((label, i) => (
                    // Libellé saisi par l'utilisateur : affiché tel quel, tronqué sur une ligne.
                    <li key={i} className="truncate text-small">
                      {label}
                    </li>
                  ))}
                </ul>
                {summary.count > summary.first.length && (
                  <p className="text-small text-muted-foreground">
                    {t("shopping.more", {
                      count: summary.count - summary.first.length,
                    })}
                  </p>
                )}
              </>
            ) : (
              <TileCompactEmpty tile={tile} />
            )}
          </Link>
        )}
      </TileSurface>
    </div>
  );
}
