"use server";

import { refresh } from "next/cache";

import { syncLocaleCookie } from "@/lib/locale-cookie";
import {
  redirectIfRejectedToken,
  requireSessionWithToken,
} from "@/lib/session";
import { saveMemberLocale } from "@/modules/core/locale";
import { localeSchema } from "@/modules/core/schemas";

// raccourci: l'écran Réglages appelle cette action directe ; la même écriture existe au registre (core.setLocale,
// lancée par la palette via runAction) — faire passer LocalePicker par runAction quand un second écran l'imposera.

/**
 * Langue de l'interface (ADR-007) : enregistrée sur l'appartenance du workspace de la session (source de
 * vérité), recopiée dans NEXT_LOCALE, puis la route est rafraîchie (URL inchangée). Langue inconnue →
 * rien n'est écrit. Échec d'enregistrement → l'erreur remonte, le cookie n'est pas touché ; jeton expiré
 * entre-temps → /login.
 */
export async function setLocale(locale: unknown): Promise<void> {
  const { session, token } = await requireSessionWithToken();
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return;
  let saved: Awaited<ReturnType<typeof saveMemberLocale>>;
  try {
    saved = await saveMemberLocale(token, session.workspaceId, parsed.data);
  } catch (error) {
    // Jeton expiré entre la garde et l'écriture : renvoi vers /login (QA-1) ; le reste remonte.
    await redirectIfRejectedToken(error);
    throw error;
  }
  await syncLocaleCookie(saved);
  refresh();
}
