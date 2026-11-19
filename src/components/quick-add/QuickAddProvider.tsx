"use client";

// Ajout rapide de la coque : état d'ouverture, dernier type utilisé (retenu tant que la coque est montée,
// c'est-à-dire pour la session de l'onglet), et fonction d'ouverture partagée avec les déclencheurs
// (« + » de la barre d'onglets, bouton d'ajout rond de l'en-tête, to-do, palette).
// Champ relais (essai iPhone, 2026-11-19) : iOS n'ouvre le clavier que pour un focus donné dans le geste, or le
// titre n'existe qu'au rendu suivant. `openQuickAdd` focalise donc tout de suite un champ toujours monté, puis
// ouvre ; le dialogue passe le focus au titre et iOS garde le clavier d'un champ à l'autre. Au pointeur grossier
// seulement : un clavier physique n'en a pas besoin, et le focus ne transite pas par un champ caché sur ordinateur.
import { useCallback, useEffect, useRef, useState } from "react";

import { QuickAdd } from "./QuickAdd";
import { OpenQuickAddContext } from "./quick-add-context";
import {
  QUICK_ADD_TYPES,
  type QuickAddScope,
  type QuickAddType,
} from "./quick-add-types";

type QuickAddProviderProps = {
  children: React.ReactNode;
  /** Côté et espace courants (lus par le layout), passés au formulaire du type. */
  scope: QuickAddScope;
  /** Types déclarés ; à remplacer seulement dans les tests. */
  types?: readonly QuickAddType[];
};

const COARSE_POINTER = "(pointer: coarse)";
/** Délai au-delà duquel le relais rend le focus s'il l'a encore (tiroir qui n'a pas pris le focus). */
export const RELAY_RELEASE_MS = 1000;

/** Le relais ne garde jamais le focus : retour au déclencheur s'il existe encore, sinon simple blur. */
function releaseRelay(relay: HTMLInputElement, target: HTMLElement | null) {
  if (document.activeElement !== relay) return;
  if (target?.isConnected && target !== document.body) {
    target.focus({ preventScroll: true });
  } else {
    relay.blur();
  }
}

export function QuickAddProvider({
  children,
  scope,
  types = QUICK_ADD_TYPES,
}: QuickAddProviderProps) {
  const [open, setOpen] = useState(false);
  const [typeKey, setTypeKey] = useState(types[0].key);
  // Lu par `openQuickAdd` sans en dépendre : fonction stable, les déclencheurs ne se re-rendent pas.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  const relayRef = useRef<HTMLInputElement>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Élément à refocaliser à la fermeture quand le relais a servi ; `undefined` : relais non utilisé.
  const [relayTarget, setRelayTarget] = useState<HTMLElement | null>();

  const openQuickAdd = useCallback(() => {
    // Déjà ouvert : le relais volerait le focus du titre.
    if (openRef.current) return;
    const relay = relayRef.current;
    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia(COARSE_POINTER).matches;
    if (relay && coarse) {
      const active = document.activeElement;
      const target = active instanceof HTMLElement ? active : null;
      // Synchrone, dans le geste : c'est ce focus qui ouvre le clavier iOS.
      relay.focus({ preventScroll: true });
      setRelayTarget(target);
      clearTimeout(releaseTimer.current);
      releaseTimer.current = setTimeout(
        () => releaseRelay(relay, target),
        RELAY_RELEASE_MS,
      );
    } else {
      setRelayTarget(undefined);
    }
    openRef.current = true;
    setOpen(true);
  }, []);

  useEffect(() => () => clearTimeout(releaseTimer.current), []);

  // Base UI rendrait le focus au relais (dernier focus avant l'ouverture) : on désigne le déclencheur.
  const finalFocus =
    relayTarget === undefined
      ? true
      : () => {
          if (relayTarget?.isConnected && relayTarget !== document.body) {
            return relayTarget;
          }
          // Appelé pendant le commit de React, qui refocaliserait l'élément qu'on vient de quitter : blur
          // après le commit, comme Base UI rend lui-même le focus (microtâche).
          const relay = relayRef.current;
          if (relay) queueMicrotask(() => releaseRelay(relay, null));
          return false;
        };

  return (
    <OpenQuickAddContext value={openQuickAdd}>
      {children}
      <QuickAdd
        open={open}
        onOpenChange={setOpen}
        types={types}
        typeKey={typeKey}
        onTypeChange={setTypeKey}
        scope={scope}
        finalFocus={finalFocus}
      />
      <input
        ref={relayRef}
        data-quick-add-relay=""
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        // 16 px (`text-base`) : sinon Safari iOS zoome au focus. Fixe dans la fenêtre : aucun défilement.
        className="pointer-events-none fixed top-0 left-0 size-px text-base opacity-0"
      />
    </OpenQuickAddContext>
  );
}
