"use client";

// Curseurs nexxia-design (DESIGN.md § 1, détail) : VARIANCE 3 · MOTION 2 · DENSITY 6.
// Section « Relations » du détail (spec todo-kanban, « Relations » et « Listes de sélection »), sous les
// sous-tâches, même titre de section. Groupes « Bloque », « Bloquée par », « Liée à » : non vides seulement ;
// chaque relation est un lien vers l'autre tâche (icône de statut) et un bouton « Retirer ». Une relation est
// lue des deux côtés : « Bloque » chez A est « Bloquée par » chez B (la lecture du module l'inverse déjà).
// Vide : la seule ligne « + Ajouter une relation » (même gabarit que l'ajout de sous-tâche). Ajouter : le type
// (trois boutons), puis `TaskPicker` en ligne ; ni la tâche ni celles déjà reliées par ce type ne sont proposées.
// Écritures : `tasks.addRelation` / `tasks.removeRelation` du registre (`runAppAction`, origine `app`), refus
// traduit sous la section (`tasks.errors.*`), échec réseau : message générique (`settleAction`).
// Clavier iOS : la liste est montée dans le geste du tap sur le type (`flushSync`) et son champ focalisé dans
// ce même geste (docs/gotchas.md). Focus rendu au bouton d'ajout à la fermeture et après un retrait.
import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";
import { cn } from "@/lib/utils";
import type { Side } from "@/modules/core/sides";
import type {
  Task,
  TaskRelationItem,
  TaskRelations,
} from "@/modules/tasks/queries";
import type { TaskRelationInput } from "@/modules/tasks/schemas";

import { chipTriggerClass } from "./chip-styles";
import { contextChipClass } from "./context-chip-class";
import { STATUS_ICONS } from "./status-icons";
import { TASK_ROW_LINE_CLASSES } from "./task-list-layout";
import { TaskPicker } from "./TaskPicker";
import { TASKS_PATH } from "../shell/nav-items";

type Group = keyof TaskRelations;
type Kind = TaskRelationInput["kind"];

// Ordre d'affichage, groupe de lecture et type envoyé au registre (lu depuis la tâche ouverte).
const GROUPS: { group: Group; kind: Kind }[] = [
  { group: "blocks", kind: "blocks" },
  { group: "blockedBy", kind: "blocked_by" },
  { group: "related", kind: "related" },
];

type RelationListProps = {
  taskId: string;
  /** Côté de la tâche : la liste n'en propose jamais d'autre. */
  side: Side;
  relations: TaskRelations;
  /** Requête de la liste sous le détail, gardée dans les liens. */
  listQuery: string;
};

