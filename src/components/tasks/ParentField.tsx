"use client";

// Curseurs nexxia-design (DESIGN.md § 1, détail) : VARIANCE 3 · MOTION 2 · DENSITY 6.
// Propriété « Tâche parente » du détail (spec todo-kanban, « Tâche parente » et « Listes de sélection ») : seule
// mention de la parente dans le détail. Sans parente : pastille « Aucune » qui ouvre `TaskPicker` en ligne sous
// la ligne ; avec : lien vers la parente, « Changer » (même liste), « Détacher ». Tâche qui a des sous-tâches
// actives : pastille « Aucune » désactivée (`aria-disabled`) avec sa raison en légende, aucune lecture. La liste
// s'ouvre sous la ligne, en pleine largeur (`DetailField` `panel`). Une écriture = `tasks.setParent` du registre
// (`runAppAction`, origine `app`), changer de parente n'en fait qu'une ; refus traduit sous le champ.
// Clavier iOS : la liste est montée dans le geste du tap (`flushSync`) et son champ focalisé dans ce même
// geste, sinon Safari n'ouvre pas le clavier (docs/gotchas.md). Focus rendu au bouton à la fermeture.
import { CornerLeftUp } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
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
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<FieldFailure>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // Après une écriture, au changement de parente (le bouton qui avait le focus est démonté : « Aucune » ↔
  // « Changer » / « Détacher »), le focus passe à celui qui reste. `refocus` garde la parente de départ ; on
  // attend la fin de l'écriture (un bouton désactivé ne prend pas le focus) et le nouveau `parentId`.
  const refocus = useRef<{ from: string | null } | null>(null);

  useEffect(() => {
    if (refocus.current === null || pending) return;
    if (refocus.current.from === parentId) return;
    refocus.current = null;
    trigger.current?.focus();
  }, [parentId, pending]);

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
    refocus.current = { from: parentId };
    startTransition(async () => {
      const outcome = await settleAction(() =>
        runAppAction("tasks.setParent", { taskId, parentId: next }),
      );
      if (outcome.ok && outcome.value.ok) return;
      refocus.current = null;
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
    // `aria-disabled` plutôt que `disabled` : la pastille reste atteignable au clavier et lue avec sa raison.
    return (
      <DetailField label={label} errors={errors}>
        <button
          type="button"
          aria-disabled="true"
          aria-label={t("detail.menuLabel", {
            field: label,
            current: t("detail.parentField.none"),
          })}
          aria-describedby={reasonId}
          className={`${chipTriggerClass} cursor-not-allowed text-muted-foreground opacity-60`}
        >
          <CornerLeftUp aria-hidden="true" className="size-4" strokeWidth={2} />
          {t("detail.parentField.none")}
        </button>
        <p
          id={reasonId}
          className="basis-full text-caption text-muted-foreground"
        >
          {t("detail.parentField.hasSubtasks")}
        </p>
      </DetailField>
    );
  }

  const picker = open && (
    <div
      ref={panel}
      className="overflow-hidden rounded-lg border border-border bg-popover shadow-glass"
    >
      <TaskPicker
        side={side}
        excludeIds={parentId === null ? [taskId] : [taskId, parentId]}
        topLevelOnly
        onSelect={choose}
        onCancel={close}
      />
    </div>
  );

  return (
    <DetailField label={label} errors={errors} panel={picker}>
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
          {/* La parente est la valeur de la ligne ; la légende d'héritage la suit, les boutons dessous. */}
          <Link
            href={`${TASKS_PATH}/${parentId}${listQuery}`}
            className="flex min-h-11 min-w-0 basis-full items-center gap-1.5 text-small font-semibold text-link no-underline hover:text-link-hover"
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
          <p className="-mt-1 basis-full text-caption text-muted-foreground">
            {t("detail.parentField.followsParent")}
          </p>
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
        </>
      )}
    </DetailField>
  );
}
