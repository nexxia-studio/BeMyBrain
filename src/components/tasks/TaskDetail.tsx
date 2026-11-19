"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Détail `/tasks/[id]` (spec todo-unifiee, « Détail ») : au-dessus de la liste, URL propre. Dialog de Base UI
// (focus piégé, Échap, clic sur le voile, focus rendu), opaque (`popover`, jamais de verre sur du verre), voile
// `scrim`. Repli : sous 1024 px, tiroir bas (`rounded-tile` en haut, poignée qui ferme en glissant, ressort
// `bounce: 0.2`, 0,3 s, comme l'ajout rapide) ; à partir de 1024 px, panneau latéral à droite, pleine hauteur
// dans la marge de page (`opacity` + `x` 24, 0,2 s `ease-out-expo`). Mouvement réduit : fondus de 0,15 s.
// Fermer : animation de sortie, puis retour à la liste, requête gardée (`listQuery`).
// Contenu, une colonne : parente en lien (sous-tâche), titre, notes, puis lignes de champs (Statut, Priorité,
// Côté et espace, Échéance, Tags), sous-tâches (pas sur une sous-tâche), pied « Mettre à la corbeille ».
// Chaque champ appelle `tasks.update` seul (registre, origine `app`) : désactivé pendant l'appel, pas
// d'optimiste, erreur sous le champ (code traduit, sinon message générique). Titre et notes : au départ du
// champ ; Date et Tags : à la fermeture de leur pastille (une seule écriture pour plusieurs crans de roue iOS).
// Aucune validation zod ici (zod interdit dans le bundle client, CSP) : le schéma du serveur tranche.
import { Dialog } from "@base-ui/react/dialog";
import { CircleDot, CornerLeftUp, Flag, Layers, Trash2, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  type PanInfo,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import {
  EASE_OUT_EXPO,
  paletteDurations,
} from "@/components/command-palette/palette-motion";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import type { ContextOption } from "@/modules/core/context-colors";
import { sides, type Side } from "@/modules/core/sides";
import type { TaskDetail as TaskDetailData } from "@/modules/tasks/queries";
import {
  statusCategories,
  type StatusCategory,
  TASK_NOTES_MAX,
  TASK_TITLE_MAX,
} from "@/modules/tasks/sides";
import { subtaskCounter, tagChanges } from "@/modules/tasks/view";

import { TASKS_PATH } from "../shell/nav-items";
import { ChoiceChip } from "./ChoiceChip";
import { ContextChip } from "./ContextChip";
import { DetailField, type FieldError } from "./DetailField";
import { type DueDate, DueDateChip } from "./DueDateChip";
import { PRIORITY_ICONS, type PriorityLevel } from "./priority-icons";
import { SubtaskList } from "./SubtaskList";
import { TagsChip } from "./TagsChip";
import { useTrashTask } from "./task-trash-context";
import { type TaskUpdate, useTaskUpdate } from "./use-task-update";

const DESKTOP = "(min-width: 1024px)";
const DRAWER_SPRING = { type: "spring", bounce: 0.2, duration: 0.3 } as const;
// Glissé de la poignée qui ferme le tiroir : distance (px) ou vitesse (px/s) vers le bas.
const CLOSE_OFFSET = 80;
const CLOSE_VELOCITY = 500;
const PRIORITIES = ["0", "1", "2", "3", "4"] as const;

const fieldClass =
  "w-full resize-none rounded-lg border border-input bg-row px-3 py-2.5 text-foreground field-sizing-content disabled:cursor-not-allowed disabled:opacity-60";

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
  const router = useRouter();
  const trash = useTrashTask();
  const reduced = useReducedMotion() ?? false;
  const desktop = useMediaQuery(DESKTOP);
  const dragControls = useDragControls();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(true);
  const [trashing, setTrashing] = useState(false);
  const titleId = useId();
  const notesId = useId();
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
  const { enter, exit } = paletteDurations(reduced);

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

  function saveTitle() {
    const next = titleDraft.trim();
    setTitleEmpty(next === "");
    if (next === "" || next === task.title) return;
    title.save({ title: next });
  }

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
    // Toujours vers la liste, même pour une sous-tâche : sur le détail de la parente (fenêtre modale), le
    // message et « Annuler » seraient inertes.
    trash(task.id, closeHref);
  }

  function onDragEnd(_event: PointerEvent, info: PanInfo) {
    if (info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY) {
      setOpen(false);
    }
  }

  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: enter } },
    exit: { opacity: 0, transition: { duration: exit } },
  };
  const panel = reduced
    ? fade
    : desktop
      ? {
          initial: { opacity: 0, x: 24 },
          animate: {
            opacity: 1,
            x: 0,
            transition: { duration: enter, ease: EASE_OUT_EXPO },
          },
          exit: {
            opacity: 0,
            x: 24,
            transition: { duration: exit, ease: EASE_OUT_EXPO },
          },
        }
      : {
          initial: { y: "100%" },
          animate: { y: 0, transition: DRAWER_SPRING },
          exit: { y: "100%", transition: DRAWER_SPRING },
        };

  const statusOptions = statusCategories.map((value) => ({
    value,
    label: t(`detail.status.${value}`),
  }));
  const priorityOptions = PRIORITIES.map((value) => ({
    value,
    label: t(`detail.priority.${value}`),
    icon: PRIORITY_ICONS[Number(value) as PriorityLevel],
  }));
  const sideOptions = sides.map((value) => ({ value, label: tSide(value) }));
  const describedBy = (update: TaskUpdate, id: string) =>
    update.failure !== null ? id : undefined;

  const closeButton = (
    <Dialog.Close
      ref={closeRef}
      render={
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
        />
      }
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-pill-track hover:text-foreground"
    >
      <X aria-hidden="true" className="size-5" strokeWidth={2} />
      <span className="sr-only">{t("detail.close")}</span>
    </Dialog.Close>
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence
        onExitComplete={() => router.push(closeHref, { scroll: false })}
      >
        {open && (
          <Dialog.Portal keepMounted>
            <Dialog.Backdrop
              render={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: { duration: enter, ease: EASE_OUT_EXPO },
                  }}
                  exit={{
                    opacity: 0,
                    transition: { duration: exit, ease: EASE_OUT_EXPO },
                  }}
                />
              }
              className="fixed inset-0 z-(--z-overlay) bg-scrim"
            />
            <Dialog.Viewport className="fixed inset-0 z-(--z-dialog) flex items-end justify-center pt-page-top lg:items-stretch lg:justify-end lg:p-page lg:pt-detail-top lg:pr-detail-right">
              <Dialog.Popup
                aria-label={t("detail.label")}
                // Pas le titre : au toucher, le clavier s'ouvrirait sur un détail qu'on vient seulement de lire.
                initialFocus={() => closeRef.current ?? true}
                render={
                  <motion.div
                    {...panel}
                    drag={desktop ? false : "y"}
                    dragControls={dragControls}
                    dragListener={false}
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0, bottom: 1 }}
                    onDragEnd={onDragEnd}
                  />
                }
                className="flex max-h-full w-full flex-col overflow-y-auto overscroll-contain rounded-t-tile bg-popover pr-safe-right pb-safe-bottom pl-safe-left text-popover-foreground shadow-glass lg:max-w-md lg:rounded-tile lg:p-0"
              >
                {/* Poignée (mobile) : glisser vers le bas ferme ; décorative, le bouton Fermer suffit aux
                    lecteurs d'écran. Zone de 44 px de haut pour le pouce. */}
                <div
                  aria-hidden="true"
                  onPointerDown={(event) => dragControls.start(event)}
                  className="flex min-h-11 shrink-0 touch-none items-center justify-center lg:hidden"
                >
                  <span className="h-1 w-10 rounded-full bg-track" />
                </div>
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

                  <div className="flex flex-col gap-1.5">
                    {subtask ? (
                      <label
                        htmlFor={titleId}
                        className="text-small font-medium"
                      >
                        {t("detail.title")}
                      </label>
                    ) : (
                      // Pas de lien vers une parente : la croix rejoint la rangée du libellé (pas de rangée vide).
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor={titleId}
                          className="text-small font-medium"
                        >
                          {t("detail.title")}
                        </label>
                        {closeButton}
                      </div>
                    )}
                    <textarea
                      id={titleId}
                      rows={1}
                      value={titleDraft}
                      disabled={title.pending}
                      maxLength={TASK_TITLE_MAX}
                      enterKeyHint="done"
                      aria-describedby={
                        titleErrors.length > 0 ? ids.title : undefined
                      }
                      onChange={(event) => {
                        setTitleEmpty(false);
                        setTitleDraft(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        // Un titre tient sur une ligne : Entrée valide.
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        event.currentTarget.blur();
                      }}
                      onBlur={saveTitle}
                      className={cn(
                        fieldClass,
                        "min-h-11 font-heading text-title",
                      )}
                    />
                    {titleErrors.map((error) => (
                      <p
                        key={error.id}
                        id={error.id}
                        role="alert"
                        className="text-caption text-destructive"
                      >
                        {error.text}
                      </p>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={notesId} className="text-small font-medium">
                      {t("detail.notes")}
                    </label>
                    <textarea
                      id={notesId}
                      rows={3}
                      value={notesDraft}
                      disabled={notes.pending}
                      maxLength={TASK_NOTES_MAX}
                      aria-describedby={
                        notesErrors.length > 0 ? ids.notes : undefined
                      }
                      onChange={(event) => setNotesDraft(event.target.value)}
                      onBlur={saveNotes}
                      className={cn(fieldClass, "min-h-24 text-base")}
                    />
                    {notesErrors.map((error) => (
                      <p
                        key={error.id}
                        id={error.id}
                        role="alert"
                        className="text-caption text-destructive"
                      >
                        {error.text}
                      </p>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1 border-t border-border pt-3">
                    <DetailField
                      label={t("detail.status.label")}
                      errors={errorOf(status, ids.status)}
                    >
                      <ChoiceChip<StatusCategory>
                        label={t("detail.menuLabel", {
                          field: t("detail.status.label"),
                          current: t(`detail.status.${task.statusCategory}`),
                        })}
                        icon={CircleDot}
                        options={statusOptions}
                        value={task.statusCategory}
                        onChange={(value) =>
                          status.save({ statusCategory: value })
                        }
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
                                    contexts.find((c) => c.id === contextId)
                                      ?.name ?? null,
                                })
                              }
                              disabled={side.pending || context.pending}
                              describedBy={describedBy(context, ids.context)}
                            />
                          )}
                        </>
                      )}
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
                      />
                    </DetailField>
                    <DetailField
                      label={t("detail.tags")}
                      errors={errorOf(tags, ids.tags)}
                    >
                      <TagsChip
                        value={tagsDraft}
                        onChange={changeTags}
                        onOpenChange={saveTags}
                        disabled={tags.pending}
                        describedBy={describedBy(tags, ids.tags)}
                      />
                    </DetailField>
                  </div>

                  {!subtask && (
                    <div className="border-t border-border pt-4">
                      <SubtaskList
                        parentId={task.id}
                        subtasks={task.subtasks}
                        counter={subtaskCounter(task)}
                        today={today}
                        listQuery={listQuery}
                      />
                    </div>
                  )}

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
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
