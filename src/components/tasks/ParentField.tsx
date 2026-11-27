"use client";

// Curseurs nexxia-design (DESIGN.md § 1, détail) : VARIANCE 3 · MOTION 2 · DENSITY 6.
// Propriété « Tâche parente » du détail (spec todo-kanban, « Tâche parente » et « Listes de sélection ») : seule
// mention de la parente dans le détail. Sans parente : pastille « Aucune » qui ouvre `TaskPicker` en ligne sous
// la ligne ; avec : lien vers la parente, « Changer » (même liste), « Détacher ». Tâche qui a des sous-tâches
// actives : propriété désactivée avec sa raison, aucune lecture. Une écriture = `tasks.setParent` du registre
// (`runAppAction`, origine `app`), changer de parente n'en fait qu'une ; refus traduit sous le champ.
// Clavier iOS : la liste est montée dans le geste du tap (`flushSync`) et son champ focalisé dans ce même
// geste, sinon Safari n'ouvre pas le clavier (docs/gotchas.md). Focus rendu au bouton à la fermeture.
import { CornerLeftUp } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";
import type { Side } from "@/modules/core/sides";
import type { Task } from "@/modules/tasks/queries";

import { chipTriggerClass } from "./chip-styles";
import { DetailField, type FieldError } from "./DetailField";
import type { FieldFailure } from "./use-task-update";
import { TaskPicker } from "./TaskPicker";
import { TASKS_PATH } from "../shell/nav-items";

type ParentFieldProps = {
  taskId: string;
  /** Côté de la tâche : la liste n'en propose jamais d'autre. */
  side: Side;
  parentId: string | null;
  parentTitle: string | null;
  /** Au moins une sous-tâche active : la propriété est désactivée. */
  hasSubtasks: boolean;
  /** Requête de la liste sous le détail, gardée dans le lien vers la parente. */
  listQuery: string;
};

export function ParentField({
  taskId,
  side,
  parentId,
  parentTitle,
  hasSubtasks,
  listQuery,
}: ParentFieldProps) {
  const t = useTranslations("tasks");
  const errorId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<FieldFailure>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function show() {
    flushSync(() => setOpen(true));
    panel.current?.querySelector("input")?.focus({ preventScroll: true });
  }

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function save(next: string | null) {
    if (pending) return;
    setFailure(null);
    startTransition(async () => {
      const outcome = await settleAction(() =>
        runAppAction("tasks.setParent", { taskId, parentId: next }),
      );
      if (outcome.ok && outcome.value.ok) return;
      setFailure({
        code: outcome.ok && !outcome.value.ok ? outcome.value.code : undefined,
      });
    });
  }

  function choose(task: Task) {
    close();
    save(task.id);
  }

  const errors: FieldError[] =
    failure === null
      ? []
      : [
          {
            id: errorId,
            text:
              failure.code !== undefined
                ? t(`errors.${failure.code}`)
                : t("detail.updateFailed"),
          },
        ];
  const describedBy = failure === null ? undefined : errorId;
  const label = t("detail.parentField.label");

  if (hasSubtasks) {
    return (
      <DetailField label={label} errors={errors}>
        <span className="text-small text-muted-foreground">
          {t("detail.parentField.hasSubtasks")}
        </span>
      </DetailField>
    );
  }

  return (
    <DetailField label={label} errors={errors}>
      {parentId === null ? (
        <button
          ref={trigger}
          type="button"
          disabled={pending}
          aria-label={t("detail.menuLabel", {
            field: label,
            current: t("detail.parentField.none"),
          })}
          aria-expanded={open}
          aria-describedby={describedBy}
          onClick={() => (open ? close() : show())}
          className={`${chipTriggerClass} text-muted-foreground`}
        >
          <CornerLeftUp aria-hidden="true" className="size-4" strokeWidth={2} />
          {t("detail.parentField.none")}
        </button>
      ) : (
        <>
          <Link
            href={`${TASKS_PATH}/${parentId}${listQuery}`}
            className="flex min-h-11 min-w-0 items-center gap-1.5 text-small font-semibold text-link no-underline hover:text-link-hover"
          >
            <CornerLeftUp
              aria-hidden="true"
              className="size-4 shrink-0"
              strokeWidth={2}
            />
            <span className="sr-only">{t("detail.parent")}</span>
            {/* Contenu saisi : jamais traduit. */}
            <span className="truncate">{parentTitle}</span>
          </Link>
          <button
            ref={trigger}
            type="button"
            disabled={pending}
            aria-expanded={open}
            aria-describedby={describedBy}
            onClick={() => (open ? close() : show())}
            className={chipTriggerClass}
          >
            {t("detail.parentField.change")}
          </button>
          <button
            type="button"
            disabled={pending}
            aria-describedby={describedBy}
            onClick={() => save(null)}
            className={chipTriggerClass}
          >
            {t("detail.parentField.detach")}
          </button>
          <p className="basis-full text-caption text-muted-foreground">
            {t("detail.parentField.followsParent")}
          </p>
        </>
      )}
      {open && (
        <div
          ref={panel}
          className="basis-full overflow-hidden rounded-lg border border-border bg-popover shadow-glass"
        >
          <TaskPicker
            side={side}
            excludeIds={parentId === null ? [taskId] : [taskId, parentId]}
            topLevelOnly
            onSelect={choose}
            onCancel={close}
          />
        </div>
      )}
    </DetailField>
  );
}
