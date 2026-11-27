"use client";

// Curseurs nexxia-design (spec todo-kanban, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Carte d'une tâche du tableau (spec todo-kanban, « Tableau »), purement d'affichage : titre (deux lignes au
// plus), puis légende dans l'ordre parente (sous-tâche), « Bloquée », pastille d'espace, échéance (braise en
// retard), tags, compteur de sous-tâches, badge de priorité (accroché à l'information qui le précède, jamais seul
// sur une ligne : `TaskLegendItems`). Sans information, pas de légende.
// Compteur de sous-tâches : il signale les sous-tâches encore ouvertes, à l'encre tant qu'il en reste, en texte
// secondaire sinon ; sur une parente fermée qui en a encore, la mention « n ouvertes » en clair (terminer une
// parente ne ferme pas ses sous-tâches).
// Surface « Creux » (DESIGN.md § 5) : `popover` opaque à fin contour `border` et `shadow-raised`. Calque du
// glisser : même carte, sans ombre propre ni repère ; ombre, inclinaison, survol et empreinte viennent de
// `SortableBoard`. Carte fermée (terminée ou annulée) : titre en texte secondaire et légende sans couleur
// (`grayscale`, pastilles et badge compris ; pas d'opacité, qui ferait tomber le texte sous 4,5:1).
import { CornerDownRight, ListChecks, Tag } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import type { CardState } from "@/components/kanban/SortableBoard";
import { cn } from "@/lib/utils";
import type { Task } from "@/modules/tasks/queries";
import {
  dueDateInstant,
  isOverdue,
  subtaskCounter,
  tagList,
} from "@/modules/tasks/view";

import { BlockedChip } from "./BlockedChip";
import { contextChipClass } from "./context-chip-class";
import { isRowPriority } from "./priority-icons";
import { PriorityBadge } from "./PriorityBadge";
import {
  TASK_CARD_CLASSES,
  TASK_CARD_LEGEND_CLASSES,
  TASK_CARD_LEGEND_TEXT,
  TASK_CARD_SHADOW,
  TASK_CARD_TITLE_TEXT,
} from "./task-board-layout";
import { TaskLegendItems } from "./TaskLegendItems";

type TaskCardProps = {
  task: Task;
  /** `YYYY-MM-DD`, jour de l'utilisateur. */
  today: string;
  /** Faux quand il n'y a rien à distinguer (côté à un seul espace, ou espace filtré). */
  showContext: boolean;
  state: CardState;
};

export function TaskCard({ task, today, showContext, state }: TaskCardProps) {
  const t = useTranslations("tasks");
  const format = useFormatter();
  const locale = useLocale();
  const closed =
    task.statusCategory === "completed" || task.statusCategory === "canceled";
  const overdue = isOverdue(task, today);
  const counter = subtaskCounter(task);
  const hasOpenSubtasks = task.subtaskOpen > 0;
  const hasPriority = isRowPriority(task.priority);
  const hasParent = task.parentTitle !== null;
  const showChip = showContext && task.contextName !== null;
  const hasTags = task.tags.length > 0;
  const hasLegend =
    hasParent ||
    task.blocked ||
    showChip ||
    task.dueDate !== null ||
    hasTags ||
    counter !== null ||
    hasPriority;

  return (
    <div
      // Le calque du glisser n'est pas la carte en place : pas de repère, la carte se retrouve sans ambiguïté.
      data-task-card={state.overlay ? undefined : task.id}
      className={cn(
        TASK_CARD_CLASSES,
        // Le calque du glisser porte déjà son ombre (`SortableBoard`).
        !state.overlay && TASK_CARD_SHADOW,
      )}
    >
      {/* Contenu saisi : jamais traduit. */}
      <span
        className={cn(
          TASK_CARD_TITLE_TEXT,
          "line-clamp-2 break-words",
          closed && "text-muted-foreground",
        )}
      >
        {task.title}
      </span>
      {hasLegend && (
        <span
          data-card-legend=""
          className={cn(
            TASK_CARD_LEGEND_CLASSES,
            TASK_CARD_LEGEND_TEXT,
            "text-muted-foreground",
            closed && "grayscale",
          )}
        >
          <TaskLegendItems
            priority={
              hasPriority ? <PriorityBadge priority={task.priority} /> : null
            }
          >
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
            {task.blocked && <BlockedChip />}
            {showChip && (
              <span
                className={`truncate ${contextChipClass(task.contextColor ?? "neutral")}`}
              >
                {task.contextName}
              </span>
            )}
            {task.dueDate !== null &&
              (task.dueDate === today ? (
                <span
                  className={cn(
                    "whitespace-nowrap",
                    !closed && "text-foreground",
                  )}
                >
                  {t("list.sections.today")}
                  {task.dueTime !== null && ` · ${task.dueTime}`}
                </span>
              ) : (
                <span
                  className={cn(
                    "whitespace-nowrap",
                    overdue && "text-destructive",
                  )}
                >
                  {overdue && (
                    <span className="sr-only">
                      {t("list.sections.overdue")}
                    </span>
                  )}
                  {format.dateTime(dueDateInstant(task.dueDate), {
                    day: "numeric",
                    month: "short",
                  })}
                  {task.dueTime !== null && ` · ${task.dueTime}`}
                </span>
              ))}
            {hasTags && (
              <span className="flex min-w-0 items-center gap-1">
                <Tag
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                  strokeWidth={2}
                />
                <span className="sr-only">{t("list.tags")}</span>
                {/* Contenu saisi : jamais traduit, seul le séparateur suit la langue. */}
                <span className="truncate">{tagList(task.tags, locale)}</span>
              </span>
            )}
            {counter !== null && (
              <span
                className={cn(
                  "flex items-center gap-1",
                  hasOpenSubtasks && "text-foreground",
                )}
              >
                <ListChecks
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                  strokeWidth={2}
                />
                <span aria-hidden="true">{counter}</span>
                {closed && hasOpenSubtasks ? (
                  <>
                    <span aria-hidden="true">
                      {t("card.subtasksOpen", { count: task.subtaskOpen })}
                    </span>
                    <span className="sr-only">
                      {t("card.subtasksOpenLabel", {
                        done: task.subtaskDone,
                        total: task.subtaskTotal,
                        open: task.subtaskOpen,
                      })}
                    </span>
                  </>
                ) : (
                  <span className="sr-only">
                    {t("list.subtasks", {
                      done: task.subtaskDone,
                      total: task.subtaskTotal,
                    })}
                  </span>
                )}
              </span>
            )}
          </TaskLegendItems>
        </span>
      )}
    </div>
  );
}
