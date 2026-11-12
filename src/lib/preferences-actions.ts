"use server";

import { cookies } from "next/headers";

import { requireSession } from "@/lib/session";
import { sideSchema } from "@/modules/core/schemas";

import {
  CONTEXTS_COOKIE,
  PREFERENCE_COOKIE_OPTIONS,
  serializeContextSelection,
  SIDE_COOKIE,
} from "./preferences";

// Préférences d'affichage : un cookie par choix, relu par le rendu serveur (Next rafraîchit la route
// après une action qui écrit un cookie). Entrée invalide → rien n'est écrit, sans erreur.
// raccourci: actions appelées directement par la coque — à déclarer dans le registre (ADR-009) à la tâche 20.

/** Côté affiché (Privé / Pro). */
export async function setSide(side: unknown): Promise<void> {
  await requireSession();
  const result = sideSchema.safeParse(side);
  if (!result.success) return;
  (await cookies()).set(SIDE_COOKIE, result.data, PREFERENCE_COOKIE_OPTIONS);
}

/** Contextes retenus côté Pro ; `null` = tous (le cookie est effacé). */
export async function setContextSelection(ids: unknown): Promise<void> {
  await requireSession();
  const store = await cookies();
  if (ids === null) {
    store.delete(CONTEXTS_COOKIE);
    return;
  }
  const value = serializeContextSelection(ids);
  if (value === null) return;
  store.set(CONTEXTS_COOKIE, value, PREFERENCE_COOKIE_OPTIONS);
}
