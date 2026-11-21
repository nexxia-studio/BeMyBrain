"use client";

// Moment signature « Révélation de la grille » (DESIGN.md § 7) : les tuiles apparaissent dans l'ordre de
// lecture (autoAlpha, y 24 → 0), 0,15 s après la tuile pleine, en 0,9 s au plus. Une fois par session,
// chargé par next/dynamic depuis BentoGrid. GSAP anime l'enveloppe de chaque tuile ; le survol (Motion)
// anime la surface, à l'intérieur : jamais le même élément.
// Puis le reflet (DESIGN.md § 7, ligne « Reflet ») : le calque `[data-sheen]` de chaque tuile de verre
// (rendu par TileSurface, hors champ au repos) balaie la tuile de gauche à droite, une fois toutes les
// tuiles immobiles (révélation et entrée finies) : rien ne bouge derrière un verre pendant le balayage.
// Même playOnce, donc même marqueur de session que la révélation. Transform seulement.
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { RefObject } from "react";

import { introDurationS } from "./dashboard-intro";
import { CLEAR_PROPS, playOnce } from "./play-once";
import {
  BENTO_REVEAL_SIGNATURE_KEY,
  DASHBOARD_INTRO_SIGNATURE_KEY,
  isSignaturePending,
} from "./signature-keys";

const DURATION_S = 0.5;
const MAX_TOTAL_S = 0.9;
const STAGGER_S = 0.05;
const DELAY_S = 0.15;

// Reflet (DESIGN.md § 7) : durée d'un passage, décalage entre tuiles, départ après la dernière tuile.
const SHEEN_DURATION_S = 2.2;
const SHEEN_STAGGER_S = 0.16;
const SHEEN_START_AFTER_S = 0.1;

type BentoRevealSignatureProps = {
  rootRef: RefObject<HTMLElement | null>;
};

/**
 * Temps restant avant la fin de l'entrée (tuile pleine), autre moment au marqueur propre. En cours : fin
 * de ses tweens. Pas encore démarrée (morceau chargé après celui-ci) : sa durée, de ses constantes.
 */
function introRemainingS(root: HTMLElement): number {
  const intro = root.querySelector('[data-signature="intro"]');
  if (!intro) return 0;
  const items = [...intro.querySelectorAll("[data-signature-item]")];
  const running = gsap.getTweensOf([intro, ...items]);
  if (running.length > 0) {
    const end = Math.max(...running.map((tween) => tween.endTime()));
    return Math.max(end - gsap.globalTimeline.time(), 0);
  }
  if (isSignaturePending(DASHBOARD_INTRO_SIGNATURE_KEY)) {
    return introDurationS(items.length);
  }
  return 0;
}

export function BentoRevealSignature({ rootRef }: BentoRevealSignatureProps) {
  useGSAP(() => {
    playOnce(BENTO_REVEAL_SIGNATURE_KEY, "reveal", () => {
      const root = rootRef.current;
      if (!root) return;
      const tiles = [...root.querySelectorAll('[data-signature="reveal"]')];
      if (tiles.length === 0) return;
      // Beaucoup de tuiles : le décalage se resserre pour tenir dans la durée totale.
      const each = Math.min(
        STAGGER_S,
        (MAX_TOTAL_S - DURATION_S) / Math.max(tiles.length - 1, 1),
      );
      const reveal = gsap.from(tiles, {
        autoAlpha: 0,
        y: 24,
        duration: DURATION_S,
        ease: "expo.out",
        stagger: each,
        delay: DELAY_S,
        clearProps: CLEAR_PROPS,
      });

      // Calques des seules tuiles révélées (verre) : la tuile pleine n'en a pas.
      const sheens = tiles.flatMap((tile) => [
        ...tile.querySelectorAll("[data-sheen]"),
      ]);
      if (sheens.length === 0) return;
      const settled = Math.max(
        DELAY_S + reveal.totalDuration(),
        introRemainingS(root),
      );
      // Timeline créée au même instant que la révélation : la position est comptée depuis son départ.
      // fromTo avec x 0 : GSAP ne relit pas le translateX(-110%) de la classe comme un décalage en px.
      gsap.timeline().fromTo(
        sheens,
        { x: 0, xPercent: -110 },
        {
          x: 0,
          xPercent: 110,
          duration: SHEEN_DURATION_S,
          ease: "sine.inOut",
          stagger: SHEEN_STAGGER_S,
          force3D: true,
          // Fin : style en ligne retiré, la classe `sheen` remet le calque hors champ.
          clearProps: "transform",
        },
        settled + SHEEN_START_AFTER_S,
      );
    });
  });

  return null;
}
