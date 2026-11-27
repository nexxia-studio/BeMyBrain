"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Sous-tâches du détail (spec todo-unifiee, « Détail ») : titre de section et compteur « n/m », lignes
// cochables (TaskRow : même case sans optimiste, lien vers le détail de la sous-tâche), puis le champ
// « Ajouter une sous-tâche » (`SubtaskAddField`, toujours affiché ; `tasks.create` sous cette tâche). Une colonne à toutes les
// largeurs. Lignes sur le `popover` opaque : contour `border` au lieu du fond `row` (blanc sur blanc), survol
// en `pill-track` comme les menus. Apparition et retrait d'une ligne : `opacity` + `y` 8 (DESIGN.md § 7).
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";
import type { Task } from "@/modules/tasks/queries";
import { isOverdue } from "@/modules/tasks/view";

import { SubtaskAddField } from "./SubtaskAddField";
import { TaskRow } from "./TaskRow";

const LEAVE = { opacity: 0, y: 8 };
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

type SubtaskListProps = {
  parentId: string;
  subtasks: Task[];
  /** Compteur « n/m » de la parente (annulées exclues), null sans sous-tâche comptée. */
  counter: string | null;
  /** Jour local `YYYY-MM-DD` : échéance passée en braise. */
  today: string;
  /** Requête de la liste gardée par les liens (`?completed=1` ou rien). */
  listQuery: string;
};

export function SubtaskList({
  parentId,
  subtasks,
  counter,
  today,
  listQuery,
}: SubtaskListProps) {
  const t = useTranslations("tasks");
  const headingId = useId();

  async function add(title: string): Promise<string | null> {
    const outcome = await settleAction(() =>
      runAppAction("tasks.create", { title, parentId }),
    );
    if (outcome.ok && outcome.value.ok) return null;
    return outcome.ok && !outcome.value.ok
      ? t(`errors.${outcome.value.code}`)
      : t("detail.subtasks.addFailed");
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-small font-semibold text-foreground">
          {t("detail.subtasks.title")}
        </h2>
        {counter !== null && (
          <span
            aria-hidden="true"
            className="font-heading text-small text-muted-foreground"
          >
            {counter}
          </span>
        )}
      </div>
      {subtasks.length > 0 && (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {subtasks.map((subtask) => (
              <motion.li
                key={subtask.id}
                initial={LEAVE}
                animate={{ opacity: 1, y: 0 }}
                exit={LEAVE}
                transition={SPRING}
              >
                <TaskRow
                  // La parente est la tâche ouverte : pas de légende « Sous-tâche de ».
                  task={{ ...subtask, parentTitle: null }}
                  overdue={isOverdue(subtask, today)}
                  showDate
                  showContext={false}
                  listQuery={listQuery}
                  className="border border-border bg-transparent has-[a:hover]:bg-pill-track"
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <SubtaskAddField onAdd={add} />
    </section>
  );
}
