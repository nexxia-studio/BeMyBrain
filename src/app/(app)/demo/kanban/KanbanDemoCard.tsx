"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Carte de la démo du kanban : titre (deux lignes au plus), puis légende reprise de la ligne de liste (`TaskRow`) :
// « Bloquée », pastille d'espace, échéance (braise en retard), tags, badge de priorité teinté (`PriorityBadge`,
// accroché à l'information qui le précède, jamais seul sur une ligne). Surface `popover` opaque à fin contour `border` dans les deux
// variantes (`demo-looks.ts`, D7) : la carte se détache du creux teinté de la colonne ; ombre `shadow-raised` dans
// la variante « creux » seulement. Calque du glisser : même carte, sans ombre propre ; ombre, inclinaison et
// empreinte viennent de `SortableBoard`.
// Pastille « Bloquée » : forme des pastilles, bordée `input` (≥ 3:1), texte encre, icône Lucide ; aucune couleur
// d'espace, la braise reste au retard. À valider à la spec.
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import { Ban, Tag } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import type { CardState } from "@/components/kanban/SortableBoard";
import {
  CHIP_SHAPE_CLASSES,
  contextChipClass,
} from "@/components/tasks/context-chip-class";
import { isRowPriority } from "@/components/tasks/priority-icons";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { TaskLegendItems } from "@/components/tasks/TaskLegendItems";
import { cn } from "@/lib/utils";
import { dueDateInstant, tagList } from "@/modules/tasks/view";

import type { DemoTask } from "./demo-fixtures";
import { type DemoLook, DEMO_LOOKS } from "./demo-looks";

const OPEN_STATUSES = new Set(["backlog", "unstarted", "started"]);

type KanbanDemoCardProps = {
  task: DemoTask;
  /** `YYYY-MM-DD`, jour de l'utilisateur. */
  today: string;
  state: CardState;
  look: DemoLook;
};

export function KanbanDemoCard({
  task,
  today,
  state,
  look,
}: KanbanDemoCardProps) {
  const t = useTranslations("tasks.list");
  const tDemo = useTranslations("kanbanDemo");
  const format = useFormatter();
  const locale = useLocale();
  const open = OPEN_STATUSES.has(task.status);
  const overdue = open && task.dueDate !== null && task.dueDate < today;
  const dueToday = task.dueDate === today;

  return (
    <div
      // Le calque du glisser n'est pas la carte en place : pas de repère, la carte se retrouve sans ambiguïté.
      data-demo-card={state.overlay ? undefined : task.id}
      className={cn(
        "flex min-h-11 flex-col justify-center gap-1 rounded-lg px-3.5 py-2.5",
        "border border-border bg-popover",
        // Le calque du glisser porte déjà son ombre (`SortableBoard`).
        !state.overlay && DEMO_LOOKS[look].cardShadow,
      )}
    >
      {/* Contenu saisi : jamais traduit. */}
      <span
        className={cn(
          "line-clamp-2 text-body break-words",
          !open && "text-muted-foreground",
        )}
      >
        {task.title}
      </span>
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-muted-foreground">
        <TaskLegendItems
          priority={
            isRowPriority(task.priority) ? (
              <PriorityBadge priority={task.priority} />
            ) : null
          }
        >
          {task.blocked && (
            <span
              className={cn(
                CHIP_SHAPE_CLASSES,
                "flex items-center gap-1 border border-input text-foreground",
              )}
            >
              <Ban aria-hidden="true" className="size-3.5" strokeWidth={2} />
              {tDemo("blocked")}
            </span>
          )}
          {task.contextName !== null && (
            <span className={`truncate ${contextChipClass(task.contextColor)}`}>
              {task.contextName}
            </span>
          )}
          {task.dueDate !== null &&
            (dueToday ? (
              <span className={cn(open && "text-foreground")}>
                {t("sections.today")}
              </span>
            ) : (
              <span className={cn(overdue && "text-destructive")}>
                {overdue && (
                  <span className="sr-only">{t("sections.overdue")}</span>
                )}
                {format.dateTime(dueDateInstant(task.dueDate), {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            ))}
          {task.tags.length > 0 && (
            <span className="flex min-w-0 items-center gap-1">
              <Tag
                aria-hidden="true"
                className="size-3.5 shrink-0"
                strokeWidth={2}
              />
              <span className="sr-only">{t("tags")}</span>
              <span className="truncate">{tagList(task.tags, locale)}</span>
            </span>
          )}
        </TaskLegendItems>
      </span>
    </div>
  );
}
