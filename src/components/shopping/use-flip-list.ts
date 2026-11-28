"use client";

// Glissement des lignes quand l'ordre change (réordonnancement différé des Courses) : technique FLIP en Web
// Animations, portée par le `<li>` (`data-flip-id`), jamais par la carte glissable (aucun composant d'animation dans
// une ligne déplaçable). Coupée sous `prefers-reduced-motion` : les lignes sautent à leur place après le délai.
// Position relevée par `offsetTop` (indifférent au défilement de la page).
import { type RefObject, useLayoutEffect, useRef } from "react";

const DURATION_MS = 250;

export function useFlipList(
  list: RefObject<HTMLElement | null>,
  orderKey: string,
) {
  const tops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = list.current;
    if (!root) {
      tops.current = new Map();
      return;
    }
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const next = new Map<string, number>();
    for (const el of Array.from(root.children) as HTMLElement[]) {
      const id = el.dataset.flipId;
      if (!id) continue;
      const top = el.offsetTop - root.offsetTop;
      next.set(id, top);
      const before = tops.current.get(id);
      if (
        !reduce &&
        before !== undefined &&
        before !== top &&
        typeof el.animate === "function"
      ) {
        el.animate(
          [
            { transform: `translateY(${before - top}px)` },
            { transform: "none" },
          ],
          { duration: DURATION_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        );
      }
    }
    tops.current = next;
  }, [list, orderKey]);
}
