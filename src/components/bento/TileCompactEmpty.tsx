// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// État vide compact d'une tuile de verre (DESIGN.md § 6, QA-5 d'effets-de-verre) : en-tête, espaces, puis
// l'icône et la phrase côte à côte (la phrase passe sous l'icône dans une tuile étroite), et pour la To-do le
// bouton d'ajout. Aucune hauteur imposée : la tuile a la hauteur de son message ; étirée par sa rangée (QA-6),
// le message reste en haut et le bouton d'ajout est poussé en bas.
// Source unique de cette hauteur : la vraie tuile (EmptyTile, SideTodoTile vide) rend ce composant dans sa
// surface, le givre de chargement (`dashboard/loading.tsx`) le rend en cale invisible et inerte, dans le même
// corps (`GLASS_TILE_BODY_CLASSES`). Actions : la vraie tuile passe son lien et son bouton ; sans eux (givre),
// des cales de mêmes classes et mêmes libellés.
import { ListTodo } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DashboardTile } from "@/modules/dashboard/tiles";

import { TILE_ICONS } from "./tile-icons";
import { TILE_ADD_CLASSES, TILE_LINK_CLASSES } from "./tile-sizes";
import { TileHeading } from "./TileHeading";
import { TileSpaces } from "./TileSpaces";

type TileCompactEmptyProps = {
  tile: DashboardTile;
  /** To-do : lien « Tout voir » de l'en-tête. */
  seeAll?: React.ReactNode;
  /** To-do : bouton « Ajouter une tâche ». */
  add?: React.ReactNode;
};

export function TileCompactEmpty({ tile, seeAll, add }: TileCompactEmptyProps) {
  const t = useTranslations("dashboard.tiles");
  const tList = useTranslations("tasks.list");
  const isTodo = tile.content === "tasks";
  const Icon = isTodo ? ListTodo : TILE_ICONS[tile.id];

  return (
    <>
      <TileHeading
        tile={tile}
        action={
          isTodo
            ? (seeAll ?? (
                <span className={TILE_LINK_CLASSES}>{t("seeAll")}</span>
              ))
            : undefined
        }
      />
      <TileSpaces tile={tile} />
      <div className="flex grow flex-col items-start gap-3">
        <div className="flex w-full flex-wrap items-center gap-3">
          <span
            data-signature="empty"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-row text-link"
          >
            <Icon aria-hidden="true" className="size-5.5" strokeWidth={2} />
          </span>
          <p
            data-signature="empty"
            className="max-w-prose min-w-0 grow basis-40 text-small text-muted-foreground"
          >
            {t(`${tile.id}.body`)}
          </p>
        </div>
        {isTodo && (
          <div className="mt-auto">
            {add ?? <span className={TILE_ADD_CLASSES}>{tList("add")}</span>}
          </div>
        )}
      </div>
    </>
  );
}
