"use client";

// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Ligne de la tuile pleine « Aujourd'hui » (DESIGN.md § 5) : `on-primary-surface`, bord `on-primary-border`,
// titre `text-body` et légende `text-caption` en blanc plein (le blanc atténué tomberait sous 4,5:1 sur cette
// surface). Case à cocher blanche (zone 44 px), puis lien vers le détail sur le reste de la ligne. Légende :
// côté (jamais de pastille colorée dans la tuile pleine), parente, échéance passée, heure. Une colonne à toutes
// les largeurs. Cocher : même règle que la liste (useTaskToggle), pas d'optimiste, erreur dans la ligne.
// Mouvement : pression du lien seulement (Motion, scale 0,97) ; la tuile entière est animée par GSAP, pas la ligne.
import { CornerDownRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { TASKS_PATH } from "@/components/shell/nav-items";
import { useTaskToggle } from "@/components/tasks/use-task-toggle";
import type { Task } from "@/modules/tasks/queries";
import { dueDateInstant, isOverdue } from "@/modules/tasks/view";

const MotionLink = motion.create(Link);

type TodayTaskRowProps = {
  task: Task;
  /** Jour local `YYYY-MM-DD` : la date ne s'écrit que pour une tâche en retard. */
  today: string;
};

export function TodayTaskRow({ task, today }: TodayTaskRowProps) {
  const t = useTranslations("tasks");
  const tSide = useTranslations("shell.side");
  const format = useFormatter();
  const { pending, failure, toggle } = useTaskToggle(task);

  return (
    <li className="flex flex-col rounded-lg border border-on-primary-border bg-on-primary-surface">
      <div className="flex min-h-11 items-start gap-1 pr-3.5 pl-0.5">
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center has-disabled:cursor-not-allowed">
          <input
            type="checkbox"
            checked={false}
            disabled={pending}
            onChange={toggle}
            className="size-4.5 cursor-pointer accent-primary-foreground focus-visible:outline-ring-on-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="sr-only">
            {t("list.complete", { title: task.title })}
          </span>
        </label>
        <MotionLink
          href={`${TASKS_PATH}/${task.id}`}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5 text-primary-foreground no-underline hover:text-primary-foreground focus-visible:outline-ring-on-primary"
        >
          {/* Contenu saisi : jamais traduit. */}
          <span className="line-clamp-2 text-body break-words">
            {task.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption">
            <span className="font-semibold">{tSide(task.side)}</span>
            {task.parentTitle !== null && (
              <span className="flex min-w-0 items-center gap-1">
                <CornerDownRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                  strokeWidth={2}
                />
                <span className="sr-only">{t("list.parent")}</span>
                <span className="truncate">{task.parentTitle}</span>
              </span>
            )}
            {task.dueDate !== null && isOverdue(task, today) && (
              <span>
                {format.dateTime(dueDateInstant(task.dueDate), {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {task.dueTime !== null && <span>{task.dueTime}</span>}
          </span>
        </MotionLink>
      </div>
      {failure !== null && (
        <p role="alert" className="px-3.5 pb-2.5 text-caption font-semibold">
          {failure.code !== undefined
            ? t(`errors.${failure.code}`)
            : t("list.updateFailed")}
        </p>
      )}
    </li>
  );
}
