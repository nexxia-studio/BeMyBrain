// Marqueurs sessionStorage des moments signature (présent = déjà joué dans la session).
// Fichier sans GSAP : importé par les composants du bundle initial pour savoir s'il faut charger le moment.
export const SIDE_SWITCH_SIGNATURE_KEY = "bmb_signature_side_switch";

/** Vrai si le moment n'a pas encore été joué dans cette session. */
export function isSignaturePending(key: string): boolean {
  return sessionStorage.getItem(key) === null;
}
