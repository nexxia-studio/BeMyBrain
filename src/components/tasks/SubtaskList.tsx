"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Sous-tâches du détail (spec todo-unifiee, « Détail ») : titre de section et compteur « n/m », lignes
// cochables (TaskRow : même case sans optimiste, lien vers le détail de la sous-tâche), puis le champ
// « Ajouter une sous-tâche » envoyé par Entrée (`tasks.create` sous cette tâche). Une colonne à toutes les
// largeurs. Lignes sur le `popover` opaque : contour `border` au lieu du fond `row` (blanc sur blanc), survol
// en `pill-track` comme les menus. Apparition et retrait d'une ligne : `opacity` + `y` 8 (DESIGN.md § 7).
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";
import type { TaskErrorCode } from "@/modules/tasks/errors";
import type { Task } from "@/modules/tasks/queries";
import { TASK_TITLE_MAX } from "@/modules/tasks/sides";
import { isOverdue } from "@/modules/tasks/view";

import { TaskRow } from "./TaskRow";

const LEAVE = { opacity: 0, y: 8 };
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

type Failure = { code?: TaskErrorCode } | null;

type SubtaskListProps = {
  parentId: string;
  subtasks: Task[];
  /** Compteur « n/m » de la parente (annulées exclues), null sans sous-tâche comptée. */
  counter: string | null;
  /** Jour local `YYYY-MM-DD` : échéance passée en braise. */
  today: string;
};

export function SubtaskList({
  parentId,
  subtasks,
  counter,
  today,
}: SubtaskListProps) {
  const t = useTranslations("tasks");
  const headingId = useId();
  const fieldId = useId();
  const errorId = useId();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [failure, setFailure] = useState<Failure>(null);

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim() === "" || pending) return;
    setFailure(null);
    startTransition(async () => {
      const outcome = await settleAction(() =>
        runAppAction("tasks.create", { title, parentId }),
      );
      if (outcome.ok && outcome.value.ok) {
        setTitle("");
        return;
      }
      setFailure({
        code: outcome.ok && !outcome.value.ok ? outcome.value.code : undefined,
      });
    });
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
                  className="border border-border bg-transparent has-[a:hover]:bg-pill-track"
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <form onSubmit={add} className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-small font-medium">
          {t("detail.subtasks.add")}
        </label>
        <input
          id={fieldId}
          type="text"
          value={title}
          readOnly={pending}
          maxLength={TASK_TITLE_MAX}
          autoComplete="off"
          enterKeyHint="done"
          aria-describedby={failure !== null ? errorId : undefined}
          onChange={(event) => setTitle(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-input bg-row px-3 text-base text-foreground read-only:opacity-60"
        />
        {failure !== null && (
          <p
            id={errorId}
            role="alert"
            className="text-caption text-destructive"
          >
            {failure.code !== undefined
              ? t(`errors.${failure.code}`)
              : t("detail.subtasks.addFailed")}
          </p>
        )}
      </form>
    </section>
  );
}
