import { unstable_rethrow } from "next/navigation";

export type Settled<T> = { ok: true; value: T } | { ok: false };

/**
 * Appel d'une Server Action depuis un composant client, partout où son échec est attrapé (QA-1).
 * Échec (panne, réponse inattendue, pare-feu) → `{ ok: false }`, à afficher par l'appelant.
 * Erreurs de contrôle de Next (renvoi vers /login d'une session expirée, notFound) → relancées : Next
 * navigue au lieu d'un message d'échec. Ne jamais remplacer par un `catch {}` nu (docs/gotchas.md).
 */
export async function settleAction<T>(
  call: () => Promise<T>,
): Promise<Settled<T>> {
  try {
    return { ok: true, value: await call() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false };
  }
}
