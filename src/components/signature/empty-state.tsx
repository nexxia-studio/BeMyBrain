"use client";

// Moment signature « Écrans vides » (DESIGN.md § 7) : icône et phrase de chaque état vide arrivent en
// décalé (autoAlpha, y 12 → 0), après la révélation des tuiles. Une fois par session, chargé par
// next/dynamic depuis BentoGrid. Cibles : éléments intérieurs, jamais l'enveloppe de la tuile.
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { RefObject } from "react";

import { CLEAR_PROPS, playOnce } from "./play-once";
import { EMPTY_STATE_SIGNATURE_KEY } from "./signature-keys";

const DURATION_S = 0.4;
const STAGGER_S = 0.06;
// Au-delà, les derniers éléments arriveraient trop tard : le décalage se resserre.
const MAX_STAGGER_TOTAL_S = 0.36;

type EmptyStateSignatureProps = {
  rootRef: RefObject<HTMLElement | null>;
};

export function EmptyStateSignature({ rootRef }: EmptyStateSignatureProps) {
  useGSAP(() => {
    playOnce(EMPTY_STATE_SIGNATURE_KEY, "empty", () => {
      const items = [
        ...(rootRef.current?.querySelectorAll('[data-signature="empty"]') ??
          []),
      ];
      if (items.length === 0) return;
      gsap.from(items, {
        autoAlpha: 0,
        y: 12,
        duration: DURATION_S,
        ease: "power3.out",
        stagger: Math.min(
          STAGGER_S,
          MAX_STAGGER_TOTAL_S / Math.max(items.length - 1, 1),
        ),
        delay: 0.3,
        clearProps: CLEAR_PROPS,
      });
    });
  });

  return null;
}
