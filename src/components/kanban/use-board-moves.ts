// File des déplacements optimistes d'un tableau (spec todo-kanban, « Tableau », mise à jour optimiste), sans
// notion de tâche, sans bibliothèque de glisser, sans appel serveur ni import de `next/*` : l'enregistrement
// est une fonction reçue.
//
// Affichage. Affiché = tableau enregistré + dépôts rejoués par-dessus, dans l'ordre des dépôts (`applyMove`, même
// règle de placement que le serveur). Un dépôt est rejoué tant qu'il est en attente, puis tant qu'il est
// « confirmé, pas encore vu du serveur » : la carte reste où elle est lâchée, sans recul.
//
// File. Les enregistrements partent l'un après l'autre, dans l'ordre des dépôts. Un maillon ne rejette jamais :
// quoi qu'il arrive (enregistrement ou relevé de carte qui lève), le dépôt sort de l'attente et le suivant part.
//
// Réussite : le dépôt devient confirmé. Il n'est plus compté dans `pendingCount`, mais reste rejoué par-dessus
// le tableau enregistré jusqu'au premier tableau du serveur reçu APRÈS sa réussite. À ce moment-là seulement le
// serveur fait foi : tous les dépôts confirmés sont retirés, l'affiché est ce tableau + les dépôts encore en
// attente (la carte peut alors y être ailleurs que demandé : tête de Terminée, voisine périmée). Un tableau reçu
// AVANT la réussite ne retire rien : rien ne dit qu'il connaît ce dépôt (deux dépôts rapides : le tableau
// rafraîchi du premier arrive pendant l'enregistrement du second).
// Hypothèse, à la charge de l'appelant : chaque enregistrement réussi est suivi d'un rendu serveur (revalidation
// par l'action, ou `router.refresh()`), et Next livre les nouvelles props après avoir résolu la promesse de
// l'action. Limite assumée : si aucun tableau nouveau n'arrive après une réussite (le serveur rend un contenu
// identique au précédent), le dépôt confirmé reste rejoué ; sans effet visible quand le serveur a placé la carte
// là où elle a été déposée.
//
// Échec (`save` rend faux) : le déplacement sort de l'attente, la carte revient à sa place et `failure` propose de
// réessayer ; `failure` s'efface au geste suivant, après 5 s, ou par `dismissFailure` (fermeture de la bulle par
// l'utilisateur). Échec d'un dépôt dépassé par un dépôt plus récent de la même carte : ni retour ni `failure`.
//
// Contrat de `save` : il ne lève jamais, il rend vrai (enregistré) ou faux (échec). S'il lève quand même, le
// hook compte un échec, garde la file en vie et remet l'erreur à l'appelant par `onSaveError`. Attention à
// `settleAction` (`src/lib/settle-action.ts`) : il rend `{ ok: false }` pour une panne, mais RELANCE les erreurs
// de contrôle de Next (renvoi vers `/login` d'une session expirée, `notFound`). Un `save` bâti dessus lève donc
// dans ces cas-là, et c'est `onSaveError` qui reçoit l'erreur : ici, hors rendu et hors transition, Next ne la
// voit pas. À l'appelant de la lui rendre (la relancer là où Next l'attrape : dans une transition ou au rendu),
// sans quoi la session expirée ne mène pas à `/login` ; et de journaliser une vraie panne. Une erreur relancée
// par `onSaveError` lui-même sort de la file en rejet non géré, sans l'arrêter.
//
// Tableau enregistré (`saved`). Comparé par son contenu (colonnes et cartes, dans l'ordre), pas par sa référence :
// - contenu nouveau (rendu serveur) : c'est un tableau du serveur ; il retire les dépôts confirmés, les dépôts
//   encore en attente sont rejoués dessus ; celui dont la carte n'y est plus n'est plus affiché et son échec
//   reste muet (son enregistrement, déjà dû, part quand même) ;
// - nouvelle référence au contenu identique (rendu du parent sans nouvelles données, tableau refait à chaque
//   rendu) : ce n'est pas un nouveau tableau, rien n'est retiré. Coût : une comparaison par rendu ; un `useMemo`
//   chez l'appelant l'évite.
//
// Retour d'une carte : sa position au moment de l'échec est relevée avant le rendu ; l'appelant la consomme dans
// un `useLayoutEffect` (`consumeReturn`) et anime la carte depuis ce départ.
//
// Démontage : les dépôts déjà faits sont quand même enregistrés ; plus aucun état mis à jour, aucune carte
// relevée, aucune erreur remise à `onSaveError`.
import { useEffect, useRef, useState } from "react";

import { applyMove, type BoardIds, boardHas, sameBoard } from "./board-moves";
import type { BoardMove } from "./SortableBoard";

/** `failure` effacé au geste suivant ou après 5 s (DESIGN.md § 5, **Boutons**). */
export const FAILURE_NOTICE_MS = 5000;

