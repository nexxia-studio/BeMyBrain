"use client";

// Glissement des lignes quand l'ordre change (réordonnancement différé des Courses) : technique FLIP en Web
// Animations, portée par le `<li>` (`data-flip-id`), jamais par la carte glissable (aucun composant d'animation dans
// une ligne déplaçable). Exception datée dans ADR-006. Coupée sous `prefers-reduced-motion` : les lignes sautent à
// leur place après le délai. Positions relevées à chaque rendu (une hauteur de ligne peut changer sans changement
// d'ordre) par `offsetTop` (indifférent au défilement de la page). Une animation en cours est annulée et la ligne
// repart de la position affichée. Liste repliée (`hidden`) : positions oubliées, rien n'est animé au dépliage.
import { type RefObject, useLayoutEffect, useRef } from "react";

const DURATION_MS = 250;
const FALLBACK_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Décalage vertical affiché d'un élément (matrice CSS `matrix(a, b, c, d, tx, ty)`), 0 sans transformation. */
function shownOffset(el: HTMLElement): number {
  const match = /^matrix\((.+)\)$/.exec(getComputedStyle(el).transform);
  return match ? Number(match[1].split(",")[5]) || 0 : 0;
}

export function useFlipList(list: RefObject<HTMLElement | null>) {
  const tops = useRef(new Map<string, number>());
  const running = useRef(new Map<string, Animation>());

  // Sans tableau de dépendances : relevé à chaque rendu.
  useLayoutEffect(() => {
    const root = list.current;
    if (!root || root.hidden) {
      tops.current = new Map();
      return;
    }
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const easing =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--ease-out-expo")
        .trim() || FALLBACK_EASING;
    const next = new Map<string, number>();
    for (const el of Array.from(root.children) as HTMLElement[]) {
      const id = el.dataset.flipId;
      if (!id) continue;
      const top = el.offsetTop - root.offsetTop;
      next.set(id, top);
      const before = tops.current.get(id);
      const current = running.current.get(id);
      const shift = current ? shownOffset(el) : 0;
      current?.cancel();
      running.current.delete(id);
      if (reduce || before === undefined || typeof el.animate !== "function")
        continue;
      const from = before + shift - top;
      if (from === 0) continue;
      const animation = el.animate(
        [{ transform: `translateY(${from}px)` }, { transform: "none" }],
        { duration: DURATION_MS, easing },
      );
      running.current.set(id, animation);
      animation.onfinish = () => {
        if (running.current.get(id) === animation) running.current.delete(id);
      };
    }
    tops.current = next;
  });
}