export function RelationList({
  taskId,
  side,
  relations,
  listQuery,
}: RelationListProps) {
  const t = useTranslations("tasks");
  const headingId = useId();
  const errorId = useId();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<Group | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  function chooseKind(next: Group) {
    flushSync(() => setKind(next));
    panel.current?.querySelector("input")?.focus({ preventScroll: true });
  }

  function close() {
    setAdding(false);
    setKind(null);
    addButton.current?.focus();
  }

  function write(
    name: "tasks.addRelation" | "tasks.removeRelation",
    input: TaskRelationInput,
    failed: string,
  ) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const outcome = await settleAction(() => runAppAction(name, input));
      if (outcome.ok && outcome.value.ok) return;
      setError(
        outcome.ok && !outcome.value.ok
          ? t(`errors.${outcome.value.code}`)
          : failed,
      );
    });
  }

  function choose(task: Task) {
    const picked = GROUPS.find((g) => g.group === kind);
    if (picked === undefined) return;
    close();
    write(
      "tasks.addRelation",
      { taskId, kind: picked.kind, otherTaskId: task.id },
      t("detail.relations.addFailed"),
    );
  }

  function remove(entry: { kind: Kind }, other: TaskRelationItem) {
    addButton.current?.focus();
    write(
      "tasks.removeRelation",
      { taskId, kind: entry.kind, otherTaskId: other.id },
      t("detail.relations.removeFailed"),
    );
  }

  const excludeIds =
    kind === null
      ? [taskId]
      : [taskId, ...relations[kind].map((item) => item.id)];

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-small font-semibold text-foreground">
        {t("detail.relations.title")}
      </h2>
      {GROUPS.filter(({ group }) => relations[group].length > 0).map(
        (entry) => (
          <div key={entry.group} className="flex flex-col gap-1.5">
            <h3 className="text-caption font-semibold text-muted-foreground">
              {t(`detail.relations.${entry.group}`)}
            </h3>
            <ul className="flex flex-col gap-2">
              {relations[entry.group].map((other) => (
                <RelationRow
                  key={other.id}
                  other={other}
                  listQuery={listQuery}
                  disabled={pending}
                  describedBy={error !== null ? errorId : undefined}
                  onRemove={() => remove(entry, other)}
                />
              ))}
            </ul>
          </div>
        ),
      )}
      <button
        ref={addButton}
        type="button"
        aria-expanded={adding}
        onClick={() => (adding ? close() : setAdding(true))}
        className={cn(
          TASK_ROW_LINE_CLASSES,
          "cursor-pointer items-center rounded-lg border border-input bg-row text-left text-base text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center">
          <Plus aria-hidden="true" className="size-4.5" strokeWidth={2} />
        </span>
        {t("detail.relations.add")}
      </button>
      {adding && (
        <div
          ref={panel}
          className="flex flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-glass"
        >
          <div
            role="group"
            aria-label={t("detail.relations.kindPrompt")}
            className="flex flex-wrap gap-2 p-2"
          >
            {GROUPS.map(({ group }) => (
              <button
                key={group}
                type="button"
                aria-pressed={kind === group}
                onClick={() => chooseKind(group)}
                className={cn(
                  chipTriggerClass,
                  kind === group && "border-ring ring-2 ring-ring",
                )}
              >
                {t(`detail.relations.${group}`)}
              </button>
            ))}
          </div>
          {kind !== null && (
            <div className="border-t border-border">
              <TaskPicker
                side={side}
                excludeIds={excludeIds}
                onSelect={choose}
                onCancel={close}
              />
            </div>
          )}
        </div>
      )}
      {error !== null && (
        <p id={errorId} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function RelationRow({
  other,
  listQuery,
  disabled,
  describedBy,
  onRemove,
}: {
  other: TaskRelationItem;
  listQuery: string;
  disabled: boolean;
  describedBy: string | undefined;
  onRemove: () => void;
}) {
  const t = useTranslations("tasks");
  const { icon: Icon, iconClass } = STATUS_ICONS[other.statusCategory];

  return (
    <li className="flex items-center gap-2 rounded-lg border border-border">
      <Link
        href={`${TASKS_PATH}/${other.id}${listQuery}`}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 text-body font-semibold text-foreground no-underline hover:text-foreground"
      >
        <Icon
          role="img"
          aria-label={t(`detail.status.${other.statusCategory}`)}
          className={cn("size-4.5 shrink-0", iconClass)}
          strokeWidth={2}
        />
        {/* Contenu saisi : jamais traduit. */}
        <span className="min-w-0 truncate">{other.title}</span>
        {other.contextName !== null && other.contextColor !== null && (
          <span
            className={cn(
              "max-w-32 shrink-0 truncate",
              contextChipClass(other.contextColor),
            )}
          >
            {other.contextName}
          </span>
        )}
      </Link>
      <button
        type="button"
        disabled={disabled}
        aria-label={t("detail.relations.removeLabel", { title: other.title })}
        aria-describedby={describedBy}
        onClick={onRemove}
        className={cn(chipTriggerClass, "mr-1 shrink-0")}
      >
        {t("detail.relations.remove")}
      </button>
    </li>
  );
}
