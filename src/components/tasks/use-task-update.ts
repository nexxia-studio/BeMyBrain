"use client";

import { useState, useTransition } from "react";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";
import type { TaskErrorCode } from "@/modules/tasks/errors";

/** Échec d'un champ : code traduit (`tasks.errors.*`) ou, sans code, message générique. */
export type FieldFailure = { code?: TaskErrorCode } | null;

export type TaskUpdate = {
  pending: boolean;
  failure: FieldFailure;
  /** Envoie `tasks.update` pour ce seul champ (registre, origine `app`) ; pas d'optimiste. */
  save: (changes: Record<string, unknown>) => void;
};

/**
 * Enregistrement d'un champ du détail : un appel `tasks.update` à la fois, `pending` pendant l'appel (champ
 * désactivé), échec gardé pour l'afficher sous le champ, effacé au prochain essai. La valeur affichée vient
 * du rendu serveur, rafraîchi après l'écriture.
 */
export function useTaskUpdate(taskId: string): TaskUpdate {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<FieldFailure>(null);

  function save(changes: Record<string, unknown>) {
    if (pending) return;
    setFailure(null);
    startTransition(async () => {
      const outcome = await settleAction(() =>
        runAppAction("tasks.update", { taskId, ...changes }),
      );
      if (outcome.ok && outcome.value.ok) return;
      setFailure({
        code: outcome.ok && !outcome.value.ok ? outcome.value.code : undefined,
      });
    });
  }

  return { pending, failure, save };
}
