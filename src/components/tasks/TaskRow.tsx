"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Ligne de la liste (spec todo-unifiee, « Liste ») : case à cocher (zone 44 px, libellé sur la case seule),
// puis un lien vers le détail qui couvre le reste de la ligne : titre (deux lignes au plus), puis légende
// (parente, espace, échéance, heure, tags, priorité, compteur de sous-tâches). Une seule colonne à toutes les
// largeurs : la légende passe à la ligne sous 390 px, le badge de priorité jamais seul (accroché à l'information
// qui le précède). Variante `tile` (tuiles To-do du tableau de bord, hauteur
// fixe, DESIGN.md § 6) : titre tronqué sur une ligne, légende sur une ligne coupée au bord ; la liste et le détail
// gardent le titre complet.
// Cocher : `tasks.complete` par le registre (`runAppAction`, origine `app`) ; rouvrir une tâche fermée (terminée
// ou annulée, case cochée ; l'annulée porte le repère « Annulée ») : `tasks.update` vers « À faire ». Pas d'optimiste : la case garde l'état reçu du serveur et reste désactivée
// pendant l'appel ; la ligne sort (TaskList) quand le rendu serveur ne la contient plus. Erreur dans la ligne.
import { CornerDownRight, ListChecks, Tag } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { Task } from "@/modules/tasks/queries";
import { dueDateInstant, subtaskCounter, tagList } from "@/modules/tasks/view";

import { TASKS_PATH } from "../shell/nav-items";
import { CHIP_SHAPE_CLASSES, contextChipClass } from "./context-chip-class";
import { isRowPriority } from "./priority-icons";
import { PriorityBadge } from "./PriorityBadge";
import {
  TASK_ROW_CLASSES,
  TASK_ROW_LEGEND_CELL_CLASSES,
  TASK_ROW_LEGEND_CLASSES,
  TASK_ROW_LEGEND_STRUT_CLASSES,
  TASK_ROW_LEGEND_TEXT,
  TASK_ROW_LINE_CLASSES,
  TASK_ROW_TEXT_CLASSES,
  TASK_ROW_TITLE_TEXT,
} from "./task-list-layout";
import { TaskLegendItems } from "./TaskLegendItems";
import { useTaskToggle } from "./use-task-toggle";

const MotionLink = motion.create(Link);

// Priorité (ordre Linear : 1 urgente … 4 basse) : badge teinté à icône (`PriorityBadge`, teinte et icône du niveau,
// les mêmes que la pastille Priorité du détail), rien pour 0. Le libellé lu par les lecteurs d'écran porte le niveau.

type TaskRowProps = {
  task: Task;
  /** Échéance écrite en braise (section « En retard »). */
  overdue: boolean;
  /** Faux dans « Aujourd'hui » et « Demain » : la section dit déjà le jour. */
  showDate: boolean;
  /** Faux quand il n'y a rien à distinguer (côté à un seul espace, ou espace filtré). */
  showContext: boolean;
  /** Requête de la liste à garder dans le lien du détail (`?completed=1` ou rien, `listQuery`). */
  listQuery?: string;
  /** Surface propre à un emplacement (ex. ligne posée sur le `popover` opaque du détail). */
  className?: string;
  /** `tile` : une seule ligne (tuile du tableau de bord, DESIGN.md § 6) ; `list` (défaut) : titre sur deux lignes, légende à la ligne. */
  layout?: "list" | "tile";
};

