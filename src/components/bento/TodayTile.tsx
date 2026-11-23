// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Tuile « Aujourd'hui » (DESIGN.md § 5) : la seule tuile pleine de l'app. Date du jour selon la langue,
// salutation, puis la to-do du jour des deux côtés (spec todo-unifiee) : pastilles de chiffres « En retard » et
// « Aujourd'hui », les 3 premières tâches (côté en légende) et le lien « Voir la to-do » (la liste
// montre le côté actif seulement, pas « tout »). À la hauteur de son contenu (DESIGN.md § 6, QA-5
// d'effets-de-verre) : rien de dû, l'état vide compact (TodayHead avec « Rien en retard… »), que le givre de
// chargement rend aussi ; aucun état de remplissage sous des lignes peu nombreuses.
// Lecture en échec : un message à la place, la tuile et le reste du tableau de bord s'affichent quand même.
// Une colonne à toutes les largeurs ; les deux pastilles restent côte à côte, même à 390 px.
// Animée par GSAP seul (entrée du tableau de bord) : aucun survol Motion sur la tuile.
// raccourci: salutation sans prénom, la session ne porte pas le nom de l'utilisateur — à ajouter avec
// l'onboarding (BRAIN-31).
import Link from "next/link";
import { useTranslations } from "next-intl";

import { TASKS_PATH } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";
import type { TodayTile as TodayTileData } from "@/modules/tasks/view";

import { TODAY_TILE_BODY_CLASSES, TODAY_TILE_CLASSES } from "./tile-sizes";
import { TodayHead } from "./TodayHead";
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
  const hasDue = due !== null && due.items.length > 0;
  const intro = !hasSpaces
    ? t("today.introNoSpace")
    : due !== null && !hasDue
      ? t("today.introClear")
      : null;

  return (
    <section
      data-signature="intro"
      data-testid="tile-today"
      className={cn(
        "rounded-tile bg-primary text-primary-foreground shadow-today",
        TODAY_TILE_BODY_CLASSES,
        TODAY_TILE_CLASSES,
      )}
    >
      <TodayHead intro={intro} />
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
        <div data-signature-item className="flex flex-col gap-3">
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
