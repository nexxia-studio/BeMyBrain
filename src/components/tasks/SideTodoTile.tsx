// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Tuiles « To-do privée » / « To-do pro » (spec todo-unifiee, « Tableau de bord ») : tuile verre (DESIGN.md § 5),
// surtitre et titre, lien « Tout voir » à droite vers `/tasks` (la liste montre le côté actif, celui de la
// tuile), espaces couverts, puis les 5 prochaines tâches du côté en lignes `row` (TaskRow : case à cocher,
// lien vers le détail). Vide : phrase et bouton « Ajouter une tâche ». Lecture en échec : un message, le reste
// du tableau de bord s'affiche. Une colonne à toutes les largeurs (tuile large, grille BentoGrid).
// À la hauteur de son contenu (DESIGN.md § 6, QA-5 d'effets-de-verre) : lignes et espaces sur une seule ligne,
// aucun état de remplissage ; vide, l'état vide compact (TileCompactEmpty), que le givre de chargement rend aussi.
// Mouvement : enveloppe animée par GSAP (révélation, bascule), surface par Motion (survol) : jamais le même
// élément (ADR-006).
import Link from "next/link";
import { useTranslations } from "next-intl";

import { TileCompactEmpty } from "@/components/bento/TileCompactEmpty";
import { TileHeading } from "@/components/bento/TileHeading";
import {
  GLASS_TILE_BODY_CLASSES,
  TILE_ADD_CLASSES,
  TILE_LINK_CLASSES,
  tileClasses,
} from "@/components/bento/tile-sizes";
import { TileSpaces } from "@/components/bento/TileSpaces";
import { TileSurface } from "@/components/bento/TileSurface";
import { QuickAddTrigger } from "@/components/quick-add/QuickAddTrigger";
import { TASKS_PATH } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";
import type { DashboardTile } from "@/modules/dashboard/tiles";
import type { Task } from "@/modules/tasks/queries";
import { isOverdue, sideTileItems } from "@/modules/tasks/view";

import { TaskRow } from "./TaskRow";

type SideTodoTileProps = {
  /** Tuile To-do du côté actif (`privateTodo` ou `proTodo`). */
  tile: DashboardTile;
  /** Prochaines tâches du côté (`listUpcomingTasks`) ; null si la lecture a échoué. */
  tasks: Task[] | null;
  /** Jour local `YYYY-MM-DD` : échéance passée en braise. */
  today: string;
  /** Pastille d'espace sur les lignes : seulement s'il y a à distinguer (plusieurs espaces, aucun filtré). */
  showContext: boolean;
};

export function SideTodoTile({
  tile,
  tasks,
  today,
  showContext,
}: SideTodoTileProps) {
  const t = useTranslations("dashboard.tiles");
  const tList = useTranslations("tasks.list");
  const items = tasks === null ? null : sideTileItems(tasks, tile.side);
  const seeAll = (
    <Link
      href={TASKS_PATH}
      className={cn(TILE_LINK_CLASSES, "hover:text-link-hover")}
    >
      {t("seeAll")}
    </Link>
  );

  return (
    // Enveloppe : animée par GSAP (révélation, bascule) ; la surface dedans l'est par Motion.
    <div
      data-signature="reveal"
      data-testid={`tile-${tile.id}`}
      data-side={tile.side}
      className={cn("flex", tileClasses(tile.size))}
    >
      <TileSurface
        className={cn("glass rounded-tile", GLASS_TILE_BODY_CLASSES)}
      >
        {items !== null && items.length === 0 ? (
          <TileCompactEmpty
            tile={tile}
            seeAll={seeAll}
            add={
              <QuickAddTrigger
                label={tList("add")}
                className={cn(TILE_ADD_CLASSES, "hover:bg-primary-hover")}
              >
                {tList("add")}
              </QuickAddTrigger>
            }
          />
        ) : (
          <>
            <TileHeading tile={tile} action={seeAll} />
            <TileSpaces tile={tile} />
            {items === null ? (
              <p role="status" className="text-small text-foreground">
                {t("tasksError")}
              </p>
            ) : (
              <ul aria-label={t("upcoming")} className="flex flex-col gap-2">
                {items.map((task) => (
                  <li key={task.id}>
                    <TaskRow
                      task={task}
                      overdue={isOverdue(task, today)}
                      showDate
                      showContext={showContext}
                      layout="tile"
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </TileSurface>
    </div>
  );
}
