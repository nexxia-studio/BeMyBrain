"use client";

import { useSyncExternalStore } from "react";

// Clavier virtuel (spec todo-unifiee, ajout rapide) : sur iOS, le clavier recouvre la page sans la
// redimensionner ; un élément `fixed` en bas reste dessous. On mesure la hauteur masquée sous la zone
// visible (`visualViewport`) pour remonter le tiroir. Android redimensionne la page
// (`interactiveWidget: "resizes-content"`, src/app/layout.tsx) : la mesure y reste à 0.

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  viewport.addEventListener("resize", onChange);
  viewport.addEventListener("scroll", onChange);
  return () => {
    viewport.removeEventListener("resize", onChange);
    viewport.removeEventListener("scroll", onChange);
  };
}

function snapshot(): number {
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  return Math.max(
    0,
    Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
  );
}

const idle = () => () => {};
const zero = () => 0;

/**
 * Hauteur (px) cachée sous la zone visible, clavier compris ; 0 au rendu serveur, sans `visualViewport` et
 * quand `active` est faux (tiroir fermé : aucun écouteur posé).
 */
export function useKeyboardInset(active: boolean): number {
  return useSyncExternalStore(
    active ? subscribe : idle,
    active ? snapshot : zero,
    zero,
  );
}
