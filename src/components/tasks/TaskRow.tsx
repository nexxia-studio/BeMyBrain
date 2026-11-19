"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Ligne de la liste (spec todo-unifiee, « Liste ») : case à cocher (zone 44 px, libellé sur la case seule),
// puis un lien vers le détail qui couvre le reste de la ligne : titre (deux lignes au plus), puis légende
// (parente, espace, échéance, heure, tags, priorité, compteur de sous-tâches). Une seule colonne à toutes les
// largeurs : la légende passe à la ligne sous 390 px.
// Cocher : `tasks.complete` par le registre (`runAppAction`, origine `app`) ; rouvrir une tâche fermée (terminée
// ou annulée, case cochée ; l'annulée porte le repère « Annulée ») : `tasks.update` vers « À faire ». Pas d'optimiste : la case garde l'état reçu du serveur et reste désactivée
// pendant l'appel ; la ligne sort (TaskList) quand le rendu serveur ne la contient plus. Erreur dans la ligne.
import {
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  CornerDownRight,
  ListChecks,
  type LucideIcon,
  Minus,
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

// Priorité (ordre Linear : 1 urgente … 4 basse) ; rien pour 0. Formes distinctes à 16 px (chevrons), jamais en
// braise : la braise est réservée à l'échéance en retard. Urgente et haute en encre des liens, les autres en
// encre secondaire. Le libellé lu par les lecteurs d'écran porte l'information, l'icône la double.
const PRIORITY_ICONS: Record<1 | 2 | 3 | 4, LucideIcon> = {
  1: ChevronsUp,
  2: ChevronUp,
  3: Minus,
  4: ChevronDown,
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
  /** Faux quand il n'y a rien à distinguer (côté à un seul espace, ou espace filtré). */
  showContext: boolean;
  /** Requête de la liste à garder dans le lien du détail (`?completed=1` ou rien, `listQuery`). */
  listQuery?: string;
  /** Surface propre à un emplacement (ex. ligne posée sur le `popover` opaque du détail). */
  className?: string;
};

export function TaskRow({
  task,
  overdue,
  showDate,
  showContext,
  listQuery = "",
  className,
}: TaskRowProps) {
  const t = useTranslations("tasks");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure>(null);

  const canceled = task.statusCategory === "canceled";
  // Fermée (terminée ou annulée) : case cochée, un tap la rouvre.
  const closed = task.statusCategory === "completed" || canceled;
  const counter = subtaskCounter(task);
  const PriorityIcon = isPriority(task.priority)
    ? PRIORITY_ICONS[task.priority]
    : null;

  function toggle() {
    if (pending) return;
    setFailure(null);
    startTransition(async () => {
      const outcome = await settleAction(() =>
        closed
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
    // Survol du lien de la ligne : fond `accent` sur toute la ligne (DESIGN.md § 2, états dérivés).
    <div
      className={cn(
        "flex flex-col rounded-lg bg-row has-[a:hover]:bg-accent",
        className,
      )}
    >
      <div className="flex min-h-11 items-start gap-1 pr-3.5 pl-0.5">
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
          className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5 text-foreground no-underline hover:text-foreground"
        >
          {/* Contenu saisi : jamais traduit. */}
          <span
            className={cn(
              "line-clamp-2 text-body break-words",
              closed && "text-muted-foreground",
            )}
          >
            {task.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-muted-foreground empty:hidden">
            {canceled && (
              <span className="rounded-full bg-chip-neutral px-2.5 py-0.5 text-chip text-chip-neutral-foreground">
                {t("list.canceled")}
              </span>
            )}
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
                  className={cn("size-4", task.priority <= 2 && "text-link")}
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
