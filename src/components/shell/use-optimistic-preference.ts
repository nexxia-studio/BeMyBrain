"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";

// Le message d'échec s'efface seul après ce délai, ou au geste suivant.
const FAILURE_VISIBLE_MS = 5000;

/**
 * Préférence d'affichage optimiste (exception de frontend.md « États », bascule Privé / Pro et filtre
 * d'espace) : le contrôle reste cliquable et change tout de suite ; `pending` alimente `aria-busy`.
 * Si l'enregistrement échoue, `shown` revient à la valeur enregistrée (fin de la transition) et `failed`
 * passe à vrai, le temps d'afficher un message.
 */
export function useOptimisticPreference<T>(
  saved: T,
  save: (next: T) => Promise<void>,
) {
  const [shown, setShown] = useOptimistic(saved);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), FAILURE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  function update(next: T) {
    setFailed(false);
    startTransition(async () => {
      setShown(next);
      try {
        await save(next);
      } catch {
        setFailed(true);
      }
    });
  }

  return { shown, pending, failed, update };
}
