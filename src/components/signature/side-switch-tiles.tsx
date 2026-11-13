"use client";

// Autre moitié du moment « Bascule Privé / Pro » (DESIGN.md § 7) : à la première bascule de la session,
// les tuiles du nouveau côté arrivent en fondu (autoAlpha, y 8 → 0, 0,25 s) ; la pilule, elle, glisse
// (side-switch.tsx). Ensuite, toute bascule est instantanée. Chargé par next/dynamic depuis BentoGrid.
// Cibles : l'enveloppe des tuiles, déjà animée par la révélation (GSAP aussi), jamais par Motion.
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { type RefObject, useRef } from "react";

import type { Side } from "@/modules/core/schemas";

import { CLEAR_PROPS } from "./play-once";
import {
  isSignaturePending,
  markSignaturePlayed,
  SIDE_SWITCH_TILES_SIGNATURE_KEY,
} from "./signature-keys";

type SideSwitchTilesSignatureProps = {
  rootRef: RefObject<HTMLElement | null>;
  /** Côté au montage de la grille : une bascule arrivée avant le chargement de ce module compte aussi. */
  initialSide: Side;
  side: Side;
};

export function SideSwitchTilesSignature({
  rootRef,
  initialSide,
  side,
}: SideSwitchTilesSignatureProps) {
  const previous = useRef(initialSide);

  // Effet de mise en page : les tuiles du nouveau côté sont déjà dans le DOM, pas encore peintes.
  useGSAP(
    () => {
      if (previous.current === side) return;
      previous.current = side;
      if (!isSignaturePending(SIDE_SWITCH_TILES_SIGNATURE_KEY)) return;
      markSignaturePlayed(SIDE_SWITCH_TILES_SIGNATURE_KEY);

      const tiles = [
        ...(rootRef.current?.querySelectorAll('[data-signature="reveal"]') ??
          []),
      ];
      if (tiles.length === 0) return;
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(tiles, {
          autoAlpha: 0,
          y: 8,
          duration: 0.25,
          ease: "power3.out",
          clearProps: CLEAR_PROPS,
        });
      });
    },
    { dependencies: [side] },
  );

  return null;
}
