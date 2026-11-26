"use server";

import { cookies } from "next/headers";

import { requireSession } from "@/lib/session";
import { sideSchema } from "@/modules/core/schemas";

import {
  contextsCookie,
  PREFERENCE_COOKIE_OPTIONS,
  serializeContextSelection,
  SIDE_COOKIE,
  TASKS_VIEW_COOKIE,
} from "./preferences";
import { tasksViews } from "./tasks-view";

// Préférences d'affichage : un cookie par choix, relu par le rendu serveur (Next rafraîchit la route
// après une action qui écrit un cookie). Entrée invalide → rien n'est écrit, sans erreur.
// Hors registre, assumé (plan socle, tâche 20) : préférences d'affichage en cookies (next/headers), interdits
// dans un registre sans Next. Si l'assistant doit basculer le côté, la préférence passera en base et l'action
// entrera au registre.

/** Côté affiché (Privé / Pro). */
export async function setSide(side: unknown): Promise<void> {
  await requireSession();
  const result = sideSchema.safeParse(side);
  if (!result.success) return;
  (await cookies()).set(SIDE_COOKIE, result.data, PREFERENCE_COOKIE_OPTIONS);
}

/** Vue de la to-do (Liste / Tableau) ; valeur hors de la liste fermée → rien n'est écrit. */
export async function setTasksView(view: unknown): Promise<void> {
  await requireSession();
  const known = tasksViews.find((value) => value === view);
  if (known === undefined) return;
  (await cookies()).set(TASKS_VIEW_COOKIE, known, PREFERENCE_COOKIE_OPTIONS);
}

/** Espaces retenus pour un côté (Privé ou Pro) ; `null` = tous (le cookie de ce côté est effacé). */
export async function setContextSelection(
  side: unknown,
  ids: unknown,
): Promise<void> {
  await requireSession();
  const parsedSide = sideSchema.safeParse(side);
  if (!parsedSide.success) return;
  const name = contextsCookie(parsedSide.data);
  const store = await cookies();
  if (ids === null) {
    store.delete(name);
    return;
  }
  const value = serializeContextSelection(ids);
  if (value === null) return;
  store.set(name, value, PREFERENCE_COOKIE_OPTIONS);
}
