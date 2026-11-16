"use server";

import { refresh } from "next/cache";

import { syncLocaleCookie } from "@/lib/locale-cookie";
import { requireSession, requireSessionToken } from "@/lib/session";
import { saveMemberLocale } from "@/modules/core/locale";
import { localeSchema } from "@/modules/core/schemas";

// raccourci: action appelée directement par l'écran Réglages — à déclarer dans le registre (ADR-009) à la tâche 20.

/**
 * Langue de l'interface (ADR-007) : enregistrée sur l'appartenance du workspace de la session (source de
 * vérité), recopiée dans NEXT_LOCALE, puis la route est rafraîchie (URL inchangée). Langue inconnue →
 * rien n'est écrit. Échec d'enregistrement → l'erreur remonte, le cookie n'est pas touché.
 */
export async function setLocale(locale: unknown): Promise<void> {
  const { workspaceId } = await requireSession();
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return;
  // Hors rendu, la session n'est pas mémoïsée : seconde vérification du jeton, assumée pour un geste rare.
  const token = await requireSessionToken();
  const saved = await saveMemberLocale(token, workspaceId, parsed.data);
  await syncLocaleCookie(saved);
  refresh();
}
