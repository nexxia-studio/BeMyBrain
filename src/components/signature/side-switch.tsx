"use client";

// Moment signature « Bascule Privé / Pro » (DESIGN.md § 7, ADR-006) : la pilule active glisse vers le
// côté choisi, une seule fois par session. Chargé par next/dynamic depuis SideSwitch (hors du bundle
// initial). Seul GSAP anime l'élément `thumbRef` ; Motion n'y touche jamais.
// raccourci: tuiles du nouveau côté en fondu (même moment) — à la tâche 15, avec la grille bento.
import gsap from "gsap";
import { type RefObject, useLayoutEffect, useRef } from "react";

import type { Side } from "@/modules/core/schemas";

import {
  isSignaturePending,
  SIDE_SWITCH_SIGNATURE_KEY,
} from "./signature-keys";

export { SIDE_SWITCH_SIGNATURE_KEY };

const DURATION_S = 0.4;

type SideSwitchSignatureProps = {
  /** Pilule blanche, déjà placée sous le bouton du côté actif. */
  thumbRef: RefObject<HTMLElement | null>;
  side: Side;
};

export function SideSwitchSignature({
  thumbRef,
  side,
}: SideSwitchSignatureProps) {
  const previous = useRef(side);

  // Avant peinture : la pilule est déjà dans sa nouvelle colonne, gsap.from la ramène aussitôt à
  // l'ancienne position puis la fait glisser, sans saut visible.
  useLayoutEffect(() => {
    if (previous.current === side) return;
    previous.current = side;
    if (!isSignaturePending(SIDE_SWITCH_SIGNATURE_KEY)) return;
    sessionStorage.setItem(SIDE_SWITCH_SIGNATURE_KEY, "1");

    const thumb = thumbRef.current;
    if (!thumb) return;
    const track = thumb.parentElement;
    const gap = track ? parseFloat(getComputedStyle(track).columnGap) || 0 : 0;
    const distance = thumb.offsetWidth + gap;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(thumb, {
        // Pro est à droite : la pilule arrive de la gauche, et inversement.
        x: side === "pro" ? -distance : distance,
        duration: DURATION_S,
        ease: "power3.out",
        clearProps: "transform",
        onComplete: () => mm.revert(),
      });
    });
  }, [side, thumbRef]);

  return null;
}