export function TaskRow({
  task,
  overdue,
  showDate,
  showContext,
  listQuery = "",
  className,
  layout = "list",
}: TaskRowProps) {
  const oneLine = layout === "tile";
  const t = useTranslations("tasks");
  const format = useFormatter();
  const locale = useLocale();
  const { closed, canceled, pending, failure, toggle } = useTaskToggle(task);
  const counter = subtaskCounter(task);
  const hasPriority = isRowPriority(task.priority);
  // Éléments de la légende : sans aucun, ni légende ni cale (la ligne garde 44 px).
  const hasParent = task.parentTitle !== null;
  const showChip = showContext && task.contextName !== null;
  const shownDueDate = showDate ? task.dueDate : null;
  const hasTime = task.dueTime !== null;
  const hasTags = task.tags.length > 0;
  const hasLegend =
    canceled ||
    hasParent ||
    showChip ||
    shownDueDate !== null ||
    hasTime ||
    hasTags ||
    hasPriority ||
    counter !== null;

  // Liste : accrochée à l'information qui la précède (`TaskLegendItems`). Tuile : légende sur une ligne, à la suite.
  const priority = hasPriority ? (
    <PriorityBadge priority={task.priority} />
  ) : null;

  return (
    // Survol du lien de la ligne : fond `accent` sur toute la ligne (DESIGN.md § 2, états dérivés).
    <div className={cn(TASK_ROW_CLASSES, "has-[a:hover]:bg-accent", className)}>
      <div className={TASK_ROW_LINE_CLASSES}>
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center has-disabled:cursor-not-allowed">
          <input
            type="checkbox"
            checked={closed}
            disabled={pending}
            onChange={toggle}
            className="size-4.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="sr-only">
            {t(
              canceled
                ? "list.reopenCanceled"
                : closed
                  ? "list.reopen"
                  : "list.complete",
              { title: task.title },
            )}
          </span>
        </label>
        <MotionLink
          href={`${TASKS_PATH}/${task.id}${listQuery}`}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className={cn(
            TASK_ROW_TEXT_CLASSES,
            "rounded-lg text-foreground no-underline hover:text-foreground",
          )}
        >
          {/* Contenu saisi : jamais traduit. */}
          <span
            className={cn(
              oneLine ? "truncate" : "line-clamp-2 break-words",
              TASK_ROW_TITLE_TEXT,
              closed && "text-muted-foreground",
            )}
          >
            {task.title}
          </span>
          {hasLegend && (
            <span
              className={cn(
                TASK_ROW_LEGEND_CLASSES,
                TASK_ROW_LEGEND_TEXT,
                "text-muted-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={TASK_ROW_LEGEND_STRUT_CLASSES}
              />
              <span
                className={cn(
                  TASK_ROW_LEGEND_CELL_CLASSES,
                  "flex min-w-0 items-center gap-x-2.5",
                  oneLine
                    ? // Coupée au bord en largeur seulement : le badge (20 px) dépasse de 0,2 px la cale (19,6 px).
                      "flex-nowrap overflow-x-clip whitespace-nowrap"
                    : "flex-wrap gap-y-1",
                )}
              >
                <TaskLegendItems priority={oneLine ? null : priority}>
                  {canceled && (
                    <span
                      className={cn(
                        CHIP_SHAPE_CLASSES,
                        "bg-chip-neutral text-chip-neutral-foreground",
                      )}
                    >
                      {t("list.canceled")}
                    </span>
                  )}
                  {hasParent && (
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
                  {/* Pastille de la couleur de l'espace ; nom et couleur viennent de la même ligne de contexts. */}
                  {showChip && (
                    <span
                      className={`truncate ${contextChipClass(task.contextColor ?? "neutral")}`}
                    >
                      {task.contextName}
                    </span>
                  )}
                  {shownDueDate !== null && (
                    <span className={cn(overdue && "text-destructive")}>
                      {format.dateTime(dueDateInstant(shownDueDate), {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                  {hasTime && <span>{task.dueTime}</span>}
                  {hasTags && (
                    <span className="flex min-w-0 items-center gap-1">
                      <Tag
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                        strokeWidth={2}
                      />
                      <span className="sr-only">{t("list.tags")}</span>
                      {/* Contenu saisi : jamais traduit, seul le séparateur suit la langue. */}
                      <span className="truncate">
                        {tagList(task.tags, locale)}
                      </span>
                    </span>
                  )}
                </TaskLegendItems>
                {oneLine && priority}
                {counter !== null && (
                  <span className="flex items-center gap-1">
                    <ListChecks
                      aria-hidden="true"
                      className="size-3.5 shrink-0"
                      strokeWidth={2}
                    />
                    <span aria-hidden="true">{counter}</span>
                    <span className="sr-only">
                      {t("list.subtasks", {
                        done: task.subtaskDone,
                        total: task.subtaskTotal,
                      })}
                    </span>
                  </span>
                )}
              </span>
            </span>
          )}
        </MotionLink>
      </div>
      {failure !== null && (
        <p role="alert" className="px-3.5 pb-2.5 text-caption text-destructive">
          {failure.code !== undefined
            ? t(`errors.${failure.code}`)
            : t("list.updateFailed")}
        </p>
      )}
    </div>
  );
}
