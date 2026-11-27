"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Détail `/tasks/[id]` (spec todo-unifiee, « Détail ») : au-dessus de la liste, URL propre. Fenêtre (panneau sur
// ordinateur, tiroir sur mobile, fermeture) : `TaskDetailSheet`, partagée avec l'état d'erreur du détail.
// Fermer : animation de sortie, puis retour à la liste, requête gardée (`listQuery`).
// Contenu, une colonne, du plus décisif au plus libre (BRAIN-46, D9) : parente en lien (sous-tâche), titre éditable
// d'un tap (`TaskTitleField`), puis
// les propriétés groupées (Statut, Priorité, Échéance, Côté et espace, Tags ; statut et priorité marqués par leur
// icône, `status-icons.ts` et `priority-icons.ts`), sous-tâches (pas sur une sous-tâche), notes en bas, repliées
// sur une ligne à l'ouverture quand elles sont vides (`TaskNotesField`), pied « Mettre à la corbeille ».
// Corbeille : retour à la liste ; une sous-tâche revient au détail de sa parente, où le message et « Annuler »
// s'affichent dans la fenêtre (emplacement collé en bas du panneau, au-dessus du contenu qui défile).
// Chaque champ appelle `tasks.update` seul (registre, origine `app`) : désactivé pendant l'appel, pas
// d'optimiste, erreur sous le champ (code traduit, sinon message générique). Titre et notes : au départ du
// champ ; Date et Tags : à la fermeture de leur pastille (une seule écriture pour plusieurs crans de roue iOS).
// Aucune validation zod ici (zod interdit dans le bundle client, CSP) : le schéma du serveur tranche.
import { CornerLeftUp, Flag, Layers, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import type { ContextOption } from "@/modules/core/context-colors";
import { sides, type Side } from "@/modules/core/sides";
import type { TaskDetail as TaskDetailData } from "@/modules/tasks/queries";
import { statusCategories, type StatusCategory } from "@/modules/tasks/sides";
import { subtaskCounter, tagChanges } from "@/modules/tasks/view";

import { TASKS_PATH } from "../shell/nav-items";
import { ChoiceChip } from "./ChoiceChip";
import { ContextChip } from "./ContextChip";
import { DetailField, type FieldError } from "./DetailField";
import { type DueDate, DueDateChip } from "./DueDateChip";
import { priorityChoiceStyle } from "./priority-icons";
import { STATUS_ICONS } from "./status-icons";
import { SubtaskList } from "./SubtaskList";
import { loadWorkspaceTags } from "./load-workspace-tags";
import { TagsChip } from "./TagsChip";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { TaskNotesField } from "./TaskNotesField";
import { TaskTitleField } from "./TaskTitleField";
import { useTrashNoticeHost, useTrashTask } from "./task-trash-context";
import { type TaskUpdate, useTaskUpdate } from "./use-task-update";

const PRIORITIES = ["0", "1", "2", "3", "4"] as const;

type TaskDetailProps = {
  task: TaskDetailData;
  /** Espaces du côté de la tâche ; noms saisis par l'utilisateur, jamais traduits. */
  contexts: ContextOption[];
  /** Jour local `YYYY-MM-DD` (`todayIn(getUserTimeZone(), now)`, calculé par la page). */
  today: string;
  /** Requête de la liste sous le détail (`?completed=1` ou rien), gardée par la fermeture et les liens. */
  listQuery: string;
};

/**
 * Valeur gardée pendant la saisie, remise à la valeur du serveur quand celle-ci change (rendu rafraîchi après
 * une écriture). `key` : forme comparable de la valeur (une date ou une liste est un nouvel objet à chaque rendu).
 */
function useDraft<T>(saved: T, key: string): [T, (value: T) => void] {
  const [draft, setDraft] = useState(saved);
  const [previous, setPrevious] = useState(key);
  if (key !== previous) {
    setPrevious(key);
    setDraft(saved);
  }
  return [draft, setDraft];
}

export function TaskDetail({
  task,
  contexts,
  today,
  listQuery,
}: TaskDetailProps) {
  const closeHref = `${TASKS_PATH}${listQuery}`;
  const t = useTranslations("tasks");
  const tSide = useTranslations("shell.side");
  const trash = useTrashTask();
  const noticeHost = useTrashNoticeHost();
  const [trashing, setTrashing] = useState(false);
  const ids = {
    title: useId(),
    notes: useId(),
    status: useId(),
    priority: useId(),
    side: useId(),
    context: useId(),
    due: useId(),
    tags: useId(),
  };

  const title = useTaskUpdate(task.id);
  const notes = useTaskUpdate(task.id);
  const status = useTaskUpdate(task.id);
  const priority = useTaskUpdate(task.id);
  const side = useTaskUpdate(task.id);
  const context = useTaskUpdate(task.id);
  const due = useTaskUpdate(task.id);
  const tags = useTaskUpdate(task.id);

  const [titleDraft, setTitleDraft] = useDraft(task.title, task.title);
  const [titleEmpty, setTitleEmpty] = useState(false);
  const [notesDraft, setNotesDraft] = useDraft(
    task.notes ?? "",
    task.notes ?? "",
  );
  // Date et tags : brouillon aussi tenu en ref, posée dans les gestionnaires et relue à la fermeture de la
  // pastille (le dernier choix et la fermeture arrivent dans le même geste, avant le rendu suivant).
  const [dueDraft, setDueDraft] = useDraft<DueDate>(
    { date: task.dueDate, time: task.dueTime },
    `${task.dueDate}|${task.dueTime}`,
  );
  const dueRef = useRef(dueDraft);
  const [tagsDraft, setTagsDraft] = useDraft<string[]>(
    task.tags,
    task.tags.join("\n"),
  );
  const tagsRef = useRef(tagsDraft);

  const subtask = task.parentId !== null;

  /** Message sous le champ : refus traduit, sinon générique. */
  function errorOf(update: TaskUpdate, id: string): FieldError[] {
    if (update.failure === null) return [];
    return [
      {
        id,
        text:
          update.failure.code !== undefined
            ? t(`errors.${update.failure.code}`)
            : t("detail.updateFailed"),
      },
    ];
  }

  const titleErrors: FieldError[] = titleEmpty
    ? [{ id: ids.title, text: t("detail.titleRequired") }]
    : errorOf(title, ids.title);
  const notesErrors = errorOf(notes, ids.notes);

  function saveTitle(value: string) {
    const next = value.trim();
    setTitleEmpty(next === "");
    if (next === "" || next === task.title) return;
    title.save({ title: next });
  }

  const titleProps = {
    value: titleDraft,
    onChange: (value: string) => {
      setTitleEmpty(false);
      setTitleDraft(value);
    },
    onSave: saveTitle,
    disabled: title.pending,
    errors: titleErrors,
  };

  function saveNotes() {
    const next = notesDraft.trim() === "" ? null : notesDraft;
    if (next === task.notes) return;
    notes.save({ notes: next });
  }

  function changeDue(value: DueDate) {
    dueRef.current = value;
    setDueDraft(value);
  }

  function saveDue(isOpen: boolean) {
    if (isOpen) {
      dueRef.current = dueDraft;
      return;
    }
    const { date, time } = dueRef.current;
    if (date === task.dueDate && time === task.dueTime) return;
    due.save({ dueDate: date, dueTime: date === null ? null : time });
  }

  function changeTags(value: string[]) {
    tagsRef.current = value;
    setTagsDraft(value);
  }

  function saveTags(isOpen: boolean) {
    if (isOpen) {
      tagsRef.current = tagsDraft;
      return;
    }
    const changes = tagChanges(task.tags, tagsRef.current);
    if (changes !== null) tags.save(changes);
  }

  function moveToTrash() {
    setTrashing(true);
    // Sous-tâche : retour au détail de sa parente (spec, « Détail », pied), message affiché dans sa fenêtre.
    trash(
      task.id,
      subtask ? `${TASKS_PATH}/${task.parentId}${listQuery}` : closeHref,
    );
  }

  const statusOptions = statusCategories.map((value) => ({
    value,
    label: t(`detail.status.${value}`),
    ...STATUS_ICONS[value],
  }));
  // Niveaux 1 à 4 : pastille et badge du menu à la teinte du niveau ; « Aucune » : pastille ordinaire au drapeau.
  const priorityOptions = PRIORITIES.map((value) => ({
    value,
    label: t(`detail.priority.${value}`),
    ...priorityChoiceStyle(Number(value)),
  }));
  const sideOptions = sides.map((value) => ({ value, label: tSide(value) }));
  const describedBy = (update: TaskUpdate, id: string) =>
    update.failure !== null ? id : undefined;

  return (
    <TaskDetailSheet closeHref={closeHref}>
      {(closeButton) => (
        <>
          <div className="flex flex-col gap-5 px-4 pb-5 lg:p-5">
            {subtask && (
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`${TASKS_PATH}/${task.parentId}${listQuery}`}
                  className="flex min-h-11 min-w-0 items-center gap-1.5 text-small font-semibold text-link no-underline hover:text-link-hover"
                >
                  <CornerLeftUp
                    aria-hidden="true"
                    className="size-4 shrink-0"
                    strokeWidth={2}
                  />
                  <span className="sr-only">{t("detail.parent")}</span>
                  {/* Contenu saisi : jamais traduit. */}
                  <span className="truncate">{task.parentTitle}</span>
                </Link>
                {closeButton}
              </div>
            )}

            {subtask ? (
              <TaskTitleField {...titleProps} />
            ) : (
              // Pas de lien vers une parente : la croix rejoint la rangée du titre (pas de rangée vide).
              <div className="flex items-start justify-between gap-3">
                <TaskTitleField {...titleProps} />
                {closeButton}
              </div>
            )}

            <div
              role="group"
              aria-label={t("detail.properties")}
              className="flex flex-col gap-1"
            >
              <DetailField
                label={t("detail.status.label")}
                errors={errorOf(status, ids.status)}
              >
                <ChoiceChip<StatusCategory>
                  label={t("detail.menuLabel", {
                    field: t("detail.status.label"),
                    current: t(`detail.status.${task.statusCategory}`),
                  })}
                  icon={STATUS_ICONS[task.statusCategory].icon}
                  options={statusOptions}
                  value={task.statusCategory}
                  onChange={(value) => status.save({ statusCategory: value })}
                  disabled={status.pending}
                  describedBy={describedBy(status, ids.status)}
                />
              </DetailField>
              <DetailField
                label={t("detail.priority.label")}
                errors={errorOf(priority, ids.priority)}
              >
                <ChoiceChip
                  label={t("detail.menuLabel", {
                    field: t("detail.priority.label"),
                    current: t(`detail.priority.${task.priority}`),
                  })}
                  icon={Flag}
                  options={priorityOptions}
                  value={String(task.priority)}
                  onChange={(value) =>
                    priority.save({ priority: Number(value) })
                  }
                  disabled={priority.pending}
                  describedBy={describedBy(priority, ids.priority)}
                />
              </DetailField>
              <DetailField
                label={t("detail.due")}
                errors={errorOf(due, ids.due)}
              >
                <DueDateChip
                  today={today}
                  value={dueDraft}
                  onChange={changeDue}
                  onOpenChange={saveDue}
                  disabled={due.pending}
                  describedBy={describedBy(due, ids.due)}
                  emptyLabel="none"
                />
              </DetailField>
              <DetailField
                label={t("detail.placement")}
                errors={[
                  ...errorOf(side, ids.side),
                  ...errorOf(context, ids.context),
                ]}
              >
                {subtask ? (
                  <span className="text-small text-foreground">
                    {t("detail.followsParent")}
                  </span>
                ) : (
                  <>
                    <ChoiceChip<Side>
                      label={t("detail.menuLabel", {
                        field: t("detail.side"),
                        current: tSide(task.side),
                      })}
                      icon={Layers}
                      options={sideOptions}
                      value={task.side}
                      onChange={(value) => side.save({ side: value })}
                      disabled={side.pending || context.pending}
                      describedBy={describedBy(side, ids.side)}
                    />
                    {contexts.length > 0 && (
                      <ContextChip
                        contexts={contexts}
                        value={task.contextId}
                        onChange={(contextId) =>
                          context.save({
                            context:
                              contexts.find((c) => c.id === contextId)?.name ??
                              null,
                          })
                        }
                        disabled={side.pending || context.pending}
                        describedBy={describedBy(context, ids.context)}
                        emptyLabel="none"
                      />
                    )}
                  </>
                )}
              </DetailField>
              <DetailField
                label={t("detail.tags")}
                errors={errorOf(tags, ids.tags)}
              >
                <TagsChip
                  loadTags={loadWorkspaceTags}
                  value={tagsDraft}
                  onChange={changeTags}
                  onOpenChange={saveTags}
                  disabled={tags.pending}
                  describedBy={describedBy(tags, ids.tags)}
                  emptyLabel="none"
                />
              </DetailField>
            </div>

            {/* Un seul filet sous les propriétés, sous-tâches ou non : le contenu libre commence ici. */}
            <div className="flex flex-col gap-5 border-t border-border pt-4">
              {!subtask && (
                <SubtaskList
                  parentId={task.id}
                  subtasks={task.subtasks}
                  counter={subtaskCounter(task)}
                  today={today}
                  listQuery={listQuery}
                />
              )}
              <TaskNotesField
                value={notesDraft}
                onChange={setNotesDraft}
                onBlur={saveNotes}
                disabled={notes.pending}
                errors={notesErrors}
              />
            </div>

            <div className="border-t border-border pt-4">
              <motion.button
                type="button"
                disabled={trashing}
                onClick={moveToTrash}
                whileTap={trashing ? undefined : { scale: 0.97 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-secondary px-5 text-body font-semibold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2
                  aria-hidden="true"
                  className="size-4.5"
                  strokeWidth={2}
                />
                {trashing ? t("detail.trashing") : t("detail.trash")}
              </motion.button>
            </div>
          </div>
          {/* Message de corbeille (sous-tâche mise à la corbeille, « Annuler ») : dans la fenêtre, sinon
                    inerte ; collé en bas du panneau quand le contenu défile. */}
          <div
            ref={noticeHost}
            // Région d'annonce rendue avec la fenêtre, avant tout message : VoiceOver annonce ce qui
            // y arrive ensuite (une région créée déjà remplie ne l'est pas de façon fiable).
            role="status"
            data-testid="detail-notice"
            className="pointer-events-none sticky bottom-0 flex shrink-0 justify-center px-4 has-[p]:pb-4 lg:px-5 lg:has-[p]:pb-5"
          />
        </>
      )}
    </TaskDetailSheet>
  );
}
