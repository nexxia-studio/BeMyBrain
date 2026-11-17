// Mécanique commune des moments du tableau de bord (DESIGN.md § 7, ADR-006) : joué une fois par session
// (marqueur sessionStorage), coupé par gsap.matchMedia sous prefers-reduced-motion (état final, aucune
// transition), cibles démasquées en démarrant. Importé seulement par les moments chargés à la demande :
// GSAP reste hors du bundle initial.
import gsap from "gsap";

import {
  isSignaturePending,
  markSignaturePlayed,
  type PrehiddenMoment,
  releasePrehide,
} from "./signature-keys";

const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/** Propriétés posées par les moments, retirées à la fin : l'élément retrouve ses styles. */
export const CLEAR_PROPS = "opacity,visibility,transform";

/**
 * À appeler dans useGSAP (contexte annulé au démontage, matchMedia compris). `play` ne tourne que si le
 * moment n'a pas encore été joué et que le système ne demande pas moins de mouvement.
 */
export function playOnce(
  key: string,
  moment: PrehiddenMoment,
  play: () => void,
): void {
  if (!isSignaturePending(key)) {
    releasePrehide(moment);
    return;
  }
  markSignaturePlayed(key);
  gsap.matchMedia().add(MOTION_OK, () => {
    play();
  });
  // Sous mouvement réduit, rien n'a été animé : les cibles sont déjà dans leur état final.
  releasePrehide(moment);
}
