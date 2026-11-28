import { useCallback, useEffect, useRef, useState } from "react";

import type { ShoppingItem } from "@/modules/shopping/list-view";

/** Délai de l'« Annuler » (spec Q12). */
export const REMOVAL_UNDO_MS = 5000;

type Slot = { item: ShoppingItem; timer: ReturnType<typeof setTimeout> };

/**
 * Suppression d'un article avec « Annuler » 5 s, sans corbeille côté serveur (spec Q12).
 * Choix : suppression DIFFÉRÉE côté client (plutôt que supprimer puis réinsérer, qui demanderait une écriture
 * serveur de plus, `[security]`). `schedule` masque l'article tout de suite et arme un délai de 5 s ; `undo`
 * le rend sans qu'aucun appel serveur n'ait eu lieu ; à l'échéance, `send` supprime pour de bon.
 * Rien ne se perd en silence : le délai est vidé (envoi immédiat) quand l'écran est démonté (navigation) ou à
 * `pagehide` (fermeture de l'onglet, navigation hors de la page) ; un second article supprimé envoie
 * le premier tout de suite (un seul « Annuler » à la fois). Reste un cas : le navigateur qui coupe la requête
 * à la fermeture de l'onglet — l'article réapparaît alors à la réouverture, il n'est jamais perdu à tort. `pagehide` n'est pas garanti
 * partout (ex. app iOS tuée en arrière-plan sans événement) : même issue, l'article reste.
 * `send` rend `true` si le serveur a supprimé ; sinon l'article est rendu à l'écran et `onFailed` prévenu.
 */
export function useDeferredRemoval(
  send: (item: ShoppingItem) => Promise<boolean>,
  onFailed: (item: ShoppingItem) => void,
) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [undoable, setUndoable] = useState<ShoppingItem | null>(null);
  const slot = useRef<Slot | null>(null);
  const latest = useRef({ send, onFailed });
  useEffect(() => {
    latest.current = { send, onFailed };
  });

  const flush = useCallback(() => {
    const current = slot.current;
    if (current === null) return;
    clearTimeout(current.timer);
    slot.current = null;
    setUndoable(null);
    void latest.current.send(current.item).then((removed) => {
      if (removed) return;
      setHidden((ids) => without(ids, current.item.id));
      latest.current.onFailed(current.item);
    });
  }, []);

  const schedule = useCallback(
    (item: ShoppingItem) => {
      flush();
      setHidden((ids) => new Set(ids).add(item.id));
      setUndoable(item);
      slot.current = { item, timer: setTimeout(flush, REMOVAL_UNDO_MS) };
    },
    [flush],
  );

  const undo = useCallback(() => {
    const current = slot.current;
    if (current === null) return;
    clearTimeout(current.timer);
    slot.current = null;
    setUndoable(null);
    setHidden((ids) => without(ids, current.item.id));
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return { hidden, undoable, schedule, undo };
}

function without(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}
