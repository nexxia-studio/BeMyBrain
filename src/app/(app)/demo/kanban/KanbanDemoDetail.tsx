"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Détail d'une carte de la démo du kanban (BRAIN-46, D5) : même fenêtre que la liste (`TaskDetailSheet`, panneau
// sur ordinateur, tiroir sur mobile), fermée par rappel (aucune adresse). Une colonne, ordre du vrai détail
// (`TaskDetail`) : titre et croix, notes, lignes de champs (Statut, Priorité, Échéance, Tags), sous-tâches.
// État local de la démo seulement : aucune action serveur, aucun registre (`TaskDetail`, `SubtaskList` et
// `TaskRow` en appellent, d'où ce double). Chaque champ s'applique tout de suite ; le statut passe par le
// déplacement de la démo (la carte change de colonne, enregistrement simulé).
// Sous-tâches : lignes bordées sur le `popover` opaque (comme `SubtaskList`), case à cocher locale, sans lien,
// puis le champ commun `SubtaskAddField` (ajout dans l'état local, D8).
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import { CircleDot, Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { ChoiceChip } from "@/components/tasks/ChoiceChip";
import { DetailField } from "@/components/tasks/DetailField";
import { DueDateChip } from "@/components/tasks/DueDateChip";
import { SubtaskAddField } from "@/components/tasks/SubtaskAddField";
import {
  isRowPriority,
  PRIORITY_ICONS,
} from "@/components/tasks/priority-icons";
import { TagsChip } from "@/components/tasks/TagsChip";
import {
  TASK_ROW_LINE_CLASSES,
  TASK_ROW_TEXT_CLASSES,
  TASK_ROW_TITLE_TEXT,
} from "@/components/tasks/task-list-layout";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { cn } from "@/lib/utils";

import { DEMO_STATUSES, type DemoStatus } from "./demo-board";
import type { DemoTask } from "./demo-fixtures";

const PRIORITIES = ["0", "1", "2", "3", "4"] as const;

export type DemoEdit = Partial<
  Pick<
    DemoTask,
    "notes" | "priority" | "dueDate" | "dueTime" | "tags" | "subtasks"
  >
>;

type KanbanDemoDetailProps = {
  /** Carte telle qu'affichée (modifications locales comprises, statut = sa colonne). */
  task: DemoTask;
  /** `YYYY-MM-DD`, jour de l'utilisateur. */
  today: string;
  /** Tags des cartes de la démo, proposés par la pastille Tags. */
  knownTags: readonly string[];
  onStatusChange: (status: DemoStatus) => void;
  onEdit: (edit: DemoEdit) => void;
  /** Ajoute une sous-tâche non faite à la fin (titre déjà nettoyé). */
  onAddSubtask: (title: string) => void;
  onClose: () => void;
};

export function KanbanDemoDetail({
  task,
  today,
  knownTags,
  onStatusChange,
  onEdit,
  onAddSubtask,
  onClose,
}: KanbanDemoDetailProps) {
  const t = useTranslations("tasks");
  const notesId = useId();
  const subtasksId = useId();
  const done = task.subtasks.filter((subtask) => subtask.done).length;
  // Compteur « n/m », comme celui du vrai détail (`subtaskCounter`).
  const counter = `${done}/${task.subtasks.length}`;

  const statusOptions = DEMO_STATUSES.map((value) => ({
    value,
    label: t(`detail.status.${value}`),
  }));
  const priorityOptions = PRIORITIES.map((value) => {
    const level = Number(value);
    return {
      value,
      label: t(`detail.priority.${value}`),
      icon: isRowPriority(level) ? PRIORITY_ICONS[level] : undefined,
    };
  });

  return (
    <TaskDetailSheet onClose={onClose}>
      {(closeButton) => (
        <div className="flex flex-col gap-5 px-4 pb-5 lg:p-5">
          <div className="flex items-start justify-between gap-3">
            {/* Contenu saisi : jamais traduit. */}
            <h2 className="min-w-0 py-2 font-heading text-title break-words">
              {task.title}
            </h2>
            {closeButton}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={notesId} className="text-small font-medium">
              {t("detail.notes")}
            </label>
            <textarea
              id={notesId}
              rows={3}
              value={task.notes ?? ""}
              onChange={(event) =>
                onEdit({
                  notes: event.target.value === "" ? null : event.target.value,
                })
              }
              className="min-h-24 w-full resize-none rounded-lg border border-input bg-row px-3 py-2.5 text-base text-foreground field-sizing-content"
            />
          </div>

          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <DetailField label={t("detail.status.label")} errors={[]}>
              <ChoiceChip<DemoStatus>
                label={t("detail.menuLabel", {
                  field: t("detail.status.label"),
                  current: t(`detail.status.${task.status}`),
                })}
                icon={CircleDot}
                options={statusOptions}
                value={task.status}
                onChange={onStatusChange}
                disabled={false}
              />
            </DetailField>
            <DetailField label={t("detail.priority.label")} errors={[]}>
              <ChoiceChip
                label={t("detail.menuLabel", {
                  field: t("detail.priority.label"),
                  current: t(`detail.priority.${task.priority}`),
                })}
                icon={Flag}
                options={priorityOptions}
                value={String(task.priority)}
                onChange={(value) => onEdit({ priority: Number(value) })}
                disabled={false}
              />
            </DetailField>
            <DetailField label={t("detail.due")} errors={[]}>
              <DueDateChip
                today={today}
                value={{ date: task.dueDate, time: task.dueTime }}
                onChange={({ date, time }) =>
                  onEdit({
                    dueDate: date,
                    dueTime: date === null ? null : time,
                  })
                }
                disabled={false}
                emptyLabel="none"
              />
            </DetailField>
            <DetailField label={t("detail.tags")} errors={[]}>
              <TagsChip
                value={[...task.tags]}
                onChange={(tags) => onEdit({ tags })}
                disabled={false}
                emptyLabel="none"
                loadTags={async () => [...knownTags]}
              />
            </DetailField>
          </div>

          <section
            aria-labelledby={subtasksId}
            className="flex flex-col gap-3 border-t border-border pt-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3
                id={subtasksId}
                className="text-small font-semibold text-foreground"
              >
                {t("detail.subtasks.title")}
              </h3>
              {task.subtasks.length > 0 && (
                <span
                  aria-hidden="true"
                  className="font-heading text-small text-muted-foreground"
                >
                  {counter}
                </span>
              )}
            </div>
            {task.subtasks.length > 0 && (
              <ul className="flex flex-col gap-2">
                {task.subtasks.map((subtask) => (
                  <li
                    key={subtask.id}
                    className="rounded-lg border border-border"
                  >
                    <label
                      className={cn(TASK_ROW_LINE_CLASSES, "cursor-pointer")}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center">
                        <input
                          type="checkbox"
                          checked={subtask.done}
                          onChange={() =>
                            onEdit({
                              subtasks: task.subtasks.map((each) =>
                                each.id === subtask.id
                                  ? { ...each, done: !each.done }
                                  : each,
                              ),
                            })
                          }
                          className="size-4.5 cursor-pointer"
                        />
                      </span>
                      <span className={TASK_ROW_TEXT_CLASSES}>
                        {/* Contenu saisi : jamais traduit. */}
                        <span
                          className={cn(
                            TASK_ROW_TITLE_TEXT,
                            "break-words",
                            subtask.done && "text-muted-foreground",
                          )}
                        >
                          {subtask.title}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <SubtaskAddField
              onAdd={async (title) => {
                onAddSubtask(title.trim());
                return null;
              }}
            />
          </section>
        </div>
      )}
    </TaskDetailSheet>
  );
}
