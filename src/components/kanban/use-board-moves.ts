// File des déplacements optimistes d'un tableau (spec todo-kanban, « Tableau », mise à jour optimiste), sans
// notion de tâche, sans bibliothèque de glisser ni appel serveur : l'enregistrement est une fonction reçue.
// Affiché = enregistré + déplacements en attente rejoués par-dessus : la carte reste où elle est lâchée.
// Les enregistrements partent l'un après l'autre, dans l'ordre des dépôts. Réussite : le déplacement rejoint le
// tableau enregistré tenu ici, sans attendre le prochain tableau reçu. Échec : le déplacement sort de l'attente,
// la carte revient à sa place et `failure` propose de réessayer (effacé au geste suivant ou après 5 s). Échec d'un
// dépôt dépassé par un dépôt plus récent de la même carte : ni retour ni `failure`.
// Tableau enregistré remplacé (nouvelles props après un rendu serveur) : il fait foi, les déplacements encore en
// attente sont rejoués dessus ; celui dont la carte n'y est plus n'est plus affiché et son échec reste muet
// (son enregistrement, déjà dû, part quand même).
// Retour d'une carte : sa position au moment de l'échec est relevée avant le rendu ; l'appelant la consomme dans
// un `useLayoutEffect` (`consumeReturn`) et anime la carte depuis ce départ.
import { useEffect, useRef, useState } from "react";

import { applyMove, type BoardIds, boardHas } from "./board-moves";
import type { BoardMove } from "./SortableBoard";

/** `failure` effacé au geste suivant ou après 5 s (DESIGN.md § 5, **Boutons**). */
export const FAILURE_NOTICE_MS = 5000;

type PendingMove = { key: number; move: BoardMove };
type Origin = { id: string; left: number; top: number };

/** Départ du retour d'une carte : décalage, en px, entre l'endroit du dépôt et sa place retrouvée. */
export type CardReturn = { element: HTMLElement; x: number; y: number };

export type BoardMovesOptions<K extends string> = {
  /**
   * Tableau enregistré. Même référence d'un rendu à l'autre tant qu'il n'a pas changé (`useMemo` ou props du
   * serveur) : une nouvelle référence remplace le tableau tenu ici.
   */
  saved: BoardIds<K>;
  /**
   * Enregistre un déplacement ; vrai = enregistré. Celle du rendu où la carte est déposée. Une erreur levée
   * compte pour un échec : les erreurs de contrôle de Next se traitent chez l'appelant (`settleAction`).
   */
  save: (move: BoardMove) => Promise<boolean>;
  /** Vrai : aucun retour à animer. */
  reducedMotion: boolean;
  /** Élément de la carte en place (pas le calque du glisser), `null` si elle n'est pas rendue. */
  cardElement: (id: string) => HTMLElement | null;
};

export type BoardMoves<K extends string> = {
  /** Tableau à afficher. */
  board: BoardIds<K>;
  /** Dépose une carte : affichée aussitôt, enregistrée à son tour. */
  move: (next: BoardMove) => void;
  /** Déplacements pas encore enregistrés. */
  pendingCount: number;
  /** Déplacement échoué à proposer en « Réessayer », sinon `null`. */
  failure: BoardMove | null;
  /** Rejoue le déplacement échoué ; sans échec, rien. */
  retry: () => void;
  dismissFailure: () => void;
  /**
   * À appeler dans un `useLayoutEffect` sans dépendances : rend une fois le départ du retour d'une carte après
   * un échec, `null` sinon (rien à ramener, mouvement réduit, carte non rendue ou déjà à sa place).
   */
  consumeReturn: () => CardReturn | null;
};

export function useBoardMoves<K extends string>({
  saved,
  save,
  reducedMotion,
  cardElement,
}: BoardMovesOptions<K>): BoardMoves<K> {
  const [base, setBase] = useState(saved);
  const [seenSaved, setSeenSaved] = useState(saved);
  const [pending, setPending] = useState<PendingMove[]>([]);
  const [failed, setFailed] = useState<BoardMove | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextKey = useRef(0);
  // Dernier dépôt de chaque carte : l'échec d'un dépôt plus ancien est dépassé, rien à ramener ni à réessayer.
  const latestMove = useRef(new Map<string, number>());
  const returning = useRef<Origin | null>(null);
  const mounted = useRef(false);

  // Nouveau tableau enregistré : il remplace celui tenu ici, pendant le rendu (pas d'affichage intermédiaire).
  if (seenSaved !== saved) {
    setSeenSaved(saved);
    setBase(saved);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (failed === null) return;
    const timer = setTimeout(() => setFailed(null), FAILURE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  function move(next: BoardMove) {
    const key = nextKey.current++;
    latestMove.current.set(next.id, key);
    setFailed(null);
    setPending((current) => [...current, { key, move: next }]);
    queue.current = queue.current.then(async () => {
      let ok: boolean;
      try {
        ok = await save(next);
      } catch {
        ok = false;
      }
      // Tableau démonté : le dépôt est parti, plus rien à afficher.
      if (!mounted.current) return;
      if (ok) {
        setBase((current) => applyMove(current, next));
      } else if (latestMove.current.get(next.id) === key) {
        // Carte absente (colonne d'un autre onglet, carte disparue) : retour sans animation.
        const rect = cardElement(next.id)?.getBoundingClientRect();
        returning.current = rect
          ? { id: next.id, left: rect.left, top: rect.top }
          : null;
        setFailed(next);
      }
      setPending((current) => current.filter((entry) => entry.key !== key));
    });
  }

  // Carte disparue du tableau enregistré : rien à réessayer.
  const failure = failed !== null && boardHas(base, failed.id) ? failed : null;

  function consumeReturn(): CardReturn | null {
    const origin = returning.current;
    if (origin === null) return null;
    returning.current = null;
    const element = reducedMotion ? null : cardElement(origin.id);
    if (element === null) return null;
    const to = element.getBoundingClientRect();
    const x = origin.left - to.left;
    const y = origin.top - to.top;
    return x === 0 && y === 0 ? null : { element, x, y };
  }

  return {
    board: pending.reduce(
      (current, entry) => applyMove(current, entry.move),
      base,
    ),
    move,
    pendingCount: pending.length,
    failure,
    retry: () => {
      if (failure !== null) move(failure);
    },
    dismissFailure: () => setFailed(null),
    consumeReturn,
  };
}
