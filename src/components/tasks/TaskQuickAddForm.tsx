"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Formulaire tâche de l'ajout rapide (spec todo-unifiee, « Ajout rapide ») : titre (libellé visible, 16 px
// contre le zoom iOS, focus d'office par la coque), puis pastilles d'un tap facultatives (Espace, Date, Tags),
// puis « Ajouter ». Repli : sous 1024 px, une colonne, bouton pleine largeur en bas (pouce) ; à partir de
// 1024 px, pastilles à gauche et bouton pilule à droite sur la même rangée.
// Création par le registre (`tasks.create`, Server Action `runAppAction`, origine `app`) : pas d'optimiste.
// Pendant l'appel : bouton désactivé (« Ajout… »), titre en lecture seule (le focus et le clavier restent),
// pastilles désactivées. Succès : titre, date et tags vidés, espace gardé, focus au titre, « Tâche ajoutée »
// + « Ouvrir ». Échec : saisie conservée, message (code traduit, sinon générique).
// Validation : titre non vide côté client seulement (zod interdit dans le bundle client, CSP) ; le schéma du
// serveur (`createTaskInputSchema`) tranche.
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { runAppAction } from "@/app/(app)/tasks/actions";
import type { TaskErrorCode } from "@/modules/tasks/errors";
import { settleAction } from "@/lib/settle-action";
import { cn } from "@/lib/utils";
import { getUserTimeZone, todayIn } from "@/modules/core/time-zone";
import { TASK_TITLE_MAX } from "@/modules/tasks/sides";

import type { QuickAddFormProps } from "../quick-add/quick-add-types";
import { ContextChip } from "./ContextChip";
import { type DueDate, DueDateChip } from "./DueDateChip";
import { TagsChip } from "./TagsChip";

type Status =
  | { kind: "idle" }
  | { kind: "added"; taskId: string | null }
  | { kind: "failed"; code?: TaskErrorCode };

const NO_DUE: DueDate = { date: null, time: null };

/** Id de la tâche créée (`tasks.create` renvoie son détail ; la Server Action renvoie `unknown`). */
function createdId(result: unknown): string | null {
  return typeof result === "object" &&
    result !== null &&
    "id" in result &&
    typeof result.id === "string"
    ? result.id
    : null;
}

export function TaskQuickAddForm({
  scope,
  initialFocusRef,
  onClose,
}: QuickAddFormProps) {
  const t = useTranslations("tasks");
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [contextId, setContextId] = useState(scope.contextId);
  const [due, setDue] = useState<DueDate>(NO_DUE);
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Remonte les pastilles Date et Tags après un succès : sans champ d'heure ouvert, tags relus (ceux créés
  // par l'ajout précédent existent désormais en base).
  const [round, setRound] = useState(0);

  const context = scope.contexts.find((option) => option.id === contextId);
  const empty = title.trim() === "";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (empty || pending) return;
    const params = {
      title,
      side: scope.side,
      ...(context && { context: context.name }),
      ...(due.date !== null && { dueDate: due.date }),
      ...(due.time !== null && { dueTime: due.time }),
      ...(tags.length > 0 && { tags }),
    };
    setStatus({ kind: "idle" });
    startTransition(async () => {
      const outcome = await settleAction(() =>
        runAppAction("tasks.create", params),
      );
      if (outcome.ok && outcome.value.ok) {
        setTitle("");
        setDue(NO_DUE);
        setTags([]);
        setRound((n) => n + 1);
        setStatus({ kind: "added", taskId: createdId(outcome.value.result) });
        initialFocusRef.current?.focus();
      } else {
        setStatus({
          kind: "failed",
          code:
            outcome.ok && !outcome.value.ok ? outcome.value.code : undefined,
        });
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className="text-small font-medium">
          {t("quickAdd.title")}
        </label>
        <input
          id={titleId}
          ref={initialFocusRef}
          type="text"
          value={title}
          readOnly={pending}
          maxLength={TASK_TITLE_MAX}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(event) => setTitle(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-input bg-row px-3 text-base text-foreground"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap gap-2">
          {scope.contexts.length > 0 && (
            <ContextChip
              contexts={scope.contexts}
              value={context?.id ?? null}
              onChange={setContextId}
              disabled={pending}
            />
          )}
          <DueDateChip
            key={`date-${round}`}
            today={todayIn(getUserTimeZone(), new Date())}
            value={due}
            onChange={setDue}
            disabled={pending}
          />
          <TagsChip key={`tags-${round}`} value={tags} onChange={setTags} disabled={pending} />
        </div>
        <motion.button
          type="submit"
          disabled={empty || pending}
          whileTap={empty || pending ? undefined : { scale: 0.97 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className="flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-5 text-body font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 lg:rounded-full"
        >
          {pending ? t("quickAdd.submitting") : t("quickAdd.submit")}
        </motion.button>
      </div>

      <p
        role="status"
        data-testid="quick-add-status"
        className={cn(
          "flex min-h-6 flex-wrap items-center gap-x-3 text-small font-medium",
          status.kind === "failed" ? "text-destructive" : "text-foreground",
        )}
      >
        {status.kind === "added" && (
          <>
            <span>{t("quickAdd.added")}</span>
            {status.taskId && (
              <Link
                href={`/tasks/${status.taskId}`}
                onClick={onClose}
                className="flex min-h-11 items-center font-semibold text-link hover:text-link-hover"
              >
                {t("quickAdd.open")}
              </Link>
            )}
          </>
        )}
        {status.kind === "failed" &&
          (status.code ? t(`errors.${status.code}`) : t("quickAdd.failed"))}
      </p>
    </form>
  );
}
