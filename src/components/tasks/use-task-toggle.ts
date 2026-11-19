"use client";

import { useState, useTransition } from "react";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";
import type { TaskErrorCode } from "@/modules/tasks/errors";
import type { Task } from "@/modules/tasks/queries";

/** Échec de la case : code traduit (`tasks.errors.*`) ou, sans code, message générique. */
export type ToggleFailure = { code?: TaskErrorCode } | null;

export type TaskToggle = {
  /** Terminée ou annulée : case cochée, un tap la rouvre. */
  closed: boolean;
  canceled: boolean;
  pending: boolean;
  failure: ToggleFailure;
  toggle: () => void;
};

/**
 * Case à cocher d'une ligne de tâche (liste, tuiles) : `tasks.complete` par le registre (origine `app`) ; rouvrir
 * une tâche fermée : `tasks.update` vers « À faire ». Pas d'optimiste : la case garde l'état reçu du serveur,
 * `pending` pendant l'appel (case désactivée), échec gardé pour l'afficher dans la ligne.
 */
export function useTaskToggle(task: Task): TaskToggle {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ToggleFailure>(null);
  const canceled = task.statusCategory === "canceled";
  const closed = task.statusCategory === "completed" || canceled;

  function toggle() {
    if (pending) return;
    setFailure(null);
    startTransition(async () => {
      const outcome = await settleAction(() =>
        closed
          ? runAppAction("tasks.update", {
              taskId: task.id,
              statusCategory: "unstarted",
            })
          : runAppAction("tasks.complete", { taskId: task.id }),
      );
      if (outcome.ok && outcome.value.ok) return;
      setFailure({
        code: outcome.ok && !outcome.value.ok ? outcome.value.code : undefined,
      });
    });
  }

  return { closed, canceled, pending, failure, toggle };
}