/** Dépôt rejoué par-dessus le tableau enregistré ; `confirmed` : enregistré, pas encore vu du serveur. */
type ReplayedMove = { key: number; move: BoardMove; confirmed: boolean };
type Origin = { id: string; left: number; top: number };

/** Départ du retour d'une carte : décalage, en px, entre l'endroit du dépôt et sa place retrouvée. */
export type CardReturn = { element: HTMLElement; x: number; y: number };

export type BoardMovesOptions<K extends string> = {
  /** Tableau enregistré, comparé par son contenu (voir l'en-tête). */
  saved: BoardIds<K>;
  /**
   * Enregistre un déplacement : vrai = enregistré, faux = échec ; ne lève jamais (voir l'en-tête). Celle du
   * rendu où la carte est déposée.
   */
  save: (move: BoardMove) => Promise<boolean>;
  /** Vrai : aucun retour à animer. */
  reducedMotion: boolean;
  /** Élément de la carte en place (pas le calque du glisser), `null` si elle n'est pas rendue. */
  cardElement: (id: string) => HTMLElement | null;
  /**
   * Reçoit ce qui a levé pendant un dépôt (`save` malgré son contrat, relevé de la carte) : erreur de contrôle de
   * Next à rendre à Next, panne à journaliser. Celle du rendu où la carte est déposée ; jamais après démontage.
   */
  onSaveError: (error: unknown) => void;
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
  /** Efface `failure` sans rien rejouer (bulle d'échec fermée par l'utilisateur). */
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
  onSaveError,
}: BoardMovesOptions<K>): BoardMoves<K> {
  // Dernier tableau enregistré retenu : celui dont le contenu a changé en dernier.
  const [held, setHeld] = useState(saved);
  const [replayed, setReplayed] = useState<ReplayedMove[]>([]);
  const [failed, setFailed] = useState<BoardMove | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextKey = useRef(0);
  // Dernier dépôt de chaque carte : l'échec d'un dépôt plus ancien est dépassé, rien à ramener ni à réessayer.
  const latestMove = useRef(new Map<string, number>());
  const returning = useRef<Origin | null>(null);
  const mounted = useRef(false);

  // Tableau du serveur (contenu nouveau) : retenu pendant le rendu (pas d'affichage intermédiaire), et le serveur
  // fait foi pour les dépôts déjà confirmés. Une nouvelle référence au contenu identique ne change rien.
  if (held !== saved && !sameBoard(held, saved)) {
    setHeld(saved);
    setReplayed((current) => current.filter((entry) => !entry.confirmed));
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
    setReplayed((current) => [
      ...current,
      { key, move: next, confirmed: false },
    ]);

    /** Un maillon de la file : ne rejette jamais, rend ce qui a levé en route. */
    async function settle(): Promise<unknown[]> {
      const thrown: unknown[] = [];
      let ok = false;
      try {
        ok = await save(next);
      } catch (error) {
        // `save` a levé malgré son contrat : échec, et l'erreur va à l'appelant (`onSaveError`).
        thrown.push(error);
      }
      // Tableau démonté : le dépôt est parti, plus rien à afficher ni à remettre.
      if (!mounted.current) return [];
      if (ok) {
        // Confirmé : rejoué jusqu'au premier tableau du serveur reçu après cette réussite.
        setReplayed((current) =>
          current.map((entry) =>
            entry.key === key ? { ...entry, confirmed: true } : entry,
          ),
        );
        return thrown;
      }
      if (latestMove.current.get(next.id) === key) {
        returning.current = null;
        try {
          // Carte absente (colonne d'un autre onglet, carte disparue) : retour sans animation.
          const rect = cardElement(next.id)?.getBoundingClientRect();
          if (rect) {
            returning.current = { id: next.id, left: rect.left, top: rect.top };
          }
        } catch (error) {
          // Relevé impossible : retour sans animation, et l'erreur va à l'appelant.
          thrown.push(error);
        }
        setFailed(next);
      }
      setReplayed((current) => current.filter((entry) => entry.key !== key));
      return thrown;
    }

    const settled = queue.current.then(settle);
    queue.current = settled.then(() => undefined);
    // Hors de la file : une erreur relancée par `onSaveError` ne l'arrête pas (rejet non géré, visible).
    void settled.then((thrown) => {
      for (const error of thrown) onSaveError(error);
    });
  }

  // Carte disparue du tableau enregistré : rien à réessayer.
  const failure = failed !== null && boardHas(held, failed.id) ? failed : null;

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
    board: replayed.reduce(
      (current, entry) => applyMove(current, entry.move),
      held,
    ),
    move,
    pendingCount: replayed.filter((entry) => !entry.confirmed).length,
    failure,
    dismissFailure: () => setFailed(null),
    consumeReturn,
  };
}
