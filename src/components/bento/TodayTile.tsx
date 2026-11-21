// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Tuile « Aujourd'hui » (DESIGN.md § 5) : la seule tuile pleine de l'app. Date du jour selon la langue,
// salutation, puis la to-do du jour des deux côtés (spec todo-unifiee) : pastilles de chiffres « En retard » et
// « Aujourd'hui », les 3 premières tâches (côté en légende) et le lien « Voir la to-do » (la liste
// montre le côté actif seulement, pas « tout »). Hauteur fixe (tile-sizes.ts, DESIGN.md § 6) : sous 3 tâches,
// « Rien d'autre aujourd'hui » comble la place sous les lignes ; rien de dû, la phrase « rien en retard » prend
// cette place (TileRest), jamais du blanc.
// Lecture en échec : un message à la place, la tuile et le reste du tableau de bord s'affichent quand même.
// Une colonne à toutes les largeurs ; les deux pastilles restent côte à côte, même à 390 px.
// Animée par GSAP seul (entrée du tableau de bord) : aucun survol Motion sur la tuile.
// raccourci: salutation sans prénom, la session ne porte pas le nom de l'utilisateur — à ajouter avec
// l'onboarding (BRAIN-31).
import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { TASKS_PATH } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";
import {
  TODAY_TILE_LIMIT,
  type TodayTile as TodayTileData,
} from "@/modules/tasks/view";

import { TileRest } from "./TileRest";
import { TODAY_TILE_CLASSES } from "./tile-sizes";
import { TodayTaskRow } from "./TodayTaskRow";

type TodayTileProps = {
  /** Le côté actif a au moins un espace (sinon ses tuiles n'existent pas, la tuile le dit). */
  hasSpaces: boolean;
  /** Jour local `YYYY-MM-DD` (`todayIn(getUserTimeZone(), now)`). */
  today: string;
  /** Tâches en retard et du jour (`todayTileItems`) ; null si la lecture a échoué. */
  due: TodayTileData | null;
};

export function TodayTile({ hasSpaces, today, due }: TodayTileProps) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const now = useNow();
  const hasDue = due !== null && due.items.length > 0;
  const intro = !hasSpaces ? t("today.introNoSpace") : null;
  const clear = hasSpaces && due !== null && !hasDue;

  return (
    <section
      data-signature="intro"
      data-testid="tile-today"
      className={cn(
        "flex flex-col justify-between gap-5.5 rounded-tile bg-primary p-today text-primary-foreground shadow-today",
        TODAY_TILE_CLASSES,
      )}
    >
      <div className="flex flex-col gap-2.5">
        <p
          data-signature-item
          data-testid="today-date"
          className="text-eyebrow text-on-primary-muted uppercase"
        >
          {format.dateTime(now, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h2 data-signature-item className="font-heading text-display">
          {t("today.greeting")}
        </h2>
        {intro !== null && (
          <p
            data-signature-item
            className="max-w-105 text-lead text-on-primary-lead"
          >
            {intro}
          </p>
        )}
      </div>
      {clear && (
        <div data-signature-item className="flex flex-1 flex-col">
          <TileRest label={t("today.introClear")} tone="primary" />
        </div>
      )}
      {due === null && (
        <p
          data-signature-item
          role="status"
          className="text-small font-semibold"
        >
          {t("today.error")}
        </p>
      )}
      {due !== null && hasDue && (
        <div data-signature-item className="flex flex-1 flex-col gap-3">
          {/* Pastilles de chiffres : chiffre en `text-stat`, libellé `text-small` en blanc plein. */}
          <div className="flex gap-2.5">
            {(
              [
                ["today-overdue-count", due.overdueCount, "today.overdue"],
                ["today-due-count", due.todayCount, "today.dueToday"],
              ] as const
            ).map(([testId, value, label]) => (
              <p
                key={testId}
                className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border border-on-primary-border bg-on-primary-surface px-3.5 py-2.5 sm:flex-none sm:basis-35"
              >
                <span data-testid={testId} className="text-stat">
                  {value}
                </span>
                <span className="text-small">{t(label)}</span>
              </p>
            ))}
          </div>
          <ul aria-label={t("today.list")} className="flex flex-col gap-2">
            {due.items.map((task) => (
              <TodayTaskRow key={task.id} task={task} today={today} />
            ))}
          </ul>
          {due.items.length < TODAY_TILE_LIMIT && (
            <TileRest label={t("today.nothingElse")} tone="primary" />
          )}
          <Link
            href={TASKS_PATH}
            className="flex min-h-11 items-center self-start text-small font-semibold text-primary-foreground no-underline hover:text-primary-foreground hover:underline focus-visible:outline-ring-on-primary"
          >
            {t("today.seeAll")}
          </Link>
        </div>
      )}
    </section>
  );
}
