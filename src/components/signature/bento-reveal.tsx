"use client";

// Moment signature « Révélation de la grille » (DESIGN.md § 7) : les tuiles apparaissent dans l'ordre de
// lecture (autoAlpha, y 24 → 0), 0,15 s après la tuile pleine, en 0,9 s au plus. Une fois par session,
// chargé par next/dynamic depuis BentoGrid. GSAP anime l'enveloppe de chaque tuile ; le survol (Motion)
// anime la surface, à l'intérieur : jamais le même élément.
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { RefObject } from "react";

import { CLEAR_PROPS, playOnce } from "./play-once";
import { BENTO_REVEAL_SIGNATURE_KEY } from "./signature-keys";

const DURATION_S = 0.5;
const MAX_TOTAL_S = 0.9;
const STAGGER_S = 0.05;

type BentoRevealSignatureProps = {
  rootRef: RefObject<HTMLElement | null>;
};

export function BentoRevealSignature({ rootRef }: BentoRevealSignatureProps) {
  useGSAP(() => {
    playOnce(BENTO_REVEAL_SIGNATURE_KEY, "reveal", () => {
      const tiles = [
        ...(rootRef.current?.querySelectorAll('[data-signature="reveal"]') ??
          []),
      ];
      if (tiles.length === 0) return;
      // Beaucoup de tuiles : le décalage se resserre pour tenir dans la durée totale.
      const each = Math.min(
        STAGGER_S,
        (MAX_TOTAL_S - DURATION_S) / Math.max(tiles.length - 1, 1),
      );
      gsap.from(tiles, {
        autoAlpha: 0,
        y: 24,
        duration: DURATION_S,
        ease: "expo.out",
        stagger: each,
        delay: 0.15,
        clearProps: CLEAR_PROPS,
      });
    });
  });

  return null;
}
