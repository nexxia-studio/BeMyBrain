import { useEffect, useState } from "react";

/** Délai avant d'annoncer « Enregistrement… » : une écriture rapide n'affiche rien. */
export const SLOW_PENDING_MS = 1000;

/** Vrai seulement quand `pending` dure plus de `delayMs` ; faux dès qu'il retombe. Minuteur nettoyé à chaque changement et au démontage. */
export function useSlowPending(
  pending: boolean,
  delayMs: number = SLOW_PENDING_MS,
): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);
  return pending && slow;
}
