"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";

// Le message d'échec s'efface seul après ce délai, ou au geste suivant.
export const FAILURE_VISIBLE_MS = 5000;

/**
 * Préférence d'affichage optimiste (exception de frontend.md « États », bascule Privé / Pro et filtre
 * d'espace) : le contrôle reste cliquable et change tout de suite ; `pending` alimente `aria-busy`.
 * Si l'enregistrement échoue, `shown` revient à la valeur enregistrée (fin de la transition) et `failed`
 * passe à vrai, le temps d'afficher un message. Seul l'échec du dernier `update` compte : un
 * enregistrement dépassé par un geste plus récent n'affiche rien.
 */
export function useOptimisticPreference<T>(
  saved: T,
  save: (next: T) => Promise<void>,
) {
  const [shown, setShown] = useOptimistic(saved);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const latestRequest = useRef(0);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), FAILURE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  function update(next: T) {
    const request = ++latestRequest.current;
    setFailed(false);
    startTransition(async () => {
      setShown(next);
      try {
        await save(next);
      } catch {
        if (request === latestRequest.current) setFailed(true);
      }
    });
  }

  return { shown, pending, failed, update };
}
