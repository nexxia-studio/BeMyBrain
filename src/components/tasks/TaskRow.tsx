"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Ligne de la liste (spec todo-unifiee, « Liste ») : case à cocher (zone 44 px, libellé sur la case seule),
// puis un lien vers le détail qui couvre le reste de la ligne : titre (deux lignes au plus), puis légende
// (parente, espace, échéance, heure, tags, priorité, compteur de sous-tâches). Une seule colonne à toutes les
// largeurs : la légende passe à la ligne sous 390 px.
// Cocher : `tasks.complete` par le registre (`runAppAction`, origine `app`) ; rouvrir une tâche terminée :
// `tasks.update` vers « À faire ». Pas d'optimiste : la case garde l'état reçu du serveur et reste désactivée
// pendant l'appel ; la ligne sort (TaskList) quand le rendu serveur ne la contient plus. Erreur dans la ligne.
import {
  CircleAlert,
  CornerDownRight,
  ListChecks,
  type LucideIcon,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Tag,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";
import { cn } from "@/lib/utils";
import type { TaskErrorCode } from "@/modules/tasks/errors";
import type { Task } from "@/modules/tasks/queries";
import { dueDateInstant, subtaskCounter } from "@/modules/tasks/view";

import { TASKS_PATH } from "../shell/nav-items";

const MotionLink = motion.create(Link);

// Icônes de priorité (ordre Linear : 1 urgente … 4 basse) ; aucune pour 0.
const PRIORITY_ICONS: Record<1 | 2 | 3 | 4, LucideIcon> = {
  1: CircleAlert,
  2: SignalHigh,
  3: SignalMedium,
  4: SignalLow,
};

function isPriority(value: number): value is 1 | 2 | 3 | 4 {
  return value >= 1 && value <= 4;
}

type Failure = { code?: TaskErrorCode } | null;

type TaskRowProps = {
  task: Task;
  /** Échéance écrite en braise (section « En retard »). */
  overdue: boolean;
  /** Faux dans « Aujourd'hui » et « Demain » : la section dit déjà le jour. */
  showDate: boolean;
  /** Faux quand la liste est filtrée sur un espace : la pastille serait la même partout. */
  showContext: boolean;
};

export function TaskRow({
  task,
  overdue,
  showDate,
  showContext,
}: TaskRowProps) {
  const t = useTranslations("tasks");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure>(null);

  const done = task.statusCategory === "completed";
  const counter = subtaskCounter(task);
  const PriorityIcon = isPriority(task.priority)
    ? PRIORITY_ICONS[task.priority]
    : null;

  function toggle() {
    if (pending) return;
    setFailure(null);
    startTransition(async () => {
      const outcome = await settleAction(() =>
        done
          ? runAppAction("tasks.update", {
              taskId: task.id,
              statusCategory: "unstarted",
            })
          : runAppAction("tasks.complete", { taskId: task.id }),
      );
      if (outcome.ok && outcome.value.ok) return;
      setFailure({
        code: outcome.ok && !outcome.value.ok ? outcome.value.code : undefined,
      });
    });
  }

  return (
    <div className="flex flex-col rounded-lg bg-row">
      <div className="flex min-h-11 items-start gap-1 pr-3.5 pl-0.5">
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center has-disabled:cursor-not-allowed">
          <input
            type="checkbox"
            checked={done}
            disabled={pending}
            onChange={toggle}
            className="size-4.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="sr-only">
            {t(done ? "list.reopen" : "list.complete", { title: task.title })}
          </span>
        </label>
        <MotionLink
          href={`${TASKS_PATH}/${task.id}`}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 text-foreground no-underline hover:text-foreground"
        >
          {/* Contenu saisi : jamais traduit. */}
          <span
            className={cn(
              "line-clamp-2 text-body break-words",
              done && "text-muted-foreground",
            )}
          >
            {task.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-muted-foreground empty:hidden">
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
            {/* raccourci: pastille d'espace neutre, aucune couleur par espace en base — à brancher avec la
                décision d'Antoine sur la couleur des espaces (même attente que ContextChip). */}
            {showContext && task.contextName !== null && (
              <span className="truncate rounded-full bg-chip-neutral px-2.5 py-0.5 text-chip text-chip-neutral-foreground">
                {task.contextName}
              </span>
            )}
            {showDate && task.dueDate !== null && (
              <span className={cn(overdue && "text-destructive")}>
                {format.dateTime(dueDateInstant(task.dueDate), {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {task.dueTime !== null && <span>{task.dueTime}</span>}
            {task.tags.length > 0 && (
              <span className="flex min-w-0 items-center gap-1">
                <Tag
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                  strokeWidth={2}
                />
                <span className="sr-only">{t("list.tags")}</span>
                {task.tags.map((tag) => (
                  <span key={tag} className="truncate">
                    {tag}
                  </span>
                ))}
              </span>
            )}
            {PriorityIcon !== null && isPriority(task.priority) && (
              <span className="flex items-center">
                <PriorityIcon
                  aria-hidden="true"
                  className={cn(
                    "size-4",
                    task.priority === 1 && "text-destructive",
                  )}
                  strokeWidth={2}
                />
                <span className="sr-only">
                  {t(`list.priority.${task.priority}`)}
                </span>
              </span>
            )}
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
