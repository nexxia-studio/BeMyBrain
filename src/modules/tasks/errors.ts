import { DomainError, INVALID_PARAMS_MESSAGE } from "@/lib/errors";

export type TaskErrorCode =
  /** Paramètre refusé par zod : aucune requête n'est envoyée. */
  | "invalid_params"
  /** Tâche absente du workspace, ou à la corbeille (pour toute écriture sauf la restauration). */
  | "not_found"
  /** Espace désigné par son nom introuvable dans le workspace de la session. */
  | "context_not_found"
  /** Sous-tâche d'une sous-tâche : un seul niveau. */
  | "subtask_depth"
  /** Côté ou espace d'une sous-tâche modifié directement : ils suivent la parente. */
  | "subtask_follows_parent"
  /** Parente à la corbeille : restauration d'une de ses sous-tâches, ou création d'une sous-tâche sous elle. */
  | "parent_in_trash"
  /** Rattachement d'une tâche qui a des sous-tâches actives : un seul niveau. */
  | "has_subtasks"
  /** Parente visée de l'autre côté (privé / pro) que la tâche. */
  | "cross_side_parent";

/**
 * Message anglais par code, lisible par un modèle (assistant, connecteur) : ce qui est refusé et quoi faire.
 * Pas de l'interface (celle-ci traduit le code via messages/*.json). Phrases fixes : jamais la valeur reçue
 * ni une donnée d'un autre workspace.
 */
export const TASK_ERROR_MESSAGES = {
  invalid_params: INVALID_PARAMS_MESSAGE,
  not_found:
    "The task does not exist or is in the trash. List the tasks to get a valid task id.",
  context_not_found:
    "No space has this name. List the spaces of the side and use one of their names.",
  subtask_depth:
    "The parent is itself a subtask. Only one level of subtasks is allowed: use a top-level task as the parent.",
  subtask_follows_parent:
    "A subtask always has the side and space of its parent. Change them on the parent task instead.",
  parent_in_trash: "The parent task is in the trash. Restore the parent first.",
  has_subtasks:
    "The task has active subtasks, so it cannot become a subtask itself. Detach its subtasks or move them to the trash first, or choose another task.",
  cross_side_parent:
    "The parent task is on the other side (private or pro). A subtask must be on the same side as its parent: choose a parent on the same side, or change the side of the task first.",
} as const satisfies Record<TaskErrorCode, string>;

export class TaskError extends DomainError {
  declare readonly code: TaskErrorCode;
  constructor(code: TaskErrorCode) {
    super(code);
    // En dur : résiste à la minification (voir DomainError).
    this.name = "TaskError";
  }
}
