"use client";

// Moment signature « Entrée du tableau de bord » (DESIGN.md § 7) : la tuile « Aujourd'hui » apparaît
// (autoAlpha, y 16 → 0), puis la salutation et l'intro en décalé. Une fois par session, chargé par
// next/dynamic depuis BentoGrid. Seul GSAP anime ces éléments.
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { RefObject } from "react";

import { CLEAR_PROPS, playOnce } from "./play-once";
import { DASHBOARD_INTRO_SIGNATURE_KEY } from "./signature-keys";

const DURATION_S = 0.6;
const ITEMS_DELAY_S = 0.08;
const ITEMS_STAGGER_S = 0.08;

/** Durée de l'entrée (fin du dernier élément), pour enchaîner le reflet après elle (bento-reveal). */
export function introDurationS(itemCount: number): number {
  return Math.max(
    DURATION_S,
    ITEMS_DELAY_S + ITEMS_STAGGER_S * Math.max(itemCount - 1, 0) + DURATION_S,
  );
}

type DashboardIntroSignatureProps = {
  /** Racine de la grille bento. */
  rootRef: RefObject<HTMLElement | null>;
};

export function DashboardIntroSignature({
  rootRef,
}: DashboardIntroSignatureProps) {
  useGSAP(() => {
    playOnce(DASHBOARD_INTRO_SIGNATURE_KEY, "intro", () => {
      const tile = rootRef.current?.querySelector('[data-signature="intro"]');
      if (!tile) return;
      gsap.from([tile], {
        autoAlpha: 0,
        y: 16,
        duration: DURATION_S,
        ease: "power3.out",
        clearProps: CLEAR_PROPS,
      });
      gsap.from([...tile.querySelectorAll("[data-signature-item]")], {
        autoAlpha: 0,
        y: 16,
        duration: DURATION_S,
        ease: "power3.out",
        stagger: ITEMS_STAGGER_S,
        delay: ITEMS_DELAY_S,
        clearProps: CLEAR_PROPS,
      });
    });
  });

  return null;
}
