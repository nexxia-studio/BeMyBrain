// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Tuiles « To-do privée » / « To-do pro » (spec todo-unifiee, « Tableau de bord ») : tuile verre (DESIGN.md § 5),
// surtitre et titre, lien « Tout voir » à droite vers `/tasks` (la liste montre le côté actif, celui de la
// tuile), espaces couverts, puis les 5 prochaines tâches du côté en lignes `row` (TaskRow : case à cocher,
// lien vers le détail). Vide : phrase et bouton « Ajouter une tâche ». Lecture en échec : un message, le reste
// du tableau de bord s'affiche. Une colonne à toutes les largeurs (tuile large, grille BentoGrid).
// Hauteur fixe (tile-sizes.ts, DESIGN.md § 6) : lignes et espaces sur une seule ligne ; sous 5 tâches, « Rien
// d'autre à venir » comble la place sous les lignes (TileRest), jamais du blanc.
// Mouvement : enveloppe animée par GSAP (révélation, bascule), surface par Motion (survol) : jamais le même
// élément (ADR-006).
import { ListTodo } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { TileRest } from "@/components/bento/TileRest";
import { tileClasses } from "@/components/bento/tile-sizes";
import { TileSurface } from "@/components/bento/TileSurface";
import { QuickAddTrigger } from "@/components/quick-add/QuickAddTrigger";
import { TASKS_PATH } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";
import type { DashboardTile } from "@/modules/dashboard/tiles";
import type { Task } from "@/modules/tasks/queries";
import {
  isOverdue,
  SIDE_TILE_LIMIT,
  sideTileItems,
} from "@/modules/tasks/view";

import { contextChipClass } from "./context-chip-class";
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

  return (
    // Enveloppe : animée par GSAP (révélation, bascule) ; la surface dedans l'est par Motion.
    <div
      data-signature="reveal"
      data-testid={`tile-${tile.id}`}
      data-side={tile.side}
      className={cn("flex", tileClasses(tile.size))}
    >
      <TileSurface className="glass flex w-full flex-col gap-4 rounded-tile p-tile">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-eyebrow text-muted-foreground uppercase">
              {t(`${tile.id}.eyebrow`)}
            </p>
            <h3 className="font-heading text-title text-foreground">
              {t(`${tile.id}.title`)}
            </h3>
          </div>
          <Link
            href={TASKS_PATH}
            className="-my-2.5 flex min-h-11 shrink-0 items-center text-small font-semibold text-link no-underline hover:text-link-hover"
          >
            {t("seeAll")}
          </Link>
        </div>
        {tile.spaceLabels.length > 0 && (
          <ul
            aria-label={t("spaces")}
            className="flex flex-nowrap gap-1.5 overflow-hidden"
          >
            {tile.spaceLabels.map((space) => (
              // Nom saisi par l'utilisateur : affiché tel quel, jamais traduit ; pastille de sa couleur, tronquée.
              <li
                key={space.name}
                className={cn(
                  contextChipClass(space.color),
                  "min-w-0 truncate",
                )}
              >
                {space.name}
              </li>
            ))}
          </ul>
        )}
        {items === null ? (
          <p role="status" className="text-small text-foreground">
            {t("tasksError")}
          </p>
        ) : items.length === 0 ? (
          <div className="mt-auto flex flex-col items-start gap-3">
            <span
              data-signature="empty"
              className="flex size-11 items-center justify-center rounded-lg bg-row text-link"
            >
              <ListTodo
                aria-hidden="true"
                className="size-5.5"
                strokeWidth={2}
              />
            </span>
            <p
              data-signature="empty"
              className="max-w-prose text-small text-muted-foreground"
            >
              {t(`${tile.id}.body`)}
            </p>
            <QuickAddTrigger
              label={tList("add")}
              className="min-h-11 rounded-full bg-primary px-5 text-body font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              {tList("add")}
            </QuickAddTrigger>
          </div>
        ) : (
          <>
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
            {items.length < SIDE_TILE_LIMIT && (
              <TileRest label={t("nothingElse")} tone="glass" />
            )}
          </>
        )}
      </TileSurface>
    </div>
  );
}
