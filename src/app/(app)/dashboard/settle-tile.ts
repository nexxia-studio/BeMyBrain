// Lecture d'une tuile du tableau de bord, côté serveur seulement.
import "server-only";

import { captureException } from "@sentry/nextjs";
import { unstable_rethrow } from "next/navigation";

import { redirectIfRejectedToken } from "@/lib/session";

/** Tuiles qui lisent des données : nom technique seul, envoyé en tag à Sentry. */
export type DataTile = "today" | "sideTodo";

/**
 * Lit les données d'une tuile sans faire tomber le tableau de bord : une panne donne null (la tuile affiche son
 * état d'erreur), journalisée côté serveur et envoyée à Sentry avec le nom de la tuile seul (ni donnée, ni jeton).
 * Erreurs de contrôle de Next relancées ; jeton refusé (expiré entre la garde et la base) → /login.
 */
export async function settleTile<T>(
  tile: DataTile,
  load: () => Promise<T>,
): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    unstable_rethrow(error);
    await redirectIfRejectedToken(error);
    console.error("[dashboard] tuile en échec", { tile }, error);
    captureException(error, { tags: { tile } });
    return null;
  }
}
